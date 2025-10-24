
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


async def get_test_relations(test_id: int) -> List[Dict]:
    """Get all test relations for a given test ID."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                tr.*, 
                s.sensor_name, 
                st.sensor_type_name AS sensor_type,   -- join sensor_types to get type name
                tr.sensor_location
            FROM metadata.test_relations tr
            JOIN metadata.sensors s ON tr.sensor_id = s.id
            JOIN metadata.sensor_types st ON s.sensor_type_id = st.id
            WHERE tr.test_id = $1
            ORDER BY tr.id;
        """, test_id)
    return [dict(row) for row in rows]

async def add_test_relation(test_id: int, relation_data: Dict) -> Optional[Dict]:
    """Add a new test relation."""
    fields = []
    values = []
    for key, value in relation_data.items():
        fields.append(key)
        values.append(value)

    if not fields:
        return None
    query = f"""
        INSERT INTO metadata.test_relations (
            {', '.join(fields)}
        )
        VALUES (
            {', '.join(['$' + str(i + 1) for i in range(len(fields))])}
        )
        RETURNING id;
    """
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow(query, *values)
        if not row:
            return None
        return await get_test_relation_by_id(row["id"])

async def delete_test_relation_for_single_relation_id(relation_id: int) -> bool:
    """Delete a test relation by ID."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM metadata.test_relations WHERE id = $1;",
            relation_id
        )
    return result.endswith("DELETE 1")

async def delete_all_test_relations_for_single_test(test_id: int) -> bool:
    """Delete all test relations for a given test ID."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM metadata.test_relations WHERE test_id = $1;",
            test_id
        )
    return result.startswith("DELETE")


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
    allowed_fields = {"test_id", "sensor_id", "sensor_location"}
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