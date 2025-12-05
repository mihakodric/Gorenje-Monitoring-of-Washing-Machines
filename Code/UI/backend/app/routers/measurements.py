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