
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
    """Get sensor measurements for a given test relation ID, grouped by channel."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                bucket AS measurement_timestamp,
                test_relation_id,
                measurement_channel,
                avg_value,
                min_value,
                max_value,
                avg_abs_value,
                min_abs_value,
                max_abs_value,
                num_samples
            FROM timeseries.measurements_avg_10s
            WHERE test_relation_id = $1
            ORDER BY bucket ASC, measurement_channel
        """, test_relation_id)
    return [dict(row) for row in rows]


async def insert_measurements(measurements: List[Dict]) -> bool:
    """Insert multiple measurements into the database efficiently."""
    if not measurements:
        return False

    query = """
        INSERT INTO timeseries.measurements (
            measurement_timestamp, test_relation_id, measurement_channel, measurement_value
        ) VALUES ($1, $2, $3, $4)
    """

    data = [
        (
            m["measurement_timestamp"],
            m["test_relation_id"],
            m["measurement_channel"],
            m["measurement_value"],
        )
        for m in measurements
    ]

    async with get_db_pool().acquire() as conn:
        async with conn.transaction():
            await conn.executemany(query, data)

    return True
