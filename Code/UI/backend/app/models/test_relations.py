"""
Test relations for the Gorenje API.
"""

from pydantic import BaseModel
from typing import Any, Dict, Optional, List
from datetime import datetime

# Test Relations Models
class TestRelation(BaseModel):
    """Test relation model linking tests with sensors."""
    test_id: int
    sensor_id: int
    sensor_name: str
    sensor_type: str
    sensor_location: Optional[str] = ""
    active: bool = False
    assigned_at: Optional[datetime] = None
    unassigned_at: Optional[datetime] = None


class TestRelationCreate(BaseModel):
    """Model for creating a test relation."""
    test_id: int
    sensor_id: int
    sensor_location: Optional[str] = ""
    active: bool = False
    assigned_at: Optional[datetime] = None
    unassigned_at: Optional[datetime] = None


class TestRelationAllDetails(TestRelationCreate):
    """Detailed test relation model including all fields."""
    id: int
    sensor_name: str
    sensor_is_online: bool
    sensor_created_at: datetime
    sensor_last_seen: Optional[datetime] = None
    sensor_settings: Optional[Dict[str, Any]] = None
    sensor_type_name: Optional[str] = None
    sensor_type_description: Optional[str] = None
    sensor_type_unit: Optional[str] = None