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


config_updates = {
    "acceleration/cmd": [
        {"set": "sampling_frequency_Hz", "value": 400},
        {"set": "sensitivity", "value": 0.000488},
        {"set": "range_g", "value": 16},
        {"set": "send_interval_ms", "value": 10}
    ],
    "current/cmd": [
        {"set": "sampling_interval_ms", "value": 500},
    ],
    "distance/cmd": [
        {"set": "sampling_interval_ms", "value": 1000},
    ],
    "infrared/cmd": [
        {"set": "sampling_interval_ms", "value": 500},
    ],
    "temperature/cmd": [
        {"set": "sampling_interval_ms", "value": 1000}
    ],
    "water_flow/cmd": [
        {"set": "reset", "value": False},
        {"set": "sampling_interval_ms", "value": 2000}
    ]
}

def send_config_update(topic, param, value):
    client = mqtt.Client()
    client.connect(mqtt_broker, mqtt_port, 60)
    message = json.dumps({"set": param, "value": value})
    client.publish(topic, message)
    client.disconnect()
    print(f"Poslano na {topic}: {message}")

if __name__ == "__main__":
    for topic, updates in config_updates.items():
        for update in updates:
            send_config_update(topic, update["set"], update["value"])

