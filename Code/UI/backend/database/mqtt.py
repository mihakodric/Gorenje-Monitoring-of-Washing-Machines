
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

async def get_mqtt_config() -> Optional[Dict]:
    async with get_db_pool().acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM metadata.mqtt_configs LIMIT 1;")
    return dict(row) if row else None

async def create_mqtt_config(config: Dict) -> Optional[Dict]:
    async with get_db_pool().acquire() as conn:
        fields = []
        values = []
        for key, value in config.items():
            fields.append(key)
            values.append(value)
        if not fields:
            return False
        query = f"""
            INSERT INTO metadata.mqtt_configs (
                {', '.join(fields)}
            )
            VALUES (
                {', '.join(['$' + str(i + 1) for i in range(len(fields))])}
            )
        """
        await conn.execute(query, *values)
        return get_mqtt_config()
    

async def update_mqtt_config(config: Dict) -> Optional[Dict]:
    async with get_db_pool().acquire() as conn:
        
        field_names = []
        values = []
        for key, value in config.items():
            field_names.append(key)
            values.append(value)
        
        if not field_names:
            return False
            
        # first delete existing config
        await conn.execute("DELETE FROM metadata.mqtt_configs;")
        
        # Insert new config
        query = f"""
            INSERT INTO metadata.mqtt_configs (
                {', '.join(field_names)}
            )
            VALUES (
                {', '.join(['$' + str(i + 1) for i in range(len(field_names))])}
            )
        """
        await conn.execute(query, *values)
        
        return get_mqtt_config()
    
async def set_active() -> bool:
    async with get_db_pool().acquire() as conn:
        await conn.execute("UPDATE metadata.mqtt_configs SET mqtt_is_active = TRUE;")
        return True
    
async def set_inactive() -> bool:
    async with get_db_pool().acquire() as conn:
        await conn.execute("UPDATE metadata.mqtt_configs SET mqtt_is_active = FALSE;")
        return True

