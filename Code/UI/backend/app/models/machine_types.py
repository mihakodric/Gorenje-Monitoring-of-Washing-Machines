"""
Machine Type models for the Gorenje API.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MachineTypeBase(BaseModel):
    """Base machine type model with common fields."""
    machine_type_name: str
    machine_type_description: Optional[str] = None


class MachineTypeCreate(MachineTypeBase):
    """Model for creating a new machine type."""
    pass


class MachineTypeUpdate(BaseModel):
    """Model for updating an existing machine type."""
    machine_type_name: Optional[str] = None
    machine_type_description: Optional[str] = None


class MachineType(MachineTypeBase):
    """Complete machine type model with database fields."""
    machine_type_id: int
    machine_type_created_at: datetime