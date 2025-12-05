"""
Sensor database functions for the Gorenje Washing Machine Monitoring System.

This module contains all sensor management functions for PostgreSQL.
"""

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
# ASYNC SENSOR FUNCTIONS (PostgreSQL)
# ================================

async def get_all_sensors() -> List[Dict]:
    """
    Fetch all sensors from the database, ordered by creation time descending.
    Converts 'sensor_settings' JSON string to a Python dict if present.
    Includes sensor_is_active flag indicating if sensor is active in any test.
    """
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                sensors.*, 
                st.sensor_type_name, 
                st.sensor_type_description, 
                st.sensor_type_unit,
                COALESCE(
                    (SELECT TRUE 
                     FROM metadata.test_relations tr 
                     WHERE tr.sensor_id = sensors.id AND tr.active = TRUE 
                     LIMIT 1), 
                    FALSE
                ) as sensor_is_active
            FROM metadata.sensors
            LEFT JOIN metadata.sensor_types st ON sensors.sensor_type_id = st.id
            ORDER BY sensor_created_at DESC
        """)

    sensors = []
    for row in rows:
        sensor = dict(row)

        # Deserialize sensor_settings JSON if present
        if sensor.get("sensor_settings"):
            try:
                sensor["sensor_settings"] = json.loads(sensor["sensor_settings"])
            except (json.JSONDecodeError, TypeError):
                sensor["sensor_settings"] = None

        sensors.append(sensor)

    return sensors


async def get_sensor_by_id(sensor_id: int) -> Optional[Dict]:
    """Get sensor by ID with sensor_is_active flag and sensor type details."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow("""
            SELECT 
                sensors.*,
                st.sensor_type_name,
                st.sensor_type_description,
                st.sensor_type_unit,
                COALESCE(
                    (SELECT TRUE 
                     FROM metadata.test_relations tr 
                     WHERE tr.sensor_id = sensors.id AND tr.active = TRUE 
                     LIMIT 1), 
                    FALSE
                ) as sensor_is_active
            FROM metadata.sensors sensors
            LEFT JOIN metadata.sensor_types st ON sensors.sensor_type_id = st.id
            WHERE sensors.id = $1;
        """,
            sensor_id
        )
        if not row:
            return None

        sensor = dict(row)
        if sensor.get("sensor_settings"):
            try:
                sensor["sensor_settings"] = json.loads(sensor["sensor_settings"])
            except (json.JSONDecodeError, TypeError):
                sensor["sensor_settings"] = None
        return sensor


async def create_sensor(sensor_data):
    """Create a new sensor."""
    
    fields = []
    values = []
    for key, value in sensor_data.items():
        fields.append(key)
        values.append(value)

    if not fields:
        return None
 
    query = f"""
        INSERT INTO metadata.sensors (
            {', '.join(fields)}
        )
        VALUES (
            {', '.join(['$' + str(i + 1) for i in range(len(fields))])}
        )
        RETURNING id;
    """
    
    async with get_db_pool().acquire() as conn:
        new_id = await conn.fetchval(
            query,
            *values
        )
        if not new_id:
            return None
        
        return await get_sensor_by_id(new_id)


async def update_sensor(sensor_id: int, sensor_data: dict) -> bool:
    """Update an existing sensor."""
    
    fields = []
    values = []

    for key, value in sensor_data.items():
        if key == "sensor_settings":
            fields.append(f"sensor_settings = ${len(values) + 1}")
            values.append(json.dumps(value))
        else:
            fields.append(f"{key} = ${len(values) + 1}")
            values.append(value)

    if not fields:
        return None

    values.append(sensor_id)
    query = f"""
        UPDATE metadata.sensors
        SET {", ".join(fields)}
        WHERE id = ${len(values)}
        RETURNING *;
    """
    async with get_db_pool().acquire() as conn:
        return await conn.fetchrow(query, *values)


async def delete_sensor(sensor_id: int) -> bool:
    """Delete a sensor."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM metadata.sensors WHERE id = $1",
            sensor_id
        )
        return result == 'DELETE 1'


#===============================
# ADDITIONAL SENSOR UTILITIES
#===============================


# get all sensors with specific type id

async def get_sensors_by_sensor_type(sensor_type_id: int) -> List[Dict]:
    """Get all sensors of a specific type."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM metadata.sensors WHERE sensor_type_id = $1",
            sensor_type_id
        )
        return [dict(row) for row in rows]
    

async def get_tests_for_sensor(sensor_id: int):
    """Get test relations for a specific sensor."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch(
            "SELECT test_id FROM metadata.test_relations WHERE sensor_id = $1",
            sensor_id
        )
        if not rows:
            return []

        # get test name and ids
        rows = await conn.fetch(
            "SELECT id, test_name FROM metadata.tests WHERE id IN ($1)",
            *[row["test_id"] for row in rows]
        )
        return [dict(row) for row in rows]


async def mark_sensor_offline(timeout_seconds: int = 60) -> int:
    """
    Mark sensors as offline if they haven't sent data within the timeout period.
    
    Returns:
        Number of sensors marked offline.
    """
    threshold_time = datetime.now() - timedelta(seconds=timeout_seconds)

    async with get_db_pool().acquire() as conn:
        result = await conn.execute("""
            UPDATE metadata.sensors
            SET sensor_is_online = FALSE
            WHERE sensor_last_seen IS NULL OR sensor_last_seen < $1
        """, threshold_time)

    # asyncpg returns results like "UPDATE 3"
    updated_count = int(result.split()[-1])
    return updated_count


async def insert_settings(sensor_id: int, sensor_settings: Dict[str, Any]) -> bool:    
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "INSERT INTO metadata.sensor_settings (sensor_id, sensor_settings) VALUES ($1, $2)",
            sensor_id,
            json.dumps(sensor_settings)
        )
        return result == "INSERT 1"
