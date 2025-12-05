"""
Sensor Types database functions for the Gorenje Washing Machine Monitoring System.

This module contains all sensor type management functions for PostgreSQL.
"""

from datetime import datetime
from typing import Any, List, Dict, Optional

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
            SELECT *
            FROM metadata.sensor_types
            ORDER BY sensor_type_created_at ASC
        """)
    return [dict(row) for row in rows]


async def get_sensor_type_by_id(type_id: int) -> Optional[Dict]:
    """Get sensor type by ID."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow("""
            SELECT *
            FROM metadata.sensor_types
            WHERE id = $1
        """, type_id)
    return dict(row) if row else None


async def create_sensor_type(sensor_type: Dict) -> Optional[Dict]:
    """Create a new sensor type."""
    fields = []
    values = []
    for key, value in sensor_type.items():
        fields.append(key)
        values.append(value)

    if not fields:
        return None
 
    query = f"""
        INSERT INTO metadata.sensor_types (
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
        
        return await get_sensor_type_by_id(new_id)


async def update_sensor_type(type_id: int, type_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update sensor type."""
    fields = []
    values = []

    for key, value in type_data.items():
        fields.append(f"{key} = ${len(values) + 1}")
        values.append(value)

    if not fields:
        return None  # nothing to update

    query = f"""
        UPDATE metadata.sensor_types
        SET {', '.join(fields)}
        WHERE id = ${len(values) + 1}
        RETURNING *;
    """
    values.append(type_id)

    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow(query, *values)
        return dict(row) if row else None



async def delete_sensor_type(type_id: int) -> bool:
    """
    Delete sensor type and mark related sensors as invisible.
    """
    async with get_db_pool().acquire() as conn:
            result = await conn.execute(
                "DELETE FROM metadata.sensor_types WHERE id = $1", type_id
            )

    return result == "DELETE 1"