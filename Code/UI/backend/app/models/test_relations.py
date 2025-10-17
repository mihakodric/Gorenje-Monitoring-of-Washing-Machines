"""
Test relations for the Gorenje API.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Test Relations Models
class TestRelation(BaseModel):
    """Test relation model linking tests with machines and sensors."""
    test_id: int
    machine_id: int
    machine_name: str
    machine_type: str
    sensor_id: int
    sensor_name: str
    sensor_type: str
    sensor_location: Optional[str] = ""


class TestRelationCreate(BaseModel):
    """Model for creating a test relation."""
    test_id: int
    machine_id: int
    sensor_id: int
    sensor_location: Optional[str] = ""