
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
    """Get all tests with sensor count."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                t.*,
                COALESCE(tr.sensor_count, 0) as test_sensor_count
            FROM metadata.tests t
            LEFT JOIN (
                SELECT 
                    test_id,
                    COUNT(*) as sensor_count
                FROM metadata.test_relations
                GROUP BY test_id
            ) tr ON t.id = tr.test_id
            ORDER BY t.test_created_at DESC
        """)
    return [dict(row) for row in rows]

async def get_test_by_id(test_id: int) -> Optional[Dict]:
    """Get test by ID with sensor count."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow("""
            SELECT 
                t.*,
                COALESCE(tr.sensor_count, 0) as test_sensor_count
            FROM metadata.tests t
            LEFT JOIN (
                SELECT 
                    test_id,
                    COUNT(*) as sensor_count
                FROM metadata.test_relations
                GROUP BY test_id
            ) tr ON t.id = tr.test_id
            WHERE t.id = $1;
        """, test_id)
    return dict(row) if row else None

async def get_test_with_machine_by_id(test_id: int) -> Optional[Dict]:
    """Get test by ID with machine details."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow("""
            SELECT 
                t.*,
                m.machine_name,
                m.machine_description,
                mt.machine_type_name,
                mt.machine_type_description
            FROM metadata.tests t
            LEFT JOIN metadata.machines m ON t.machine_id = m.id
            LEFT JOIN metadata.machine_types mt ON m.machine_type_id = mt.id
            WHERE t.id = $1;
        """, test_id)
    return dict(row) if row else None

async def create_test(test_data: Dict) -> Optional[Dict]:
    """Create a new test."""
    if not test_data:
        return None

    fields = []
    values = []
    for key, value in test_data.items():
        if value is not None and value != '' and value != 'null':  # Filter out null, empty, and 'null' string values
            # Trim whitespace for string values
            if isinstance(value, str):
                value = value.strip()
            # Skip if value becomes empty after trimming
            if value != '':
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
        # Filter out null, None, and empty string values
        if value is not None and value != '' and value != 'null':
            # Trim whitespace for string values
            if isinstance(value, str):
                value = value.strip()
            # Skip if value becomes empty after trimming
            if value != '':
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