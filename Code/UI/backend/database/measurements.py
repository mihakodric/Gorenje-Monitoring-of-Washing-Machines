
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

async def get_sensor_measurements_raw(
    test_relation_id: int,
    limit: int = 10_000,
    last_minutes: Optional[int] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> List[Dict]:
    """
    Fetch raw sensor measurements with flexible time filtering.

    Priority:
    1) If start_time or end_time is provided -> use explicit time range
    2) Else if last_minutes is provided -> fetch relative to latest timestamp
    3) Else -> fetch all available data (still capped per channel by limit)

    Always applies a per-channel row limit.
    """

    # ---------- Validate conflicting inputs ----------
    if last_minutes is not None and (start_time or end_time):
        raise ValueError(
            "Use either last_minutes OR start/end time filtering, not both."
        )

    # ---------- Build dynamic WHERE conditions ----------
    time_filter_sql = ""
    params = [test_relation_id, limit]

    if start_time or end_time:
        if start_time:
            params.append(start_time)
            time_filter_sql += f" AND m.measurement_timestamp >= ${len(params)}"
        if end_time:
            params.append(end_time)
            time_filter_sql += f" AND m.measurement_timestamp <= ${len(params)}"

        base_cte = """
            latest_measurements AS (
                SELECT 
                    m.measurement_timestamp,
                    m.test_relation_id,
                    m.measurement_channel,
                    m.measurement_value,
                    ROW_NUMBER() OVER (
                        PARTITION BY m.measurement_channel 
                        ORDER BY m.measurement_timestamp DESC
                    ) as rn
                FROM timeseries.measurements m
                WHERE m.test_relation_id = $1
        """

    elif last_minutes is not None:
        params.append(last_minutes)

        base_cte = """
            max_timestamp AS (
                SELECT MAX(measurement_timestamp) as latest_time
                FROM timeseries.measurements
                WHERE test_relation_id = $1
            ),
            latest_measurements AS (
                SELECT 
                    m.measurement_timestamp,
                    m.test_relation_id,
                    m.measurement_channel,
                    m.measurement_value,
                    ROW_NUMBER() OVER (
                        PARTITION BY m.measurement_channel 
                        ORDER BY m.measurement_timestamp DESC
                    ) as rn
                FROM timeseries.measurements m
                CROSS JOIN max_timestamp mt
                WHERE m.test_relation_id = $1
                  AND m.measurement_timestamp >= mt.latest_time - ($3 || ' minutes')::interval
        """

    else:
        # No time constraints at all
        base_cte = """
            latest_measurements AS (
                SELECT 
                    m.measurement_timestamp,
                    m.test_relation_id,
                    m.measurement_channel,
                    m.measurement_value,
                    ROW_NUMBER() OVER (
                        PARTITION BY m.measurement_channel 
                        ORDER BY m.measurement_timestamp DESC
                    ) as rn
                FROM timeseries.measurements m
                WHERE m.test_relation_id = $1
        """

    final_query = f"""
        WITH {base_cte}
        {time_filter_sql}
        )
        SELECT 
            measurement_timestamp,
            test_relation_id,
            measurement_channel,
            measurement_value
        FROM latest_measurements
        WHERE rn <= $2
        ORDER BY measurement_timestamp ASC, measurement_channel
    """

    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch(final_query, *params)

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
