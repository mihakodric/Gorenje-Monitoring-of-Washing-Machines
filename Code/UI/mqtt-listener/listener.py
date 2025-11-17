"""
MQTT Listener for Gorenje Washing Machine Monitoring
Continuously listens to MQTT topics and logs received messages.
"""
import json
import os
import time
import asyncio
from datetime import datetime
import paho.mqtt.client as mqtt
import asyncpg

# Configuration from environment variables
MQTT_BROKER = os.getenv('MQTT_BROKER', 'mosquitto')
MQTT_PORT = int(os.getenv('MQTT_PORT', '1883'))
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://admin:admin123@timescaledb:5432/long_term_monitoring_db')

# Subscribe to all topics by default
MQTT_TOPICS = os.getenv('MQTT_TOPICS', '#').split(',')

# Global database pool
db_pool = None


async def init_db_pool():
    """Initialize the PostgreSQL connection pool."""
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60
        )
        print(f"✓ Database pool initialized")
    except Exception as e:
        print(f"✗ Failed to initialize database pool: {e}")
        raise


async def update_sensor_online_status(sensor_id: str):
    """Mark sensor as online and update last_seen timestamp."""
    if not db_pool:
        return
    
    try:
        async with db_pool.acquire() as conn:
            current_time = datetime.now()
            await conn.execute("""
                UPDATE metadata.sensors
                SET sensor_last_seen = $1, sensor_is_online = true
                WHERE sensor_id = $2
            """, current_time, sensor_id)
            print(f"  └─ Updated sensor {sensor_id} status: online")
    except Exception as e:
        print(f"  └─ Error updating sensor status: {e}")


def on_connect(client, userdata, flags, rc):
    """Callback when connected to MQTT broker."""
    if rc == 0:
        print(f"✓ Connected to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
        for topic in MQTT_TOPICS:
            client.subscribe(topic)
            print(f"  └─ Subscribed to: {topic}")
    else:
        print(f"✗ Failed to connect to MQTT broker, return code: {rc}")


def on_message(client, userdata, msg):
    """Callback when a message is received."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    topic = msg.topic
    
    try:
        # Try to parse as JSON
        payload = json.loads(msg.payload.decode('utf-8'))
        print(f"\n[{timestamp}] 📨 Topic: {topic}")
        print(f"  Payload: {json.dumps(payload, indent=2)}")
        
        # Extract sensor_id if present and update status (sync version for now)
        sensor_id = None
        
        # Check if payload is a list (measurement data format)
        if isinstance(payload, list):
            for item in payload:
                meta = item.get('meta', {})
                sensor_id = meta.get('sensor_id')
                if sensor_id:
                    # Schedule async task in the event loop
                    try:
                        loop = asyncio.get_event_loop()
                        loop.create_task(update_sensor_online_status(sensor_id))
                    except RuntimeError:
                        # No event loop in this thread, skip db update
                        pass
                    data_count = len(item.get('data', []))
                    print(f"  └─ Sensor: {sensor_id}, Data points: {data_count}")
        
        # Check if payload is a dict (config format)
        elif isinstance(payload, dict):
            sensor_id = payload.get('sensor_id')
            if sensor_id:
                # Schedule async task in the event loop
                try:
                    loop = asyncio.get_event_loop()
                    loop.create_task(update_sensor_online_status(sensor_id))
                except RuntimeError:
                    # No event loop in this thread, skip db update
                    pass
                if topic.endswith('/config'):
                    print(f"  └─ Config for sensor: {sensor_id}")
                else:
                    print(f"  └─ Sensor: {sensor_id}")
        
    except json.JSONDecodeError:
        # Not JSON, print as string
        payload_str = msg.payload.decode('utf-8', errors='replace')
        print(f"\n[{timestamp}] 📨 Topic: {topic}")
        print(f"  Payload (raw): {payload_str[:200]}")
    except Exception as e:
        print(f"\n[{timestamp}] ⚠️  Error processing message from {topic}: {e}")


def on_disconnect(client, userdata, rc):
    """Callback when disconnected from MQTT broker."""
    if rc != 0:
        print(f"⚠️  Unexpected disconnect from MQTT broker (code: {rc})")
    else:
        print("✓ Disconnected from MQTT broker")


def on_subscribe(client, userdata, mid, granted_qos):
    """Callback when subscription is confirmed."""
    print(f"  └─ Subscription confirmed (mid: {mid}, QoS: {granted_qos})")


async def run_mqtt_listener():
    """Main function to run the MQTT listener."""
    print("=" * 60)
    print("🔊 MQTT Listener Starting")
    print("=" * 60)
    
    # Initialize database pool
    await init_db_pool()
    
    # Create MQTT client
    client = mqtt.Client(client_id="gorenje_listener", protocol=mqtt.MQTTv311)
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect
    client.on_subscribe = on_subscribe
    
    # Set socket timeout
    client.socket_timeout = 5.0
    
    try:
        print(f"\n🔌 Connecting to MQTT broker: {MQTT_BROKER}:{MQTT_PORT}")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        
        # Start the loop
        client.loop_start()
        print("✓ MQTT listener loop started\n")
        print("=" * 60)
        print("📡 Listening for messages... (Press Ctrl+C to stop)")
        print("=" * 60)
        
        # Keep the script running
        while True:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping MQTT listener...")
    except Exception as e:
        print(f"\n✗ Error: {e}")
    finally:
        client.loop_stop()
        client.disconnect()
        if db_pool:
            await db_pool.close()
        print("✓ MQTT listener stopped")


if __name__ == "__main__":
    # Run the async listener
    asyncio.run(run_mqtt_listener())
