from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from pydantic import BaseModel
import database.measurements as measurements_db
from app.models import MeasurementAveraged, MeasurementRaw
import io
import csv
import os
import uuid
import pandas as pd
import asyncio

router = APIRouter()

# In-memory job tracking (consider using Redis for production)
export_jobs: Dict[str, dict] = {}

# Directory to store export files temporarily
EXPORT_DIR = "/tmp/exports"
os.makedirs(EXPORT_DIR, exist_ok=True)


class CropRequest(BaseModel):
    """Request model for cropping measurements."""
    test_id: int
    start_time: datetime
    end_time: datetime


class ExportRequest(BaseModel):
    """Request model for exporting measurements."""
    test_id: int
    data_type: str  # "aggregated" or "raw"
    time_range: str  # "whole" or "segment"
    segment_id: Optional[int] = None


@router.get("/avg/{test_relation_id}", response_model=List[MeasurementAveraged])
async def get_sensor_measurements_avg(
    test_relation_id: int,
    start_time: Optional[datetime] = Query(None, description="Start time for data range"),
    end_time: Optional[datetime] = Query(None, description="End time for data range"),
    limit: Optional[int] = Query(1000, description="Maximum number of data points per channel")
):
    """Get measurements for a specific test relation (sensor in a test), grouped by channel."""
    try:
        measurements = await measurements_db.get_sensor_measurements_avg(test_relation_id)
        
        # Filter by time range if provided
        if start_time or end_time:
            filtered_measurements = []
            for measurement in measurements:
                measurement_time = measurement.get('measurement_timestamp')
                if measurement_time:
                    if isinstance(measurement_time, str):
                        measurement_time = datetime.fromisoformat(measurement_time.replace('Z', '+00:00'))
                    
                    if start_time and measurement_time < start_time:
                        continue
                    if end_time and measurement_time > end_time:
                        continue
                    
                    filtered_measurements.append(measurement)
            measurements = filtered_measurements
        
        # Apply limit per channel
        if limit:
            # Group by channel
            channel_groups = {}
            for measurement in measurements:
                channel = measurement.get('measurement_channel', 'none')
                if channel not in channel_groups:
                    channel_groups[channel] = []
                channel_groups[channel].append(measurement)
            
            # Apply limit to each channel and combine
            limited_measurements = []
            for channel, channel_data in channel_groups.items():
                # Take the most recent measurements per channel
                limited_measurements.extend(channel_data[-limit:])
            
            measurements = limited_measurements
        
        return measurements
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching measurements: {str(e)}")
    

@router.get("/raw/{test_relation_id}", response_model=List[MeasurementRaw])
async def get_sensor_measurements_raw(
    test_relation_id: int,
    start_time: Optional[datetime] = Query(None, description="Start time for data range"),
    end_time: Optional[datetime] = Query(None, description="End time for data range"),
    last_minutes: Optional[int] = Query(None, description="Fetch measurements from the last N minutes"),
    limit: Optional[int] = Query(10000, description="Maximum number of data points per channel")
):
    """Get raw measurements for a specific test relation (sensor in a test).
    
    Time filtering options (mutually exclusive):
    - start_time/end_time: Fetch measurements within explicit time range
    - last_minutes: Fetch measurements from the last N minutes relative to latest timestamp
    - None: Fetch all available measurements (still limited by 'limit' per channel)
    
    Returns up to 'limit' measurements per channel.
    """
    try:
        # Validate conflicting parameters
        if last_minutes is not None and (start_time or end_time):
            raise HTTPException(
                status_code=400, 
                detail="Cannot use 'last_minutes' together with 'start_time' or 'end_time'. Choose one filtering method."
            )
        
        # Pass all parameters to database function - it handles the filtering efficiently
        measurements = await measurements_db.get_sensor_measurements_raw(
            test_relation_id=test_relation_id,
            limit=limit,
            last_minutes=last_minutes,
            start_time=start_time,
            end_time=end_time
        )
        
        return measurements
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching raw measurements: {str(e)}")


