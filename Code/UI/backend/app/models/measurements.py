"""
Measurement models for the Gorenje API.
"""

from pydantic import BaseModel
from datetime import datetime


class Measurement(BaseModel):
    """Model for sensor measurements."""
    measurement_timestamp: datetime
    test_relation_id: int
    measurement_channel: str
    measurement_value: float