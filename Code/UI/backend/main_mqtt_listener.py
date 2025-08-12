import json
import os
import time
from db import ustvari_sql_bazo, vstavi_podatke
import paho.mqtt.client as mqtt  # pip install paho-mqtt


# Branje nastavitev iz config.json
base_path = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(base_path, 'config.json')
with open(config_path, 'r') as config_file:
    config = json.load(config_file)

# Dostop do vrednosti
ime_baze = config['ime_baze']
# url = config['url']
# serijski_port = config['serijski_port']
# baud_rate = config['baud_rate']
mqtt_broker = config['mqtt_broker']
mqtt_port = config['mqtt_port']
mqtt_topics = config.get('mqtt_topics', [])




def povezovanje(client, userdata, flags, rc):
    """
    Callback function executed when the MQTT client connects to the broker.

    Subscribes to all topics specified in the global mqtt_topics list upon
    successful connection.

    Args:
        client (mqtt.Client): The MQTT client instance.
        userdata: User-defined data of any type.
        flags (dict): Response flags sent by the broker.
        rc (int): The connection result. 0 indicates success.

    Returns:
        None
    """
    if rc == 0:
        print('Povezano na broker, MQTT.')
        for topic in mqtt_topics:
            client.subscribe(topic)
            print(f'Naročeno na temo: {topic}')
    else:
        print(f'Napaka pri povezavi na broker, MQTT: {rc}')




def prejemanje(client, userdata, msg):
    """
    Callback function triggered when an MQTT message is received.

    Processes the JSON payload, validates sensor_id presence, and inserts
    the received sensor data into the SQLite database.

    Args:
        client (mqtt.Client): The MQTT client instance.
        userdata: User-defined data of any type.
        msg (mqtt.MQTTMessage): The received MQTT message, with attributes
            topic (str) and payload (bytes).

    Returns:
        None
    """
    try:
        podatki = json.loads(msg.payload.decode('utf-8'))

        if isinstance(podatki, dict):
            # Ensure sensor_id is present in payload
            if 'sensor_id' not in podatki:
                print('Opozorilo: Manjka sensor_id v sporočilu.')
                return
            podatki = [podatki]  # Make a list for vstavi_podatke
        elif isinstance(podatki, list):
            for vzorec in podatki:
                if 'sensor_id' not in vzorec:
                    print('Opozorilo: Manjka sensor_id v enem od vzorcev.')
                    return
        else:
            print('Napačna oblika podatkov (ni seznam ali dict).')
            return

        print(f'Prejeto {len(podatki)} vzorcev prek MQTT iz teme {msg.topic}.')
        vstavi_podatke(ime_baze, podatki)

    except Exception as e:
        print(f'Napaka pri prejemanju podatkov prek MQTT: {e}')




def poberi_podatke_mqtt(broker='localhost', port=1883):
    """
    Connects to the MQTT broker and starts the message loop to receive data.

    Sets up MQTT client callbacks for connection and message reception,
    connects to the specified broker and port, and runs indefinitely until
    interrupted.

    Args:
        broker (str): Hostname or IP address of the MQTT broker. Defaults to 'localhost'.
        port (int): Port number for the MQTT broker connection. Defaults to 1883.

    Returns:
        None
    """
    client = mqtt.Client(protocol=mqtt.MQTTv311)
    client.on_connect = povezovanje
    client.on_message = prejemanje

    try:
        client.connect(broker, port, 60)
        print(f'Povezovanje na MQTT broker {broker}...')
        client.loop_forever()
    except Exception as e:
        print(f'Napaka pri povezovanju na MQTT: {e}')
            



if __name__ == "__main__":
    """
    Main program entry point.

    Creates the SQLite database if it does not exist and starts collecting sensor
    data over MQTT using the configured broker and port.

    Handles graceful exit on keyboard interrupt.
    """
    print("Ustvarjanje baze podatkov...")
    ustvari_sql_bazo(ime_baze)

    print("Začenjam z zbiranjem podatkov prek MQTT...")

    try:
        poberi_podatke_mqtt(mqtt_broker, mqtt_port)
    except KeyboardInterrupt:
        print("\nZbiranje podatkov prek MQTT prekinjeno.")

    time.sleep(0.25)

