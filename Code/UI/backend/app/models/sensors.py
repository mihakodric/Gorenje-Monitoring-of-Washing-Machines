"""
Sensor models for the Gorenje API.
"""

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class SensorBase(BaseModel):
    """Base sensor model with common fields."""
    sensor_type_id: int
    sensor_mqtt_topic: str
    sensor_name: str
    sensor_description: Optional[str] = None


class SensorCreate(SensorBase):
    """Model for creating a new sensor."""
    pass


class SensorUpdate(BaseModel):
    """Model for updating an existing sensor."""
    sensor_type_id: Optional[int] = None
    sensor_mqtt_topic: Optional[str] = None
    sensor_name: Optional[str] = None
    sensor_description: Optional[str] = None
    sensor_settings: Optional[Dict[str, Any]] = None


class Sensor(SensorBase):
    """Complete sensor model with database fields."""
    id: int
    sensor_is_online: bool
    sensor_created_at: datetime
    sensor_last_seen: Optional[datetime] = None
    sensor_settings: Optional[Dict[str, Any]] = None