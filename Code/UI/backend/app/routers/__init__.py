"""
API routers for the Gorenje Washing Machine Monitoring system.

This module provides access to all API routers organized by functionality.
"""

from . import (
    sensors,
    sensor_types,
    machines,
    machine_types,
    tests,
    mqtt,
    settings,
    system
)

__all__ = [
    "sensors",
    "sensor_types", 
    "machines",
    "machine_types",
    "tests",
    "mqtt",
    "settings",
    "system"
]