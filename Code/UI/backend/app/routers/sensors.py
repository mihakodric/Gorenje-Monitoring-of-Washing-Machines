"""
Sensors API router.

This module handles all sensor-related API endpoints including
CRUD operations for sensors and their relationships with tests.
"""

from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models import Sensor, SensorCreate, SensorUpdate
from app.mqtt_client import publish_cmd
from database import (
    get_all_sensors,
    get_sensor_by_id,
    create_sensor,
    update_sensor,
    delete_sensor,
    get_tests_for_sensor
)

router = APIRouter()


class IdentifyRequest(BaseModel):
    """Request model for sensor identification."""
    sensor_mqtt_topic: str


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


@router.post("/identify", response_model=dict)
async def identify_sensor(request: IdentifyRequest):
    """
    Send an MQTT identify command to a sensor.
    
    This publishes a message to sensors/{sensor_mqtt_topic}/cmd
    which should cause the sensor's LED to blink for identification.
    """
    try:
        topic = f"sensors/{request.sensor_mqtt_topic}/cmd"
        payload = {"cmd": "identify"}
        
        publish_cmd(topic, payload)
        
        return {
            "message": "Identify command sent successfully",
            "topic": topic
        }
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"MQTT service unavailable: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send identify command: {str(e)}"
        )


@router.post("/{sensor_id}/request-config", response_model=dict)
async def request_sensor_config(sensor_id: int):
    """
    Send an MQTT command to request sensor configuration.
    
    This publishes a message to sensors/{sensor_mqtt_topic}/cmd
    with cmd: "get_config" which should cause the sensor to publish its config.
    """
    sensor = await get_sensor_by_id(sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    if not sensor.get('sensor_is_online'):
        raise HTTPException(
            status_code=400,
            detail="Sensor is offline. Cannot request configuration."
        )
    
    try:
        topic = f"sensors/{sensor['sensor_mqtt_topic']}/cmd"
        payload = {"cmd": "get_config"}
        
        publish_cmd(topic, payload)
        
        return {
            "message": "Config request sent successfully",
            "topic": topic
        }
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"MQTT service unavailable: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send config request: {str(e)}"
        )


@router.get("/{sensor_id}/is-active", response_model=dict)
async def check_sensor_active_status(sensor_id: int):
    """
    Check if a sensor is currently active in any test.
    
    Returns true if the sensor has any active test relations.
    """
    sensor = await get_sensor_by_id(sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    relations = await get_tests_for_sensor(sensor_id)
    is_active = any(rel.get('active', False) for rel in relations)
    
    return {
        "sensor_id": sensor_id,
        "is_active": is_active,
        "active_test_relations": [rel for rel in relations if rel.get('active', False)]
    }


class UpdateConfigRequest(BaseModel):
    """Request model for updating sensor configuration."""
    config: dict
    restart: bool = True


@router.post("/{sensor_id}/update-config", response_model=dict)
async def update_sensor_config(sensor_id: int, request: UpdateConfigRequest):
    """
    Send an MQTT command to update sensor configuration.
    
    This publishes a message to sensors/{sensor_mqtt_topic}/cmd
    with cmd: "update_config", config object, and restart flag.
    """
    sensor = await get_sensor_by_id(sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    if not sensor.get('sensor_is_online'):
        raise HTTPException(
            status_code=400,
            detail="Sensor is offline. Cannot update configuration."
        )
    
    try:
        topic = f"sensors/{sensor['sensor_mqtt_topic']}/cmd"
        payload = {
            "cmd": "update_config",
            "config": request.config,
            "restart": request.restart
        }
        
        publish_cmd(topic, payload)
        
        return {
            "message": "Config update command sent successfully",
            "topic": topic,
            "config": request.config
        }
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"MQTT service unavailable: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send config update: {str(e)}"
        )