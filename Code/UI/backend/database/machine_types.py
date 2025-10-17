"""
Machine Types database functions for the Gorenje Washing Machine Monitoring System.

This module contains all machine type management functions for PostgreSQL.
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
# ASYNC MACHINE TYPES (PostgreSQL)
# ================================

async def get_all_machine_types() -> List[Dict]:
    """Get all machine types."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT *
            FROM metadata.machine_types
            ORDER BY machine_type_created_at DESC
        """)
    return [dict(row) for row in rows]


async def get_machine_type_by_id(type_id: int) -> Optional[Dict]:
    """Get machine type by ID."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow("""
            SELECT *
            FROM metadata.machine_types
            WHERE id = $1
        """, type_id)
    return dict(row) if row else None


async def create_machine_type(type_data: Dict) -> Dict:
    """Create a new machine type."""
    fields = []
    values = []
    for key, value in type_data.items():
        fields.append(key)
        values.append(value)

    if not fields:
        return None
 
    query = f"""
        INSERT INTO metadata.machine_types (
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
        
        return await get_machine_type_by_id(new_id)


async def update_machine_type(type_id: int, type_data: Dict) -> Optional[Dict]:
    """Update machine type."""
    fields = []
    values = []
    
    for key, value in type_data.items():
        fields.append(f"{key} = ${len(values) + 1}")
        values.append(value)
        
    if not fields:
        return None  # nothing to update
    
    query = f"""
        UPDATE metadata.machine_types
        SET {', '.join(fields)}
        WHERE id = ${len(values) + 1}
        RETURNING *;
    """
    values.append(type_id)
    
    async with get_db_pool().acquire() as conn:
        return await conn.fetchrow(query, *values)


async def delete_machine_type(type_id: int) -> bool:
    """Delete machine type by ID."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM metadata.machine_types WHERE id = $1;",
            type_id
        )
    return result == "DELETE 1"