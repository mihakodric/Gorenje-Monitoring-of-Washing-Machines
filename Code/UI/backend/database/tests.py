
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

async def get_all_tests() -> List[Dict]:
    """Get all tests."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT *
            FROM metadata.tests
            ORDER BY test_created_at DESC
        """)
    return [dict(row) for row in rows]

async def get_test_by_id(test_id: int) -> Optional[Dict]:
    """Get test by ID."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM metadata.tests WHERE id = $1;",
            test_id
        )
    return dict(row) if row else None

async def create_test(test_data: Dict) -> bool:
    """Create a new test."""

    fields = []
    values = []
    for key, value in test_data.items():
        fields.append(key)
        values.append(value)

    if not fields:
        return None
 
    query = f"""
        INSERT INTO metadata.tests (
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

        return await get_test_by_id(new_id)

async def update_test_metadata(test_id: int, test_data: Dict) -> Optional[Dict]:
    """Update test."""
    fields = []
    values = []
    for key, value in test_data.items():
        fields.append(f"{key} = ${len(values) + 1}")
        values.append(value)
        
    if not fields:
        return None

    query = f"""
        UPDATE metadata.tests
        SET {', '.join(fields)}
        WHERE id = ${len(values) + 1}
        RETURNING *;
    """
    values.append(test_id)

    async with get_db_pool().acquire() as conn:
        return await conn.fetchrow(query, *values)

async def delete_test(test_id: int) -> bool:
    """Delete test by ID."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM metadata.tests WHERE id = $1;",
            test_id
        )
    return result.endswith("DELETE 1")


# ================================
# ASYNC TEST RELATIONS FUNCTIONS (PostgreSQL)
# ================================


# Additional test functions
async def start_test(test_id: int) -> bool:
    """Start a test by setting status to 'running'."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute("""
            UPDATE metadata.tests 
            SET status = 'running', last_modified_at = $1 
            WHERE id = $2 AND status = 'idle'
        """, datetime.now(), test_id)
    return result.endswith("UPDATE 1")

async def stop_test(test_id: int) -> bool:
    """Stop a test by setting status to 'completed'.""" 
    async with get_db_pool().acquire() as conn:
        result = await conn.execute("""
            UPDATE metadata.tests 
            SET status = 'completed', last_modified_at = $1 
            WHERE id = $2 AND status = 'running'
        """, datetime.now(), test_id)
    return result.endswith("UPDATE 1")

async def update_test_machine(test_id: int, machine_id: int) -> bool:
    """Update machine for all relations in a test."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute("""
            UPDATE metadata.test_relations 
            SET machine_id = $1 
            WHERE test_id = $2
        """, machine_id, test_id)
    return result != "UPDATE 0"