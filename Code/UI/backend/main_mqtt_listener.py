import json
import time
from db import ustvari_sql_bazo, vstavi_podatke
import paho.mqtt.client as mqtt  # pip install paho-mqtt


# Branje nastavitev iz config.json
with open('config.json', 'r') as config_file:
    config = json.load(config_file)

# Dostop do vrednosti
ime_baze = config['ime_baze']
url = config['url']
serijski_port = config['serijski_port']
baud_rate = config['baud_rate']
mqtt_broker = config['mqtt_broker']
mqtt_port = config['mqtt_port']
mqtt_tema = config['mqtt_tema']




def povezovanje(client, userdata, flags, rc):
    if rc == 0:
        print('Povezano na broker, MQTT.')
    else:
        print(f'Napaka pri povezavi na broker, MQTT: {rc}')

def prejemanje(client, userdata, msg):
    try:
        podatki = json.loads(msg.payload.decode('utf-8'))
        if isinstance(podatki, list):
            print(f'Prejeto {len(podatki)} vzorcev prek MQTT.')
            vstavi_podatke(ime_baze, podatki)
        else:
            print('Napačna oblika podatkov (ni seznam).')
    except Exception as e:
        print(f'Napaka pri prejemanju podatkov prek MQTT: {e}')

def poberi_podatke_mqtt(broker='localhost', port=1883, tema='pospesek'):
    client = mqtt.Client()
    client.on_connect = povezovanje
    client.on_message = prejemanje

    try:
        client.connect(broker, port, 60)
        client.subscribe(tema)
        print(f'Povezovanje na MQTT broker {broker} na temi {tema}...')
        client.loop_forever()
    except Exception as e:
        print(f'Napaka pri povezovanju na MQTT: {e}')
            

if __name__ == "__main__":
    print("Ustvarjanje baze podatkov...")
    ustvari_sql_bazo(ime_baze)

    print("Začenjam z zbiranjem podatkov prek MQTT...")

    try:
        poberi_podatke_mqtt(mqtt_broker, mqtt_port, mqtt_tema)
    except KeyboardInterrupt:
        print("\nZbiranje podatkov prek MQTT prekinjeno.")

    time.sleep(0.25)

