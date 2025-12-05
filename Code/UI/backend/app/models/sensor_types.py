"""
Sensor Type models for the Gorenje API.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SensorTypeBase(BaseModel):
    """Base sensor type model with common fields."""
    sensor_type_name: str
    sensor_type_unit: Optional[str] = None
    sensor_type_description: Optional[str] = None


class SensorTypeCreate(SensorTypeBase):
    """Model for creating a new sensor type."""
    pass


class SensorTypeUpdate(BaseModel):
    """Model for updating an existing sensor type."""
    sensor_type_name: Optional[str] = None
    sensor_type_unit: Optional[str] = None
    sensor_type_description: Optional[str] = None


class SensorType(SensorTypeBase):
    """Complete sensor type model with database fields."""
    id: int
    sensor_type_created_at: datetime