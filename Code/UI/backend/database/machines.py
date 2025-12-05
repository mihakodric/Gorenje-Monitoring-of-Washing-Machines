
"""
Machine database functions for the Gorenje Washing Machine Monitoring System.

This module contains all machine management functions for PostgreSQL.
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
# ASYNC MACHINE FUNCTIONS (PostgreSQL)
# ================================

async def get_all_machines() -> List[Dict]:
    """Get all machines."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT *
            FROM metadata.machines
            ORDER BY machine_created_at DESC
        """)
    return [dict(row) for row in rows]

async def get_machine_by_id(machine_id: int) -> Optional[Dict]:
    """Get machine by ID."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM metadata.machines WHERE id = $1;",
            machine_id
        )
    return dict(row) if row else None

async def create_machine(machine_data: Dict) -> Optional[Dict]:
    """Create a new machine."""

    fields = []
    values = []
    for key, value in machine_data.items():
        fields.append(key)
        values.append(value)

    if not fields:
        return None
 
    query = f"""
        INSERT INTO metadata.machines (
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
        
        return await get_machine_by_id(new_id)

async def update_machine(machine_id: int, machine_data: Dict) -> Optional[Dict]:
    """Update machine."""
    fields = []
    values = []
    for key, value in machine_data.items():
        fields.append(f"{key} = ${len(values) + 1}")
        values.append(value)
        
    if not fields:
        return None

    query = f"""
        UPDATE metadata.machines
        SET {', '.join(fields)}
        WHERE id = ${len(values) + 1}
        RETURNING *;
    """
    values.append(machine_id)

    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow(query, *values)
        return dict(row) if row else None

async def delete_machine(machine_id: int) -> bool:
    """Delete machine by ID."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM metadata.machines WHERE id = $1;",
            machine_id
        )
    return result == "DELETE 1"



#===============================
# ADDITIONAL MACHINE UTILITIES
#===============================

async def get_machines_by_machine_type(machine_type_id: int) -> List[Dict]:
    """Get all machines of a specific type."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM metadata.machines WHERE machine_type_id = $1",
            machine_type_id
        )
        return [dict(row) for row in rows]

async def get_tests_for_machine_id(machine_id: int) -> List[Dict]:
    """Get all tests for a specific machine."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, test_name FROM metadata.tests WHERE machine_id = $1",
            machine_id
        )
        return [dict(row) for row in rows]