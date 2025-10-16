"""
Sensor-related database functions for the Gorenje Washing Machine Monitoring System.

This module contains all sensor and sensor type management functions,
including both PostgreSQL async functions and legacy SQLite functions.
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
    """
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT *
            FROM metadata.sensors
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
    """Get sensor by ID."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM metadata.sensors WHERE id = $1;",
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


async def create_sensor(sensor_data):
    """Create a new sensor."""
    query = """
        INSERT INTO metadata.sensors (
            sensor_type_id, sensor_mqtt_topic, sensor_name, sensor_description
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (sensor_mqtt_topic) DO NOTHING
        RETURNING id;
    """
    
    async with get_db_pool().acquire() as conn:
        new_id = await conn.fetchval(
            query,
            sensor_data['sensor_type_id'],
            sensor_data['sensor_mqtt_topic'],
            sensor_data['sensor_name'],
            sensor_data.get('sensor_description', '')
        )
        if new_id:
            return await get_sensor_by_id(new_id)
        return None


async def update_sensor(sensor_id: int, sensor_data: dict) -> bool:
    """Update an existing sensor."""
    async with get_db_pool().acquire() as conn:
        fields = []
        values = []

        for key in ["sensor_type_id", "sensor_mqtt_topic", "sensor_name", "sensor_description"]:
            if key in sensor_data:
                fields.append(f"{key} = ${len(values) + 1}")
                values.append(sensor_data[key])

        if not fields:
            return False  # nothing to update

        # Add WHERE id = $n
        values.append(sensor_id)
        query = f"""
            UPDATE metadata.sensors
            SET {", ".join(fields)}
            WHERE id = ${len(values)}
        """

        result = await conn.execute(query, *values)
        return result == 'UPDATE 1'


async def update_sensor_settings(sensor_id: int, new_settings: dict) -> bool:
    """Update sensor sensor_settings."""
    async with get_db_pool().acquire() as conn:
        # Get current sensor_settings
        row = await conn.fetchrow("SELECT sensor_settings FROM metadata.sensors WHERE id = $1", sensor_id)
        if not row:
            return False

        current_settings = row['sensor_settings'] if row['sensor_settings'] else {}
        
        # Merge new sensor_settings into current sensor_settings
        if isinstance(current_settings, str):
            current_settings = json.loads(current_settings)
        current_settings.update(new_settings)

        # Save merged sensor_settings back
        result = await conn.execute(
            "UPDATE metadata.sensors SET sensor_settings = $1 WHERE id = $2",
            json.dumps(current_settings),
            sensor_id
        )
        return result == 'UPDATE 1'


async def delete_sensor(sensor_id: int) -> bool:
    """Delete a sensor."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM metadata.sensors WHERE id = $1",
            sensor_id
        )
        return result == 'DELETE 1'


async def get_test_relations_for_sensor(sensor_id: int):
    """Get test relations for a specific sensor."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM metadata.test_relations WHERE sensor_id = $1",
            sensor_id
        )
        return [dict(row) for row in rows]


# ================================
# ASYNC SENSOR TYPE FUNCTIONS (PostgreSQL)
# ================================

async def get_all_sensor_types() -> List[Dict]:
    """Get all sensor types."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, sensor_type_name, sensor_type_unit, sensor_type_description, sensor_type_created_at
            FROM metadata.sensor_types
            ORDER BY sensor_type_created_at DESC
        """)
    return [dict(row) for row in rows]


async def get_sensor_type_by_id(type_id: int) -> Optional[Dict]:
    """Get sensor type by ID."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id, sensor_type_name, sensor_type_unit, sensor_type_description, sensor_type_created_at
            FROM metadata.sensor_types
            WHERE id = $1
        """, type_id)
    return dict(row) if row else None


async def create_sensor_type(sensor_type: Dict) -> Optional[Dict]:
    """Create a new sensor type."""
    query = """
        INSERT INTO metadata.sensor_types (
            sensor_type_name, sensor_type_unit, sensor_type_description, sensor_type_created_at
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id;
    """
    async with get_db_pool().acquire() as conn:
        new_id = await conn.fetchval(
            query,
            sensor_type["sensor_type_name"],
            sensor_type.get("sensor_type_unit", ""),
            sensor_type.get("sensor_type_description", ""),
            datetime.now(),
        )
    return await get_sensor_type_by_id(new_id)


async def update_sensor_type(type_id: int, type_data: Dict) -> Optional[Dict]:
    """Update sensor type."""
    fields = []
    values = []

    for key in ["sensor_type_name", "sensor_type_unit", "sensor_type_description"]:
        if key in type_data:
            fields.append(f"{key} = ${len(values) + 1}")
            values.append(type_data[key])

    if not fields:
        return None  # nothing to update

    # Add WHERE id = $n
    values.append(type_id)
    query = f"""
        UPDATE metadata.sensor_types
        SET {", ".join(fields)}
        WHERE id = ${len(values)}
    """

    async with get_db_pool().acquire() as conn:
        await conn.execute(query, *values)

    return await get_sensor_type_by_id(type_id)


async def delete_sensor_type(type_id: int) -> bool:
    """
    Delete sensor type and mark related sensors as invisible.
    """
    async with get_db_pool().acquire() as conn:
        async with conn.transaction():
            # Delete the sensor type
            result = await conn.execute(
                "DELETE FROM metadata.sensor_types WHERE id = $1", type_id
            )

    return result == "DELETE 1"

async def insert_settings(sensor_id: int, sensor_settings: Dict[str, Any]) -> bool:    
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "INSERT INTO metadata.sensor_settings (sensor_id, sensor_settings) VALUES ($1, $2)",
            sensor_id,
            json.dumps(sensor_settings)
        )
        return result == "INSERT 1"
