"""
Database operations for test segments.
"""

from typing import List, Optional
from datetime import datetime
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


async def create_segment(test_id: int, segment_name: str, start_time: datetime, end_time: datetime) -> dict:
    """Create a new test segment."""
    async with get_db_pool().acquire() as conn:
        query = """
            INSERT INTO metadata.test_segments (test_id, segment_name, start_time, end_time, created_at, last_modified_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id, test_id, segment_name, start_time, end_time, created_at, last_modified_at
        """
        result = await conn.fetchrow(query, test_id, segment_name, start_time, end_time)
        return dict(result)


async def get_segments_by_test_id(test_id: int) -> List[dict]:
    """Get all segments for a specific test."""
    async with get_db_pool().acquire() as conn:
        query = """
            SELECT id, test_id, segment_name, start_time, end_time, created_at, last_modified_at
            FROM metadata.test_segments
            WHERE test_id = $1
            ORDER BY start_time ASC
        """
        results = await conn.fetch(query, test_id)
        return [dict(row) for row in results]


async def get_segment_by_id(segment_id: int) -> Optional[dict]:
    """Get a specific segment by ID."""
    async with get_db_pool().acquire() as conn:
        query = """
            SELECT id, test_id, segment_name, start_time, end_time, created_at, last_modified_at
            FROM metadata.test_segments
            WHERE id = $1
        """
        result = await conn.fetchrow(query, segment_id)
        return dict(result) if result else None


async def update_segment(segment_id: int, segment_name: Optional[str] = None, 
                        start_time: Optional[datetime] = None, end_time: Optional[datetime] = None) -> dict:
    """Update a test segment."""
    async with get_db_pool().acquire() as conn:
        # Build dynamic update query
        updates = []
        params = []
        param_count = 1
        
        if segment_name is not None:
            updates.append(f"segment_name = ${param_count}")
            params.append(segment_name)
            param_count += 1
        
        if start_time is not None:
            updates.append(f"start_time = ${param_count}")
            params.append(start_time)
            param_count += 1
        
        if end_time is not None:
            updates.append(f"end_time = ${param_count}")
            params.append(end_time)
            param_count += 1
        
        updates.append(f"last_modified_at = NOW()")
        params.append(segment_id)
        
        query = f"""
            UPDATE metadata.test_segments
            SET {', '.join(updates)}
            WHERE id = ${param_count}
            RETURNING id, test_id, segment_name, start_time, end_time, created_at, last_modified_at
        """
        
        result = await conn.fetchrow(query, *params)
        return dict(result)


async def delete_segment(segment_id: int) -> bool:
    """Delete a test segment."""
    async with get_db_pool().acquire() as conn:
        query = "DELETE FROM metadata.test_segments WHERE id = $1"
        result = await conn.execute(query, segment_id)
        return result == "DELETE 1"
