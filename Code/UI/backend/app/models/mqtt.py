"""
MQTT Configuration models for the Gorenje API.
"""

from pydantic import BaseModel
from typing import Optional


class MqttConfigBase(BaseModel):
    """Base MQTT configuration model with common fields."""
    mqtt_broker_host: str
    mqtt_broker_port: Optional[int] = 1883
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None


class MqttConfigUpdate(BaseModel):
    """Model for updating MQTT configuration."""
    mqtt_broker_host: Optional[str] = None
    mqtt_broker_port: Optional[int] = None
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None


class MqttConfig(MqttConfigBase):
    """Complete MQTT configuration model with database fields."""
    mqtt_is_active: bool