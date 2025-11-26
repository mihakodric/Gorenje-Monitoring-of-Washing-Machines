"""
Sensors API router.

This module handles all sensor-related API endpoints including
CRUD operations for sensors and their relationships with tests.
"""

from typing import List
from fastapi import APIRouter, HTTPException

from app.models import Sensor, SensorCreate, SensorUpdate
from database import (
    get_all_sensors,
    get_sensor_by_id,
    create_sensor,
    update_sensor,
    delete_sensor,
    get_tests_for_sensor
)

router = APIRouter()


@router.get("", response_model=List[Sensor])
async def get_sensors():
    """Get all sensors."""
    return await get_all_sensors()


@router.get("/{sensor_id}", response_model=Sensor)
async def get_sensor_by_id_endpoint(sensor_id: int):
    """Get a specific sensor by ID."""
    sensor = await get_sensor_by_id(sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return sensor


@router.post("", response_model=dict)
async def create_sensor_endpoint(sensor: SensorCreate):
    """Create a new sensor."""
    created_sensor = await create_sensor(sensor.model_dump())
    if not created_sensor:
        raise HTTPException(
            status_code=400, 
            detail="Failed to create sensor - sensor might already exist"
        )
    return {
        "message": "Sensor created successfully", 
        "sensor": await get_sensor_by_id(created_sensor.get("id"))
        }


@router.put("/{sensor_id}", response_model=dict)
async def update_sensor_endpoint(sensor_id: int, sensor: SensorUpdate):
    """Update an existing sensor."""
    update_data = sensor.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No data provided for update")

    success = await update_sensor(sensor_id, update_data)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")

    return {
        "message": "Sensor updated successfully", 
        "sensor": await get_sensor_by_id(sensor_id)
        }

@router.delete("/{sensor_id}", response_model=dict)
async def delete_sensor_endpoint(sensor_id: int):
    """Delete a sensor if it has no active test relations."""
    # Check for existing test relations
    relations = await get_tests_for_sensor(sensor_id)
    if relations:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete sensor with existing test relations. This sensor is linked to: {', '.join([str(r['test_id'])+' - '+r['test_name']for r in relations])}"
        )
    
    success = await delete_sensor(sensor_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    return {
        "message": "Sensor deleted successfully"
        }