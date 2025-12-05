"""
Core application components.

This module provides access to core application functionality
including lifespan management.
"""

from .lifespan import lifespan

__all__ = [
    "lifespan"
]