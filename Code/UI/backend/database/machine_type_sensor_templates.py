"""
Machine Type Sensor Templates database functions for the Gorenje Washing Machine Monitoring System.

This module contains all machine type sensor template management functions for PostgreSQL.
"""

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
# ASYNC MACHINE TYPE SENSOR TEMPLATES (PostgreSQL)
# ================================

async def get_templates_by_machine_type(machine_type_id: int) -> List[Dict]:
    """Get all sensor templates for a specific machine type with sensor type details."""
    async with get_db_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                t.*,
                st.sensor_type_name,
                st.sensor_type_unit
            FROM metadata.machine_type_sensor_templates t
            JOIN metadata.sensor_types st ON t.sensor_type_id = st.id
            WHERE t.machine_type_id = $1
            ORDER BY t.display_order, t.id
        """, machine_type_id)
    return [dict(row) for row in rows]


async def get_template_by_id(template_id: int) -> Optional[Dict]:
    """Get a specific sensor template by ID."""
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow("""
            SELECT 
                t.*,
                st.sensor_type_name,
                st.sensor_type_unit
            FROM metadata.machine_type_sensor_templates t
            JOIN metadata.sensor_types st ON t.sensor_type_id = st.id
            WHERE t.id = $1
        """, template_id)
    return dict(row) if row else None


async def create_template(template_data: Dict) -> Dict:
    """Create a new sensor template."""
    fields = []
    values = []
    for key, value in template_data.items():
        fields.append(key)
        values.append(value)

    if not fields:
        return None
 
    query = f"""
        INSERT INTO metadata.machine_type_sensor_templates (
            {', '.join(fields)}
        )
        VALUES (
            {', '.join(['$' + str(i + 1) for i in range(len(fields))])}
        )
        RETURNING id;
    """
    
    async with get_db_pool().acquire() as conn:
        new_id = await conn.fetchval(query, *values)
        if not new_id:
            return None
        
        return await get_template_by_id(new_id)


async def update_template(template_id: int, update_data: Dict) -> Optional[Dict]:
    """Update an existing sensor template."""
    if not update_data:
        return await get_template_by_id(template_id)

    fields = []
    values = []
    for i, (key, value) in enumerate(update_data.items(), start=1):
        fields.append(f"{key} = ${i}")
        values.append(value)

    query = f"""
        UPDATE metadata.machine_type_sensor_templates
        SET {', '.join(fields)}
        WHERE id = ${len(values) + 1}
        RETURNING id;
    """
    
    values.append(template_id)
    
    async with get_db_pool().acquire() as conn:
        updated_id = await conn.fetchval(query, *values)
        if not updated_id:
            return None
        
        return await get_template_by_id(updated_id)


async def delete_template(template_id: int) -> bool:
    """Delete a sensor template."""
    async with get_db_pool().acquire() as conn:
        result = await conn.execute("""
            DELETE FROM metadata.machine_type_sensor_templates
            WHERE id = $1
        """, template_id)
    return result == "DELETE 1"


async def delete_templates_by_machine_type(machine_type_id: int) -> bool:
    """Delete all sensor templates for a machine type."""
    async with get_db_pool().acquire() as conn:
        await conn.execute("""
            DELETE FROM metadata.machine_type_sensor_templates
            WHERE machine_type_id = $1
        """, machine_type_id)
    return True


async def bulk_update_template_orders(updates: List[Dict]) -> bool:
    """
    Bulk update display orders for multiple templates.
    updates should be a list of dicts with 'id' and 'display_order' keys.
    """
    async with get_db_pool().acquire() as conn:
        async with conn.transaction():
            for update in updates:
                await conn.execute("""
                    UPDATE metadata.machine_type_sensor_templates
                    SET display_order = $1
                    WHERE id = $2
                """, update['display_order'], update['id'])
    return True
