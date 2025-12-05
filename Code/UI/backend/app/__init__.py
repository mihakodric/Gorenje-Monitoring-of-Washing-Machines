"""
Gorenje Washing Machine Monitoring Application.

This package contains the modular FastAPI application for monitoring
and managing washing machine sensors, tests, and related data.
"""

from .main import app

__version__ = "2.0.0"
__title__ = "Gorenje Washing Machine Monitoring API"

__all__ = ["app"]