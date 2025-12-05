import paho.mqtt.client as mqtt
import json
import os
from database import get_mqtt_config


# Reading from config.json
base_path = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(base_path, 'config.json')
with open(config_path, 'r') as config_file:
    config = json.load(config_file)

DATABASE_NAME = config['ime_baze']
default_broker = config['mqtt_broker']
default_port = config['mqtt_port']

# sensor_id = 'infra_1'


# config_updates = [
#         # {"set": "reset", "value": False},
#         # {"set": "sampling_interval_ms", "value": 1000},
#         {"set": "buffer_size", "value": 10},
#         # {"set": "gmt_offset_sec", "value": 3600},
#         # {"set": "daylight_offset_sec", "value": 3600},
#         # {"set": "sampling_frequency_Hz", "value": 400},
#         # {"set": "sensitivity", "value": 0.000488},
#         # {"set": "range_g", "value": 16}
#     ]

def send_config_update(sensor_id: str, settings: dict):

    mqtt_config =get_mqtt_config(DATABASE_NAME)
    broker = mqtt_config["broker_host"] if mqtt_config else default_broker
    port = mqtt_config["broker_port"] if mqtt_config else default_port

    client = mqtt.Client()
    client.connect(broker, port, 60)

    message = json.dumps(settings)
    topic = f"{sensor_id}/cmd"

    client.publish(topic, message)
    client.disconnect()
    print(f"Sent to {topic}: {message}")

# if __name__ == "__main__":
#     for update in config_updates:
#         send_config_update(sensor_id, update["set"], update["value"])

