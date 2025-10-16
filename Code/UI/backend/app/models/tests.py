"""
Test models and relations for the Gorenje API.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class TestBase(BaseModel):
    """Base test model with common fields."""
    test_name: str
    test_description: Optional[str] = ""
    test_notes: Optional[str] = ""
    test_created_by: str


class TestCreate(TestBase):
    """Model for creating a new test."""
    pass


class TestUpdate(BaseModel):
    """Model for updating an existing test."""
    test_name: Optional[str] = None
    test_description: Optional[str] = None
    test_notes: Optional[str] = None
    test_created_by: Optional[str] = None


class Test(TestBase):
    """Complete test model with database fields."""
    test_id: int
    test_status: Optional[str] = "idle"  # 'idle', 'running', 'completed', 'failed'
    test_created_at: datetime
    test_last_modified_at: datetime
    test_sensor_count: Optional[int] = 0
    test_first_data_time: Optional[datetime] = None
    test_last_data_time: Optional[datetime] = None


# Test Relations Models
class TestRelation(BaseModel):
    """Test relation model linking tests with machines and sensors."""
    test_relation_id: int
    test_id: int
    machine_id: int
    sensor_id: int
    sensor_location: Optional[str] = ""


class TestRelationCreate(BaseModel):
    """Model for creating a test relation."""
    machine_id: int
    sensor_id: int
    sensor_location: Optional[str] = ""


class SensorWithLocation(BaseModel):
    """Sensor with location information for tests."""
    sensor_id: int
    sensor_location: str = ""


class TestWithRelations(BaseModel):
    """Test model with its relations."""
    test: Test
    machine_id: Optional[int] = None
    sensors: List[SensorWithLocation] = []


class TestCreateWithRelations(BaseModel):
    """Model for creating a test with relations."""
    test: TestCreate
    machine_id: int
    sensors: List[SensorWithLocation]


class MachineUpdateForTest(BaseModel):
    """Model for updating machine in test context."""
    machine_id: int


class UpdateRelationsRequest(BaseModel):
    """Model for updating test relations."""
    machine_id: int
    sensors: List[SensorWithLocation]