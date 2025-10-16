"""
Sensor Types database functions for the Gorenje Washing Machine Monitoring System.

This module contains all sensor type management functions for PostgreSQL.
"""

from datetime import datetime
from typing import List, Dict, Optional

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