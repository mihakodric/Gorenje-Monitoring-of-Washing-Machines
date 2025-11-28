
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
    """Get all tests with sensor count and machine information."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                t.*,
                COALESCE(tr.sensor_count, 0) AS test_sensor_count,
                m.machine_name,
                m.machine_description,
                mt.machine_type_name,
                mt.machine_type_description
            FROM metadata.tests AS t
            LEFT JOIN (
                SELECT 
                    test_id,
                    COUNT(*) AS sensor_count
                FROM metadata.test_relations
                GROUP BY test_id
            ) AS tr ON t.id = tr.test_id
            LEFT JOIN metadata.machines AS m ON t.machine_id = m.id
            LEFT JOIN metadata.machine_types AS mt ON m.machine_type_id = mt.id
            ORDER BY t.test_created_at DESC;
        """)
    return [dict(row) for row in rows]

async def get_test_by_id(test_id: int) -> Optional[Dict]:
    """Get test by ID with sensor count."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow("""
            SELECT 
                t.*,
                COALESCE(tr.sensor_count, 0) AS test_sensor_count,
                m.machine_name,
                m.machine_description,
                mt.machine_type_name,
                mt.machine_type_description
            FROM metadata.tests AS t
            LEFT JOIN (
                SELECT 
                    test_id,
                    COUNT(*) AS sensor_count
                FROM metadata.test_relations
                GROUP BY test_id
            ) AS tr ON t.id = tr.test_id
            LEFT JOIN metadata.machines AS m ON t.machine_id = m.id
            LEFT JOIN metadata.machine_types AS mt ON m.machine_type_id = mt.id
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
    # Fields that can be empty (allow clearing)
    clearable_fields = {'test_notes', 'test_description'}
    
    for key, value in test_data.items():
        # Allow clearable fields to be empty strings
        if key in clearable_fields:
            if value is not None and value != 'null':
                # Trim whitespace for string values
                if isinstance(value, str):
                    value = value.strip()
                fields.append(f"{key} = ${len(values) + 1}")
                values.append(value)
        else:
            # Filter out null, None, and empty string values for other fields
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
    """
    Delete test by ID only if it's in idle status.
    Deletes all related data: test_relations, test_runs, and measurements.
    """
    async with get_db_pool().acquire() as conn:
        async with conn.transaction():
            # Check if test exists and is idle
            test = await conn.fetchrow(
                "SELECT test_status FROM metadata.tests WHERE id = $1;",
                test_id
            )
            
            if not test:
                return False
            
            if test['test_status'] != 'idle':
                raise ValueError(f"Cannot delete test: test status is '{test['test_status']}', must be 'idle'")
            
            # Get all test_relation_ids for this test
            relation_ids = await conn.fetch(
                "SELECT id FROM metadata.test_relations WHERE test_id = $1;",
                test_id
            )
            
            # Delete measurements for all test relations
            if relation_ids:
                relation_id_list = [row['id'] for row in relation_ids]
                await conn.execute(
                    "DELETE FROM timeseries.measurements WHERE test_relation_id = ANY($1::int[]);",
                    relation_id_list
                )
            
            # Delete test relations
            await conn.execute(
                "DELETE FROM metadata.test_relations WHERE test_id = $1;",
                test_id
            )
            
            # Delete test runs
            await conn.execute(
                "DELETE FROM metadata.test_runs WHERE test_id = $1;",
                test_id
            )
            
            # Finally delete the test itself
            result = await conn.execute(
                "DELETE FROM metadata.tests WHERE id = $1;",
                test_id
            )
            
            return result.endswith("DELETE 1")


# ================================
# ASYNC TEST RELATIONS FUNCTIONS (PostgreSQL)
# ================================


# Additional test functions
async def start_test(test_id: int) -> Optional[int]:
    """
    Atomically:
    1. Mark test as running (only if idle)
    2. Create a new test run
    Returns run_id on success, None on failure.
    """

    # 1️⃣ Attempt to transition test state
    async with get_db_pool().acquire() as conn:
        result = await conn.execute("""
            UPDATE metadata.tests 
            SET test_status = 'running', test_last_modified_at = $1 
            WHERE id = $2 AND test_status = 'idle'
        """, datetime.now(), test_id)

        if not result.endswith("UPDATE 1"):
            return None  # Not idle, already running or completed

        # 2️⃣ Create run only if state transition succeeded
        row = await conn.fetchrow("""
            INSERT INTO metadata.test_runs (test_id)
            VALUES ($1)
            RETURNING id;
        """, test_id)
        # mark all sensors as active in this test in test test_relations table also assigned_at
        await conn.execute("""
            UPDATE metadata.test_relations
            SET active = TRUE,
                assigned_at = NOW()
            WHERE test_id = $1;
        """, test_id)

        return row["id"]


async def stop_test(test_id: int) -> Optional[int]:
    """
    Atomically:
    1. Mark test as completed (only if running)
    2. Close active test run (set run_ended_at)
    Returns closed run_id on success, None on failure.
    """

    async with get_db_pool().acquire() as conn:
        async with conn.transaction():

            # 1️⃣ Transition test state
            result = await conn.execute("""
                UPDATE metadata.tests 
                SET test_status = 'idle',
                    test_last_modified_at = $1
                WHERE id = $2 AND test_status = 'running'
            """, datetime.now(), test_id)

            if not result.endswith("UPDATE 1"):
                return None  # Not running → cannot stop

            # 2️⃣ Close active run
            row = await conn.fetchrow("""
                UPDATE metadata.test_runs
                SET run_ended_at = NOW()
                WHERE id = (
                    SELECT id
                    FROM metadata.test_runs
                    WHERE test_id = $1 AND run_ended_at IS NULL
                    ORDER BY run_started_at DESC
                    LIMIT 1
                )
                RETURNING id;
            """, test_id)

            if not row:
                return None  # Should never happen, but still protected
            
            # mark all sensors as inactive in this test in test test_relations table and unassigned_at
            await conn.execute("""
                UPDATE metadata.test_relations
                SET active = FALSE,
                    unassigned_at = NOW()
                WHERE test_id = $1;
            """, test_id)

            return row["id"]
