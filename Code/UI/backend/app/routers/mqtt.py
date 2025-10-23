"""
MQTT API router.

This module handles MQTT-related API endpoints including
MQTT listener control and configuration management.
"""

from fastapi import APIRouter, HTTPException

from app.core.mqtt_mock import mqtt_listener
from app.models import MqttConfig, MqttConfigUpdate
from database import get_mqtt_config, create_mqtt_config, update_mqtt_config, set_active, set_inactive

router = APIRouter()


@router.post("/start", response_model=dict)
async def start_mqtt():
    """Start MQTT data collection."""
    if mqtt_listener.mqtt_running:
        return {"message": "MQTT listener is already running"}
    
    # Get MQTT configuration for connection details
    try:
        config = await get_mqtt_config()
        # if config:
        #     mqtt_listener.start_mqtt(config['broker_host'], config['broker_port'])
        # else:
        #     mqtt_listener.start_mqtt()  # Use default settings
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start MQTT listener: {e}"
        )

    await set_active()

    return {"message": "MQTT listener started successfully"}


@router.post("/stop", response_model=dict)
async def stop_mqtt():
    """Stop MQTT data collection."""
    if mqtt_listener.mqtt_running:
        mqtt_listener.stop_mqtt()
        await set_inactive()
        return {"message": "MQTT listener stopped successfully"}
    return {"message": "MQTT listener is not running"}


@router.get("/status", response_model=dict)
async def get_mqtt_status():
    """Get MQTT listener status."""
    return {
        "running": mqtt_listener.mqtt_running,
        "status": "connected" if mqtt_listener.mqtt_running else "disconnected"
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
    
    # Restart MQTT with new configuration if it was running
    # if mqtt_listener.mqtt_running:
    #     try:
    #         mqtt_listener.stop_mqtt()
    #         mqtt_listener.start_mqtt(updated_config['mqtt_broker_host'], updated_config['mqtt_broker_port'])
    #     except Exception as e:
    #         raise HTTPException(
    #             status_code=500,
    #             detail=f"Failed to restart MQTT listener with new configuration: {e}"
    #         )
    
    return updated_config