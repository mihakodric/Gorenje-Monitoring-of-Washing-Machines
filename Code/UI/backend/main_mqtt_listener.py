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
url = config['url']
serijski_port = config['serijski_port']
baud_rate = config['baud_rate']
mqtt_broker = config['mqtt_broker']
mqtt_port = config['mqtt_port']
mqtt_topics = config.get('mqtt_topics', [])




def povezovanje(client, userdata, flags, rc):
    if rc == 0:
        print('Povezano na broker, MQTT.')
        for topic in mqtt_topics:
            client.subscribe(topic)
            print(f'Naročeno na temo: {topic}')
    else:
        print(f'Napaka pri povezavi na broker, MQTT: {rc}')



def prejemanje(client, userdata, msg):
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
    print("Ustvarjanje baze podatkov...")
    ustvari_sql_bazo(ime_baze)

    print("Začenjam z zbiranjem podatkov prek MQTT...")

    try:
        poberi_podatke_mqtt(mqtt_broker, mqtt_port)
    except KeyboardInterrupt:
        print("\nZbiranje podatkov prek MQTT prekinjeno.")

    time.sleep(0.25)

