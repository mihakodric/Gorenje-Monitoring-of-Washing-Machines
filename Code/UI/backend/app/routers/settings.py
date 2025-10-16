"""
Settings API router.

This module handles system settings endpoints including
sensor types and machine types management.
"""

from typing import List
from fastapi import APIRouter

# Import the individual routers
from .sensor_types import router as sensor_types_router
from .machine_types import router as machine_types_router

router = APIRouter()

# Include sub-routers under /settings
router.include_router(
    sensor_types_router,
    prefix="/sensor-types",
    tags=["Settings - Sensor Types"]
)

router.include_router(
    machine_types_router, 
    prefix="/machine-types",
    tags=["Settings - Machine Types"]
)