from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
import database.measurements as measurements_db
from app.models import MeasurementAveraged

router = APIRouter()

@router.get("/avg/{test_relation_id}", response_model=List[MeasurementAveraged])
async def get_sensor_measurements_avg(
    test_relation_id: int,
    start_time: Optional[datetime] = Query(None, description="Start time for data range"),
    end_time: Optional[datetime] = Query(None, description="End time for data range"),
    limit: Optional[int] = Query(1000, description="Maximum number of data points")
):
    """Get measurements for a specific test relation (sensor in a test)."""
    try:
        measurements = await measurements_db.get_sensor_measurements_avg(test_relation_id)
        
        # Filter by time range if provided
        if start_time or end_time:
            filtered_measurements = []
            for measurement in measurements:
                measurement_time = measurement.get('bucket')
                if measurement_time:
                    if isinstance(measurement_time, str):
                        measurement_time = datetime.fromisoformat(measurement_time.replace('Z', '+00:00'))
                    
                    if start_time and measurement_time < start_time:
                        continue
                    if end_time and measurement_time > end_time:
                        continue
                    
                    filtered_measurements.append(measurement)
            measurements = filtered_measurements
        
        # Apply limit
        if limit and len(measurements) > limit:
            # Take the most recent measurements
            measurements = measurements[:limit]
        
        return measurements
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching measurements: {str(e)}")