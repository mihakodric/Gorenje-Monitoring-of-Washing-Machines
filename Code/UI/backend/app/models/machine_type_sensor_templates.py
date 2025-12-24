"""
Machine Type Sensor Template models for the Gorenje API.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MachineTypeSensorTemplateBase(BaseModel):
    """Base machine type sensor template model with common fields."""
    machine_type_id: int
    sensor_type_id: int
    location: str
    is_required: bool = True
    display_order: int = 0


class MachineTypeSensorTemplateCreate(BaseModel):
    """Model for creating a new machine type sensor template (machine_type_id from URL)."""
    sensor_type_id: int
    location: str
    is_required: bool = True
    display_order: int = 0


class MachineTypeSensorTemplateUpdate(BaseModel):
    """Model for updating an existing machine type sensor template."""
    sensor_type_id: Optional[int] = None
    location: Optional[str] = None
    is_required: Optional[bool] = None
    display_order: Optional[int] = None


class MachineTypeSensorTemplate(MachineTypeSensorTemplateBase):
    """Complete machine type sensor template model with database fields."""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MachineTypeSensorTemplateWithDetails(MachineTypeSensorTemplate):
    """Machine type sensor template with sensor type details."""
    sensor_type_name: str
    sensor_type_unit: Optional[str] = None
