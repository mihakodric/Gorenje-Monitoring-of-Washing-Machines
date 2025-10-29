"""
Measurement models for the Gorenje API.
"""

from pydantic import BaseModel
from datetime import datetime


class MeasurementAveraged(BaseModel):
    """Model for sensor measurements."""
    measurement_timestamp: datetime
    test_relation_id: int
    measurement_channel: str
    avg_value: float
    min_value: float
    max_value: float
    avg_abs_value: float
    min_abs_value: float
    max_abs_value: float
    num_samples: int