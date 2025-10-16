"""
Mock MQTT listener and publisher for development.

This module provides mock implementations of MQTT functionality
while the real MQTT modules are being updated to work with the new database structure.
"""

from typing import Dict, Any


class MockMQTTListener:
    """Mock MQTT listener for development."""
    
    def __init__(self):
        self._mqtt_running = False
    
    @property
    def mqtt_running(self) -> bool:
        """Check if MQTT listener is running."""
        return self._mqtt_running
    
    def start_mqtt(self, host: str = None, port: int = None) -> None:
        """Start MQTT listener (mock implementation)."""
        self._mqtt_running = True
        print(f"🔧 Mock MQTT listener started (host={host}, port={port})")
    
    def stop_mqtt(self) -> None:
        """Stop MQTT listener (mock implementation)."""
        self._mqtt_running = False
        print("🔧 Mock MQTT listener stopped")
    
    def start_offline_checker(self) -> None:
        """Start offline checker (mock implementation)."""
        print("🔧 Mock offline checker started")


class MockMQTTPublisher:
    """Mock MQTT publisher for development."""
    
    def send_config_update(self, sensor_id: int, settings: Dict[str, Any]) -> None:
        """Send configuration update via MQTT (mock implementation)."""
        print(f"🔧 Mock MQTT config update sent for sensor {sensor_id}: {settings}")
    
    def publish_message(self, topic: str, message: str) -> None:
        """Publish message to MQTT topic (mock implementation)."""
        print(f"🔧 Mock MQTT message published to {topic}: {message}")


# Global instances
mqtt_listener = MockMQTTListener()
mqtt_publisher = MockMQTTPublisher()