"""
Sensor Types API router.

This module handles all sensor type-related API endpoints including
CRUD operations for sensor types used in the system.
"""

from typing import List
from fastapi import APIRouter, HTTPException

from app.models import SensorType, SensorTypeCreate, SensorTypeUpdate
from database import (
    get_all_sensor_types,
    get_sensor_type_by_id,
    create_sensor_type,
    update_sensor_type,
    delete_sensor_type,

    get_sensors_by_sensor_type
)


router = APIRouter()


@router.get("", response_model=List[SensorType])
async def get_sensor_types():
    """Get all sensor types."""
    return await get_all_sensor_types()


@router.get("/{type_id}", response_model=SensorType)
async def get_sensor_type(type_id: int):
    """Get a specific sensor type by ID."""
    sensor_type = await get_sensor_type_by_id(type_id)
    if not sensor_type:
        raise HTTPException(status_code=404, detail="Sensor type not found")
    return sensor_type


@router.post("", response_model=SensorType)
async def create_sensor_type_endpoint(sensor_type: SensorTypeCreate):
    """Create a new sensor type."""
    created_type = await create_sensor_type(sensor_type.model_dump())
    if not created_type:
        raise HTTPException(
            status_code=400,
            detail="Failed to create sensor type - type might already exist"
        )
    return created_type


@router.put("/{type_id}", response_model=SensorType)
async def update_sensor_type_endpoint(type_id: int, sensor_type: SensorTypeUpdate):
    """Update an existing sensor type."""
    update_data = sensor_type.model_dump(exclude_unset=True)
    result = await update_sensor_type(type_id, update_data)
    if not result:
        raise HTTPException(status_code=404, detail="Sensor type not found")
    return await get_sensor_type_by_id(type_id)


@router.delete("/{type_id}")
async def delete_sensor_type_endpoint(type_id: int):
    """Delete a sensor type. Related sensors will be marked as inactive."""

    # check if sensor_type is used by any sensors
    related_sensors = await get_sensors_by_sensor_type(type_id)
    if related_sensors:
        sensor_names = ', '.join([sensor['sensor_name'] for sensor in related_sensors])
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete sensor type - it is in use by existing sensors: {sensor_names}",
        )

    success = await delete_sensor_type(type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor type not found")
    return {
        "message": "Sensor type deleted successfully."
    }