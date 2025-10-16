
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

async def create_machine(machine_data: Dict) -> bool:
    """Create a new machine."""

    query = """
        INSERT INTO metadata.machines (
            machine_name, machine_description, machine_type_id, machine_created_at
        )
        VALUES (
            $1, $2, $3, $4
        );
    """
    async with get_db_pool().acquire() as conn:
        new_machine = await conn.execute(query, 
        machine_data['machine_name'], 
        machine_data['machine_description'], 
        machine_data['machine_type_id'], 
        datetime.now()
        )
    return new_machine == "INSERT 0 1"

async def update_machine(machine_id: int, machine_data: Dict) -> Optional[Dict]:
    """Update machine."""
    fields = []
    values = []
    if 'machine_name' in machine_data:
        fields.append("machine_name = $1")
        values.append(machine_data['machine_name'])
    if 'machine_description' in machine_data:
        fields.append("machine_description = $2")
        values.append(machine_data['machine_description'])
    if 'machine_type_id' in machine_data:
        fields.append("machine_type_id = $3")
        values.append(machine_data['machine_type_id'])
        
    if not fields:
        return None

    query = f"""
        UPDATE metadata.machines
        SET {', '.join(fields)}
        WHERE id = $6
    """
    values.append(machine_id)

    async with get_db_pool().acquire() as conn:
        await conn.execute(query, *values)
    return machine_data

async def delete_machine(machine_id: int) -> bool:
    """Delete machine by ID."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM metadata.machines WHERE id = $1;",
            machine_id
        )
    return result == "DELETE 1"



