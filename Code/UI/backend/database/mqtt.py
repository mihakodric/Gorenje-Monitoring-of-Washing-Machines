
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
# ASYNC MQTT FUNCTIONS (PostgreSQL) 
# ================================

async def get_mqtt_config() -> Optional[Dict]:
    async with get_db_pool().acquire() as conn:
        result = await conn.fetchrow("SELECT * FROM mqtt_configs LIMIT 1")
        return dict(result) if result else None
    
async def create_mqtt_config(config: Dict) -> bool:
    async with get_db_pool().acquire() as conn:
        await conn.execute('''
            INSERT INTO mqtt_configs (broker_host, broker_port, username, password, is_active)
            VALUES ($1, $2, $3, $4, $5)
        ''', (
            config['broker_host'],
            config.get('broker_port', 1883),
            config.get('username', ''),
            config.get('password', ''),
            config.get('is_active', True)
        ))
        return True
async def update_mqtt_config(config: Dict) -> bool:
    async with get_db_pool().acquire() as conn:
        await conn.execute('''
            UPDATE mqtt_configs
            SET broker_host = $1,
                broker_port = $2,
                username = $3,
                password = $4,
                is_active = $5
            WHERE id = $6
        ''', (
            config['broker_host'],
            config.get('broker_port', 1883),
            config.get('username', ''),
            config.get('password', ''),
            config.get('is_active', True),
            config['id']
        ))
        return True
    
async def sync_mqtt_active_state(mqtt_running: bool) -> bool:
    """Ensure only one active MQTT config exists."""
    async with get_db_pool().acquire() as conn:
        if mqtt_running:
            await conn.execute('''
                UPDATE mqtt_configs
                SET is_active = TRUE
                WHERE is_active = FALSE
                LIMIT 1
            ''')
        else:
            await conn.execute('''
                UPDATE mqtt_configs
                SET is_active = FALSE
                WHERE is_active = TRUE
                LIMIT 1
            ''')
        return True