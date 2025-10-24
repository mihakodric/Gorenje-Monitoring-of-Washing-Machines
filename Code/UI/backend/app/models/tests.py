"""
Test models  for the Gorenje API.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from enum import Enum

class TestStatus(str, Enum):
    idle = "idle"
    running = "running"
    completed = "completed"
    failed = "failed"


class TestBase(BaseModel):
    """Base test model with common fields."""
    test_name: str
    machine_id: int
    test_description: Optional[str] = ""
    test_notes: Optional[str] = ""


class TestCreate(TestBase):
    """Model for creating a new test."""
    pass


class TestUpdate(BaseModel):
    """Model for updating an existing test."""
    test_name: Optional[str] = None
    machine_id: Optional[int] = None
    test_description: Optional[str] = None
    test_notes: Optional[str] = None


class Test(TestBase):
    """Complete test model with database fields."""
    id: int
    test_status: TestStatus
    test_created_at: datetime
    test_last_modified_at: datetime
    test_sensor_count: Optional[int] = 0
    test_first_data_time: Optional[datetime] = None
    test_last_data_time: Optional[datetime] = None