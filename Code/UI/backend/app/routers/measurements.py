from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
import database.measurements as measurements_db
from app.models import MeasurementAveraged, MeasurementRaw

router = APIRouter()

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
    limit: Optional[int] = Query(1000, description="Maximum number of data points per channel")
):
    """Get raw measurements for a specific test relation (sensor in a test).
    Returns the most recent raw measurements (up to limit per channel).
    """
    try:
        # Pass limit to database function for optimized query
        measurements = await measurements_db.get_sensor_measurements_raw(test_relation_id, limit)
        
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
        
        return measurements
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching raw measurements: {str(e)}")