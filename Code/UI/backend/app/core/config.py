"""
Configuration management for the application.

This module handles loading and managing application configuration
from config files and environment variables.
"""

import json
import os
from typing import Dict, Any
from pathlib import Path


class Config:
    """Application configuration class."""
    
    def __init__(self):
        self._config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from config.json file."""
        # Get the backend directory (parent of app directory)
        backend_dir = Path(__file__).parent.parent.parent
        config_path = backend_dir / 'config.json'
        
        try:
            with open(config_path, 'r') as config_file:
                return json.load(config_file)
        except FileNotFoundError:
            # Default configuration if file doesn't exist
            return {
                "mqtt_broker": "localhost",
                "mqtt_port": 1883,
                "mqtt_topics": [],
                "database_url": "postgresql://admin:admin123@timescaledb:5432/long_term_monitoring_db"
            }
    
    @property
    def mqtt_broker(self) -> str:
        """Get MQTT broker host."""
        return self._config.get('mqtt_broker', 'localhost')
    
    @property
    def mqtt_port(self) -> int:
        """Get MQTT broker port."""
        return self._config.get('mqtt_port', 1883)
    
    @property
    def mqtt_topics(self) -> list:
        """Get MQTT topics."""
        return self._config.get('mqtt_topics', [])
    
    @property
    def database_url(self) -> str:
        """Get database URL."""
        # Check environment variable first, then config file
        return os.getenv(
            'DATABASE_URL',
            self._config.get(
                'database_url',
                'postgresql://admin:admin123@timescaledb:5432/long_term_monitoring_db'
            )
        )


# Global configuration instance
config = Config()