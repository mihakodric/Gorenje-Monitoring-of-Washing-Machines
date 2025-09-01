import paho.mqtt.client as mqtt
import json

mqtt_broker = "192.168.0.106"
mqtt_port = 1883
topic = "acceleration/cmd"

def send_config_update(param, value):
    client = mqtt.Client()
    client.connect(mqtt_broker, mqtt_port, 60)
    message = json.dumps({"set": param, "value": value})
    client.publish(topic, message)
    client.disconnect()
    print(f"Poslano: {message}")

if __name__ == "__main__":

    send_config_update("sampling_frequency_Hz", 400)
    send_config_update("sensitivity", 0.000000)
    send_config_update("range_g", 16)
    send_config_update("send_interval_ms", 10)
