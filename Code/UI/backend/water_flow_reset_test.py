import paho.mqtt.client as mqtt


mqtt_broker = "192.168.0.106" 
mqtt_port = 1883                
topic = "water_flow/cmd"  


def reset_waterflow():
    client = mqtt.Client()
    client.connect(mqtt_broker, mqtt_port, 60) 
    client.publish(topic, "reset")
    client.disconnect()
    print(f"Ukaz reset poslan na {topic}.")


if __name__ == "__main__":
    reset_waterflow()