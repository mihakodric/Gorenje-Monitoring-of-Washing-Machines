"""
Core application components.

This module provides access to core application functionality
including configuration, lifespan management, and MQTT mocking.
"""

from .config import config
from .lifespan import lifespan

__all__ = [
    "config",
    "lifespan"
]