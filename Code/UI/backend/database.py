"""
Legacy database module for backward compatibility.

This module is kept for backward compatibility but the preferred
approach is to import directly from the database package:

    from database import get_all_sensors, create_sensor, etc.
    # or
    from database import sensors, machines, tests
"""

# Re-export everything from the database package for backward compatibility
from database import *

# Legacy connection management - now handled by the database package
import asyncpg

async def connect_to_db(database_url: str):
    """Legacy connection function - creates pool and sets it for all modules"""
    pool = await asyncpg.create_pool(database_url, min_size=5, max_size=20)
    set_db_pool(pool)
    return pool

async def close_db_connection():
    """Legacy close function - closes the shared pool"""
    # Get the pool from database package and close it
    from database import db_pool
    if db_pool:
        await db_pool.close()
