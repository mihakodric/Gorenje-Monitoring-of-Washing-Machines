import paho.mqtt.client as mqtt
import json
import os


# Branje nastavitev iz config.json
base_path = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(base_path, 'config.json')
with open(config_path, 'r') as config_file:
    config = json.load(config_file)

# Dostop do vrednosti
mqtt_broker = config['mqtt_broker']
mqtt_port = config['mqtt_port']

sensor_id = 'infra_1'


config_updates = [
        # {"set": "reset", "value": False},
        # {"set": "sampling_interval_ms", "value": 1000},
        {"set": "buffer_size", "value": 10},
        # {"set": "gmt_offset_sec", "value": 3600},
        # {"set": "daylight_offset_sec", "value": 3600},
        # {"set": "sampling_frequency_Hz", "value": 400},
        # {"set": "sensitivity", "value": 0.000488},
        # {"set": "range_g", "value": 16}
    ]

def send_config_update(sensor_id, param, value):
    client = mqtt.Client()
    client.connect(mqtt_broker, mqtt_port, 60)
    message = json.dumps({
        "set": param,
        "value": value
        })
    topic = f"{sensor_id}/cmd"
    client.publish(topic, message)
    client.disconnect()
    print(f"Sent to {topic}: {message}")

if __name__ == "__main__":
    for update in config_updates:
        send_config_update(sensor_id, update["set"], update["value"])

