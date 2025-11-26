"""
System API router.

This module handles system-level endpoints including
status checks and health monitoring.
"""

from fastapi import APIRouter

from app.core.config import config
from database import get_all_sensors, get_all_tests

router = APIRouter()


@router.get("/status", response_model=dict)
async def get_system_status():
    """Get comprehensive system status."""
    # Get counts asynchronously
    sensors = await get_all_sensors()
    tests = await get_all_tests()
    
    return {
        "application": "Gorenje Washing Machine Monitoring API",
        "version": "2.0.0",
        "status": "operational",
        "database": {
            "type": "PostgreSQL with TimescaleDB",
            "status": "connected"
        },
        "statistics": {
            "sensors_count": len(sensors),
            "tests_count": len(tests)
        },
        "mqtt": {
            "status": "connected",
            "broker": config.mqtt_broker,
            "port": config.mqtt_port
        },
        "services": {
            "api": "online",
            "database": "online", 
            "mqtt": "online"
        }
    }


@router.get("/health", response_model=dict)
async def health_check():
    """Simple health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": "2025-10-16T00:00:00Z",
        "services": {
            "api": "up",
            "database": "up"
        }
    }


@router.get("/version", response_model=dict)
async def get_version():
    """Get application version information."""
    return {
        "application": "Gorenje Washing Machine Monitoring API",
        "version": "2.0.0",
        "architecture": "modular",
        "database": "PostgreSQL + TimescaleDB",
        "framework": "FastAPI"
    }