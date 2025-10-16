"""
Sensors API router.

This module handles all sensor-related API endpoints including
CRUD operations for sensors and their relationships with tests.
"""

from typing import List
from fastapi import APIRouter, HTTPException

from app.core.mqtt_mock import mqtt_publisher
from app.models import Sensor, SensorCreate, SensorUpdate, SensorSettingsUpdate
from database import (
    get_all_sensors,
    get_sensor_by_id,
    create_sensor,
    update_sensor,
    update_sensor_settings,
    delete_sensor,
    get_test_relations_for_sensor
)

router = APIRouter()


@router.get("", response_model=List[Sensor])
async def get_sensors():
    """Get all sensors."""
    return await get_all_sensors()


@router.get("/{sensor_id}", response_model=Sensor)
async def get_sensor(sensor_id: int):
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
    return {"message": "Sensor created successfully", "sensor_id": created_sensor.get("id")}


@router.put("/{sensor_id}", response_model=dict)
async def update_sensor_endpoint(sensor_id: int, sensor: SensorUpdate):
    """Update an existing sensor."""
    success = await update_sensor(sensor_id, sensor.model_dump())
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return {"message": "Sensor updated successfully"}


@router.put("/{sensor_id}/settings", response_model=dict)
async def update_sensor_settings_endpoint(sensor_id: int, sensor: SensorSettingsUpdate):
    """Update sensor settings and notify via MQTT."""
    success = await update_sensor_settings(sensor_id, sensor.sensor_settings)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    # Send MQTT configuration update
    mqtt_publisher.send_config_update(sensor_id, sensor.sensor_settings)
    
    return {"message": "Sensor settings updated successfully"}


@router.delete("/{sensor_id}", response_model=dict)
async def delete_sensor_endpoint(sensor_id: int):
    """Delete a sensor if it has no active test relations."""
    # Check for existing test relations
    relations = await get_test_relations_for_sensor(sensor_id)
    if relations:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete sensor with existing test relations. Remove from tests first."
        )
    
    success = await delete_sensor(sensor_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    return {"message": "Sensor deleted successfully"}