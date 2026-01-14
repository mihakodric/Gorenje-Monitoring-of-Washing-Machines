
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
                s.sensor_type_id,
                s.sensor_mqtt_topic,
                s.sensor_is_online, 
                s.sensor_created_at, 
                s.sensor_last_seen, 
                st.sensor_type_name, 
                st.sensor_type_description, 
                st.sensor_type_unit,
                tr.sensor_location
            FROM metadata.test_relations tr
            JOIN metadata.sensors s ON tr.sensor_id = s.id
            JOIN metadata.sensor_types st ON s.sensor_type_id = st.id
            WHERE tr.test_id = $1
            ORDER BY tr.id;
        """, test_id)
    return [dict(row) for row in rows]

async def add_test_relation(test_id: int, relation_data: Dict) -> Optional[Dict]:
    """
    Safely add a new test relation.
    Only allowed fields are inserted.
    """

    ALLOWED_FIELDS = {"sensor_id", "sensor_location", "active"}

    fields = []
    values = []

    # Always force test_id from argument (never trust payload)
    fields.append("test_id")
    values.append(test_id)

    for key in ALLOWED_FIELDS:
        if key in relation_data:
            fields.append(key)
            values.append(relation_data[key])

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
        try:
            row = await conn.fetchrow(query, *values)
        except Exception as e:
            print("DB INSERT FAILED:", e)
            return None

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


async def check_test_relation_has_measurements(relation_id: int) -> Dict[str, Any]:
    """
    Check if a test_relation has any measurements.
    Returns count of measurements.
    """
    async with get_db_pool().acquire() as conn:
        count = await conn.fetchval(
            "SELECT COUNT(*) FROM timeseries.measurements WHERE test_relation_id = $1;",
            relation_id
        )
    return {
        "test_relation_id": relation_id,
        "has_measurements": count > 0,
        "measurement_count": count
    }


async def delete_test_relation_with_measurements(relation_id: int) -> bool:
    """
    Delete a test_relation and all its measurements.
    Returns True if successful.
    """
    async with get_db_pool().acquire() as conn:
        async with conn.transaction():
            # Delete all measurements for this test_relation
            await conn.execute(
                "DELETE FROM timeseries.measurements WHERE test_relation_id = $1;",
                relation_id
            )
            
            # Delete the test_relation itself
            result = await conn.execute(
                "DELETE FROM metadata.test_relations WHERE id = $1;",
                relation_id
            )
            
            return result.endswith("DELETE 1")