@router.post("/crop", response_model=dict)
async def crop_measurements(crop_request: CropRequest):
    """
    Crop (permanently delete) measurements outside the specified time range for a test.
    Deletes data from both raw measurements and aggregated tables.
    
    ⚠️ WARNING: This operation is permanent and cannot be undone!
    """
    try:
        if crop_request.start_time >= crop_request.end_time:
            raise HTTPException(
                status_code=400,
                detail="Start time must be before end time"
            )
        
        result = await measurements_db.crop_measurements_by_test(
            test_id=crop_request.test_id,
            start_time=crop_request.start_time,
            end_time=crop_request.end_time
        )
        
        return {
            "message": "Measurements cropped successfully",
            "raw_deleted": result["raw_deleted"],
            "avg_deleted": result["avg_deleted"],
            "total_deleted": result["raw_deleted"] + result["avg_deleted"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error cropping measurements: {str(e)}"
        )


async def generate_export_file(job_id: str, export_request: ExportRequest):
    """Background task to generate export file."""
    try:
        export_jobs[job_id]['status'] = 'processing'
        export_jobs[job_id]['progress'] = 0
        
        # Import here to avoid circular dependencies
        import database.test_relations as test_relations_db
        import database.test_segments as test_segments_db
        
        # Get time range
        start_time = None
        end_time = None
        
        if export_request.time_range == "segment":
            segment = await test_segments_db.get_segment_by_id(export_request.segment_id)
            if not segment:
                export_jobs[job_id]['status'] = 'failed'
                export_jobs[job_id]['error'] = 'Segment not found'
                return
            start_time = segment['start_time']
            end_time = segment['end_time']
        
        # Get all test relations (sensors in the test)
        test_relations = await test_relations_db.get_test_relations(export_request.test_id)
        if not test_relations:
            export_jobs[job_id]['status'] = 'failed'
            export_jobs[job_id]['error'] = 'No sensors found for this test'
            return
        
        export_jobs[job_id]['progress'] = 10
        
        # Fetch all sensor data
        sensor_dataframes = []
        total_sensors = len(test_relations)
        
        for idx, relation in enumerate(test_relations):
            test_relation_id = relation['id']
            sensor_name = relation['sensor_name']
            sensor_location = relation.get('sensor_location', 'N/A')
            sensor_unit = relation['sensor_type_unit']
            
            # Fetch measurements
            if export_request.data_type == "aggregated":
                measurements = await measurements_db.get_sensor_measurements_avg(test_relation_id)
            else:
                measurements = await measurements_db.get_sensor_measurements_raw(
                    test_relation_id,
                    limit=1_000_000,
                    start_time=start_time,
                    end_time=end_time
                )
            
            # Filter by time if needed (for aggregated data)
            if start_time and end_time and export_request.data_type == "aggregated":
                measurements = [
                    m for m in measurements
                    if start_time <= m['measurement_timestamp'] <= end_time
                ]
            
            if measurements:
                # Convert to DataFrame
                df = pd.DataFrame(measurements)
                
                # Rename columns with sensor info
                df['timestamp'] = pd.to_datetime(df['measurement_timestamp'])
                df = df.sort_values('timestamp')
                
                # Create column names based on data type
                if export_request.data_type == "aggregated":
                    # For aggregated: keep avg, min, max with sensor prefix
                    channel_col = df['measurement_channel'].fillna('value')
                    df[f"{sensor_name}_{sensor_location}_avg_{sensor_unit}"] = df['avg_value']
                    df[f"{sensor_name}_{sensor_location}_min_{sensor_unit}"] = df['min_value']
                    df[f"{sensor_name}_{sensor_location}_max_{sensor_unit}"] = df['max_value']
                    df = df[['timestamp', f"{sensor_name}_{sensor_location}_avg_{sensor_unit}", 
                            f"{sensor_name}_{sensor_location}_min_{sensor_unit}", 
                            f"{sensor_name}_{sensor_location}_max_{sensor_unit}"]]
                else:
                    # For raw: just value
                    df[f"{sensor_name}_{sensor_location}_{sensor_unit}"] = df['measurement_value']
                    df = df[['timestamp', f"{sensor_name}_{sensor_location}_{sensor_unit}"]]
                
                sensor_dataframes.append(df)
            
            # Update progress
            export_jobs[job_id]['progress'] = 10 + int((idx + 1) / total_sensors * 60)
        
        export_jobs[job_id]['progress'] = 70
        
        # Merge all sensor dataframes on timestamp
        if sensor_dataframes:
            merged_df = sensor_dataframes[0]
            for df in sensor_dataframes[1:]:
                merged_df = pd.merge(merged_df, df, on='timestamp', how='outer')
            
            merged_df = merged_df.sort_values('timestamp')
            
            export_jobs[job_id]['progress'] = 80
            
            # Save to parquet
            filename = f"test_{export_request.test_id}_{export_request.data_type}_{job_id}.parquet"
            filepath = os.path.join(EXPORT_DIR, filename)
            
            merged_df.to_parquet(filepath, index=False, compression='snappy')
            
            export_jobs[job_id]['status'] = 'completed'
            export_jobs[job_id]['progress'] = 100
            export_jobs[job_id]['filename'] = filename
            export_jobs[job_id]['filepath'] = filepath
            export_jobs[job_id]['completed_at'] = datetime.now().isoformat()
        else:
            export_jobs[job_id]['status'] = 'failed'
            export_jobs[job_id]['error'] = 'No data to export'
        
    except Exception as e:
        export_jobs[job_id]['status'] = 'failed'
        export_jobs[job_id]['error'] = str(e)


@router.post("/export")
async def start_export(export_request: ExportRequest, background_tasks: BackgroundTasks):
    """
    Start a background export job.
    Returns a job_id to track progress.
    """
    # Validate inputs
    if export_request.data_type not in ["aggregated", "raw"]:
        raise HTTPException(status_code=400, detail="data_type must be 'aggregated' or 'raw'")
    
    if export_request.time_range not in ["whole", "segment"]:
        raise HTTPException(status_code=400, detail="time_range must be 'whole' or 'segment'")
    
    if export_request.time_range == "segment" and not export_request.segment_id:
        raise HTTPException(status_code=400, detail="segment_id is required when time_range is 'segment'")
    
    # Create job
    job_id = str(uuid.uuid4())
    export_jobs[job_id] = {
        'status': 'queued',
        'progress': 0,
        'created_at': datetime.now().isoformat(),
        'test_id': export_request.test_id,
        'data_type': export_request.data_type,
        'time_range': export_request.time_range
    }
    
    # Start background task
    background_tasks.add_task(generate_export_file, job_id, export_request)
    
    return {
        'job_id': job_id,
        'message': 'Export job started'
    }


@router.get("/export/status/{job_id}")
async def get_export_status(job_id: str):
    """Get the status of an export job."""
    if job_id not in export_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return export_jobs[job_id]


@router.get("/export/download/{job_id}")
async def download_export(job_id: str):
    """Download the completed export file."""
    if job_id not in export_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = export_jobs[job_id]
    
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail=f"Job status is {job['status']}, not completed")
    
    filepath = job.get('filepath')
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Export file not found")
    
    return FileResponse(
        filepath,
        media_type='application/octet-stream',
        filename=job['filename']
    )
