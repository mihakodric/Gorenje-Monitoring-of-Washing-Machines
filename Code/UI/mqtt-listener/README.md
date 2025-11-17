# MQTT Listener Service

This service continuously listens to MQTT topics and logs all received messages. It also updates sensor online status in the PostgreSQL database.

## Features

- 📡 Subscribes to all MQTT topics (configurable)
- 💾 Updates sensor online status in PostgreSQL
- 🔄 Auto-restarts if connection fails
- 📊 Pretty-printed JSON message logging
- ⏰ Timestamps for all messages

## Configuration

Environment variables (set in docker-compose.yml):

- `MQTT_BROKER`: Hostname of MQTT broker (default: `mosquitto`)
- `MQTT_PORT`: MQTT broker port (default: `1883`)
- `MQTT_TOPICS`: Comma-separated list of topics to subscribe (default: `#` = all topics)
- `DATABASE_URL`: PostgreSQL connection string

## Usage

### Start with Docker Compose

```bash
# Build and start all services including the listener
docker compose up -d

# View listener logs
docker compose logs -f mqtt-listener

# View only recent messages
docker compose logs --tail 50 mqtt-listener

# Restart listener
docker compose restart mqtt-listener

# Stop listener
docker compose stop mqtt-listener
```

### Message Format

The listener handles two message formats:

1. **Measurement Data** (list format):
```json
[
  {
    "meta": {
      "sensor_id": "sensor_123",
      "timestamp": "2025-11-11T10:00:00Z"
    },
    "data": [
      {"value": 1.23, "channel": "x"},
      {"value": 4.56, "channel": "y"}
    ]
  }
]
```

2. **Configuration Messages** (dict format with `/config` topic):
```json
{
  "sensor_id": "sensor_123",
  "setting": "value"
}
```

## Testing

Publish a test message to verify the listener is working:

```bash
# Simple test message
docker run --rm --network ui_default eclipse-mosquitto:2 mosquitto_pub \
  -h mosquitto -p 1883 -t test/demo -m '{"sensor_id": "test_001", "value": 123}'

# Retained message
docker run --rm --network ui_default eclipse-mosquitto:2 mosquitto_pub \
  -h mosquitto -p 1883 -t gorenje/sensor/test -r \
  -m '[{"meta":{"sensor_id":"acc_01"},"data":[{"value":1.5}]}]'
```

## Troubleshooting

### Listener not receiving messages

1. Check if mosquitto is running:
   ```bash
   docker compose ps mosquitto
   ```

2. Check listener logs:
   ```bash
   docker compose logs mqtt-listener
   ```

3. Verify network connectivity:
   ```bash
   docker compose exec mqtt-listener ping mosquitto
   ```

### Change subscribed topics

Edit `docker-compose.yml`:
```yaml
mqtt-listener:
  environment:
    MQTT_TOPICS: "gorenje/#,sensor/#,test/#"
```

Then restart:
```bash
docker compose restart mqtt-listener
```
