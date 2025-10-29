
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json

# Global variable for database pool - will be set by main database module
_db_pool = None

def set_db_pool(pool):
    """Set the database connection pool."""
    global _db_pool
    _db_pool = pool

def get_db_pool():
    """Get the database connection pool."""
    if _db_pool is None:
        raise RuntimeError("Database pool not initialized. Call set_db_pool() first.")
    return _db_pool


# ================================
# ASYNC TESTS FUNCTIONS (PostgreSQL)
# ================================

async def get_sensor_measurements_avg(test_relation_id: int) -> List[Dict]:
    """Get sensor measurements for a given test relation ID."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT *, bucket AS measurement_timedate
            FROM timeseries.measurements_avg_10s
            WHERE test_relation_id = $1
            ORDER BY measurement_timedate DESC
        """, test_relation_id)
    return [dict(row) for row in rows]


async def insert_measurements(measurements: List[Dict]) -> bool:
    """Insert multiple measurements into the database."""
    if not measurements:
        return False

    query = """
        INSERT INTO timeseries.measurements (time, test_relation_id, channel, direction, value)
        VALUES ($1, $2, $3, $4, $5)
    """
    async with get_db_pool().acquire() as conn:
        async with conn.transaction():
            for m in measurements:
                await conn.execute(query,
                    m['time'],
                    m['test_relation_id'],
                    m['channel'],
                    m['direction'],
                    m['value']
                )
    return True 