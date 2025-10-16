"""
Database connection management for Gorenje Washing Machine Monitoring System.

This module provides utilities for managing the PostgreSQL connection pool
and database connection lifecycle.
"""

import asyncpg
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class DatabaseConnection:
    """Database connection manager with connection pool."""
    
    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None
        self._is_connected = False
    
    async def connect(self, database_url: str, **pool_kwargs) -> asyncpg.Pool:
        """
        Create and return a connection pool.
        
        Args:
            database_url: PostgreSQL connection string
            **pool_kwargs: Additional arguments for asyncpg.create_pool()
        
        Returns:
            asyncpg.Pool: The connection pool
        """
        try:
            # Set default pool parameters for optimal performance
            pool_defaults = {
                'min_size': 5,
                'max_size': 20,
                'max_queries': 50000,
                'max_inactive_connection_lifetime': 300.0,
                'command_timeout': 60,
            }
            pool_defaults.update(pool_kwargs)
            
            self._pool = await asyncpg.create_pool(database_url, **pool_defaults)
            self._is_connected = True
            
            logger.info(f"Database connection pool created successfully with {pool_defaults['min_size']}-{pool_defaults['max_size']} connections")
            return self._pool
            
        except Exception as e:
            logger.error(f"Failed to create database connection pool: {e}")
            raise
    
    async def disconnect(self):
        """Close the connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            self._is_connected = False
            logger.info("Database connection pool closed")
    
    def get_pool(self) -> asyncpg.Pool:
        """
        Get the current connection pool.
        
        Returns:
            asyncpg.Pool: The connection pool
            
        Raises:
            RuntimeError: If no connection pool is available
        """
        if not self._pool or not self._is_connected:
            raise RuntimeError("Database connection pool not initialized. Call connect() first.")
        return self._pool
    
    @property
    def is_connected(self) -> bool:
        """Check if the database connection pool is active."""
        return self._is_connected and self._pool is not None
    
    async def health_check(self) -> bool:
        """
        Perform a health check on the database connection.
        
        Returns:
            bool: True if connection is healthy, False otherwise
        """
        if not self.is_connected:
            return False
            
        try:
            async with self._pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

# Global connection manager instance
db_connection = DatabaseConnection()