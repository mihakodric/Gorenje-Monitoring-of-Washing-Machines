"""
MQTT API router.

This module handles MQTT-related API endpoints including
MQTT listener control and configuration management.
"""

from fastapi import APIRouter, HTTPException

from app.models import MqttConfig, MqttConfigUpdate
from database import get_mqtt_config, create_mqtt_config, update_mqtt_config

router = APIRouter()


@router.get("/status", response_model=dict)
async def get_mqtt_status():
    """Get MQTT listener status."""
    return {
        "running": (await get_mqtt_config())["mqtt_is_active"],
        "status": "connected" if (await get_mqtt_config())["mqtt_is_active"] else "disconnected"
    }


@router.get("/config", response_model=MqttConfig)
async def get_mqtt_configuration():
    """Get MQTT configuration."""
    config = await get_mqtt_config()
    if not config:
        raise HTTPException(status_code=404, detail="MQTT configuration not found")
    return config


@router.post("/config", response_model=MqttConfig)
async def create_mqtt_configuration(config: MqttConfigUpdate):
    """Create or update MQTT configuration."""
    config_dict = {k: v for k, v in config.model_dump().items() if v is not None}
    
    # Check if config already exists
    existing_config = await get_mqtt_config()
    if existing_config:
        # If config exists, update it instead
        success = await update_mqtt_config(config_dict)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update MQTT configuration")
    else:
        # Create new config
        success = await create_mqtt_config(config_dict)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to create MQTT configuration")
    
    # Get the updated/created config to return
    updated_config = await get_mqtt_config()
    if not updated_config:
        raise HTTPException(status_code=500, detail="Failed to retrieve MQTT configuration after creation/update")

    
    return updated_config