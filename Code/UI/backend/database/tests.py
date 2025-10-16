
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

    query = """
        INSERT INTO metadata.tests (
            test_name, test_description, test_notes, test_status, test_created_at, test_last_modified_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6
        );
    """
    async with get_db_pool().acquire() as conn:
        new_test = await conn.execute(query, 
        test_data['test_name'], 
        test_data.get('description', ''), 
        test_data.get('notes', ''), 
        "idle", 
        datetime.timezone.utc(), 
        datetime.timezone.utc()
        )
    return new_test

async def update_test(test_id: int, test_data: Dict) -> Optional[Dict]:
    """Update test."""
    fields = []
    values = []
    for key, value in test_data.items():
        fields.append(f"{key} = ${len(values) + 1}")
        values.append(value)
    values.append(test_id)  # For WHERE clause

    if not fields:
        return await get_test_by_id(test_id)  # Nothing to update

    query = f"""
        UPDATE metadata.tests
        SET {', '.join(fields)}, last_modified_at = ${len(values)}
        WHERE id = ${len(values) + 1}
        RETURNING *;
    """
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow(query, *values, datetime.now(), test_id)
    return dict(row) if row else None

async def delete_test(test_id: int) -> bool:
    """Delete test by ID."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM metadata.tests WHERE id = $1;",
            test_id
        )
    return result.endswith("DELETE 1")

async def get_test_relations(test_id: int) -> List[Dict]:
    """Get all test relations for a given test ID."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT tr.*, m.machine_name, s.sensor_name, s.sensor_type
            FROM metadata.test_relations tr
            JOIN metadata.machines m ON tr.machine_id = m.id
            JOIN metadata.sensors s ON tr.sensor_id = s.id
            WHERE tr.test_id = $1
            ORDER BY tr.id;
        """, test_id)
    return [dict(row) for row in rows]

async def add_test_relation(test_id: int, relation_data: Dict) -> Optional[Dict]:
    """Add a new test relation."""
    query = """
        INSERT INTO metadata.test_relations (
            test_id, machine_id, sensor_id, sensor_location
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    """
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow(
            query,
            test_id,
            relation_data['machine_id'],
            relation_data['sensor_id'],
            relation_data.get('sensor_location', '')
        )
    return dict(row) if row else None

async def delete_test_relation(relation_id: int) -> bool:
    """Delete a test relation by ID."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM metadata.test_relations WHERE id = $1;",
            relation_id
        )
    return result.endswith("DELETE 1")

async def get_test_relation_by_id(relation_id: int) -> Optional[Dict]:
    """Fetch one test relation by ID."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM metadata.test_relations WHERE id = $1;",
            relation_id
        )
    return dict(row) if row else None


async def update_test_relation(relation_id: int, relation_data: Dict) -> Optional[dict]:
    """
    Update fields in a test_relation record.
    Only updates provided keys.
    """
    if not relation_data:
        return await get_test_relation_by_id(relation_id)

    # Validate allowed columns (avoid SQL injection)
    allowed_fields = {"test_id", "machine_id", "sensor_id", "sensor_location"}
    set_clauses = []
    values = []

    for key, value in relation_data.items():
        if key not in allowed_fields:
            continue
        set_clauses.append(f"{key} = ${len(values) + 1}")
        values.append(value)

    if not set_clauses:
        return await get_test_relation_by_id(relation_id)

    query = f"""
        UPDATE metadata.test_relations
        SET {', '.join(set_clauses)}
        WHERE id = ${len(values) + 1}
        RETURNING *;
    """
    values.append(relation_id)

    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow(query, *values)

    return dict(row) if row else None

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

async def is_sensor_or_machine_available(sensor_id: int, machine_id: int) -> bool:
    """Check if sensor and machine are available (not used in running tests)."""
    async with get_db_pool().acquire() as conn:
        # Check if sensor or machine is used in any running test
        result = await conn.fetchval("""
            SELECT COUNT(*)
            FROM metadata.test_relations tr
            JOIN metadata.tests t ON tr.test_id = t.id
            WHERE (tr.sensor_id = $1 OR tr.machine_id = $2) 
            AND t.status = 'running'
        """, sensor_id, machine_id)
    return result == 0

async def update_test_machine(test_id: int, machine_id: int) -> bool:
    """Update machine for all relations in a test."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute("""
            UPDATE metadata.test_relations 
            SET machine_id = $1 
            WHERE test_id = $2
        """, machine_id, test_id)
    return result != "UPDATE 0"