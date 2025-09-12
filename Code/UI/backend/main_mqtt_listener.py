import json
import os
import time
import threading
import sqlite3
from datetime import datetime
from database import ustvari_sql_bazo, vstavi_podatke, mark_sensor_offline
import paho.mqtt.client as mqtt  # pip install paho-mqtt


# Branje nastavitev iz config.json
base_path = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(base_path, 'config.json')
with open(config_path, 'r') as config_file:
    config = json.load(config_file)

# Dostop do vrednosti
ime_baze = config['ime_baze']
mqtt_broker = config['mqtt_broker']
mqtt_port = config['mqtt_port']
mqtt_topics = config.get('mqtt_topics', [])

mqtt_running = False
mqtt_client = None
offline_checker_running = False


def povezovanje(client, userdata, flags, rc):
    """
    Callback executed when the MQTT client connects to the broker.

    On a successful connection (rc == 0), subscribes to all topics
    listed in the global variable `mqtt_topics`.

    Args:
        client (mqtt.Client): The MQTT client instance.
        userdata: Optional user-defined data (currently unused).
        flags (dict): Response flags sent by the broker.
        rc (int): Connection result code (0 means success).
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
        for item in podatki:
            meta = item.get('meta', {})
            data = item.get('data', [])

            sensor_id = meta.get('sensor_id')
            if sensor_id:
                try:
                    conn = sqlite3.connect(ime_baze)
                    cursor = conn.cursor()
                    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                    cursor.execute("""
                        UPDATE sensors
                        SET last_seen = ?, is_online = 1
                        WHERE sensor_id = ?
                    """, (current_time, sensor_id))
                    conn.commit()
                    conn.close()
                except Exception as e:
                    print(f'Error updating sensor status {sensor_id}: {e}')

            if not isinstance(data, list):
                print("Napačna oblika podatkov: 'data' ni seznam.")
                return
            if not data:
                print("Ni vzorcev v 'data'.")
                return

            print(f'Prejeto {len(data)} vzorcev prek MQTT iz teme {msg.topic}.')
            vstavi_podatke(ime_baze, meta, data)

    except Exception as e:
        print(f'Napaka pri prejemanju podatkov prek MQTT: {e}')


def start_mqtt(broker=None, port=None):
    """Start MQTT listener (non-blocking)."""
    global mqtt_running, mqtt_client
    if mqtt_running:
        print("MQTT already running")
        return

    mqtt_running = True
    mqtt_client = mqtt.Client(protocol=mqtt.MQTTv311)
    mqtt_client.on_connect = povezovanje
    mqtt_client.on_message = prejemanje
    mqtt_client.connect(broker or mqtt_broker, port or mqtt_port, 60)

    mqtt_client.loop_start()
    print("MQTT loop started")


def stop_mqtt():
    """Stop MQTT listener"""
    global mqtt_running, mqtt_client, offline_checker_running
    if not mqtt_running:
        print("MQTT is not running")
        return

    mqtt_running = False
    offline_checker_running = False
    if mqtt_client:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        mqtt_client = None
    print("MQTT stopped")


def start_offline_checker(database_name, interval=1, timeout_seconds=60):
    """Starts a background thread that marks sensors offline."""
    global offline_checker_running
    if offline_checker_running:
        return
    offline_checker_running = True

    def loop():
        while offline_checker_running:
            time.sleep(interval)
            mark_sensor_offline(database_name, timeout_seconds)

    t = threading.Thread(target=loop, daemon=True)
    t.start()


# def poberi_podatke_mqtt(broker='localhost', port=1883):
#     """
#     Connects to the MQTT broker and starts the message loop to receive data.

#     Sets the connection (`povezovanje`) and message (`prejemanje`)
#     callbacks. Once connected, runs an infinite loop processing messages
#     until interrupted.

#     Args:
#         broker (str): Hostname or IP address of the MQTT broker. Defaults to 'localhost'.
#         port (int): Port number for the MQTT broker connection. Defaults to 1883.

#     Returns:
#         None
#     """
#     client = mqtt.Client(protocol=mqtt.MQTTv311)
#     client.on_connect = povezovanje
#     client.on_message = prejemanje

#     try:
#         client.connect(broker, port, 60)
#         print(f'Povezovanje na MQTT broker {broker}...')
#         client.loop_forever()
#     except Exception as e:
#         print(f'Napaka pri povezovanju na MQTT: {e}')
            



if __name__ == "__main__":
    """
    Main program entry point.

    1. Creates the SQLite database if it does not already exist.
    2. Starts collecting sensor data via MQTT using settings from `config.json`.
    3. On Ctrl+C, prints a message and stops gracefully.
    """
    print("Ustvarjanje baze podatkov...")
    ustvari_sql_bazo(ime_baze)

    print("Začenjam z zbiranjem podatkov prek MQTT...")

    try:
        start_mqtt()
        while True:
            time.sleep(1)
            mark_sensor_offline(ime_baze, timeout_seconds=60)
    except KeyboardInterrupt:
        print("\nZbiranje podatkov prek MQTT prekinjeno.")
        stop_mqtt()

    time.sleep(0.25)

