"""
Machine models for the Gorenje API.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MachineBase(BaseModel):
    """Base machine model with common fields."""
    machine_name: str
    machine_description: Optional[str] = None
    machine_type_id: Optional[int] = None


class MachineCreate(MachineBase):
    """Model for creating a new machine."""
    pass


class MachineUpdate(BaseModel):
    """Model for updating an existing machine."""
    machine_name: Optional[str] = None
    machine_description: Optional[str] = None
    machine_type_id: Optional[int] = None


class Machine(MachineBase):
    """Complete machine model with database fields."""
    id: int
    machine_created_at: datetime