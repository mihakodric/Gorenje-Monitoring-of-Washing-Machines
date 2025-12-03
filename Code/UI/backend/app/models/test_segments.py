"""
Test Segment models for the Gorenje API.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TestSegmentBase(BaseModel):
    """Base test segment model with common fields."""
    segment_name: str
    start_time: datetime
    end_time: datetime


class TestSegmentCreate(TestSegmentBase):
    """Model for creating a new test segment."""
    test_id: int


class TestSegmentUpdate(BaseModel):
    """Model for updating an existing test segment."""
    segment_name: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class TestSegment(TestSegmentBase):
    """Complete test segment model with database fields."""
    id: int
    test_id: int
    created_at: datetime
    last_modified_at: datetime
