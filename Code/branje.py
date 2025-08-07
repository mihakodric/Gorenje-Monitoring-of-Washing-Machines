import requests
import sqlite3
import json
import time
import serial
from datetime import datetime
import paho.mqtt.client as mqtt  # pip install paho-mqtt


ime_baze = 'prebrani_podatki.db'
url = 'http://192.168.0.101/buffer'
serijski_port = 'COM4'  #nastavi svoj port 
baud_rate = 230400
mqtt_broker = '192.168.0.77' # nastavi svoj, v cmd ipconfig
mqtt_port = 1883
mqtt_tema = 'pospesek'

def ustvari_sql_bazo(ime_baze):
    povezava_do_baze = sqlite3.connect(ime_baze)
    orodje = povezava_do_baze.cursor()
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS podatki (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            čas TEXT NOT NULL,
            timestamp_us INTEGER NOT NULL,          
            ax REAL NOT NULL,                       
            ay REAL NOT NULL,                       
            az REAL NOT NULL 
        )
    ''')
    povezava_do_baze.commit()
    povezava_do_baze.close()


def vstavi_podatke(ime_baze, vzorci):
    povezava_do_baze = sqlite3.connect(ime_baze)
    orodje = povezava_do_baze.cursor()
    
    sql = '''
        INSERT INTO podatki (čas, timestamp_us, ax, ay, az)
        VALUES (?, ?, ?, ?, ?)
    '''

    seznam = []
    for vzorec in vzorci:
        try:
            trenutni_čas = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            seznam.append((
                trenutni_čas,
                vzorec['timestamp_us'],
                vzorec['ax_g'],
                vzorec['ay_g'],
                vzorec['az_g']
            ))
        except KeyError as e:
            print(f'Manjka ključ v podatkih: {e}')
    orodje.executemany(sql, seznam)
    povezava_do_baze.commit()
    povezava_do_baze.close()


def poberi_podatke_wifi(url, ime_baze):
    try:
        while True:
            zahtevek = requests.get(url, timeout=5)
            zahtevek.raise_for_status()
            vzorci = zahtevek.json()
            if not isinstance(vzorci, list):
                print('Napačna oblika podatkov (ni seznam).')
                return
            print(f'Prejeto {len(vzorci)} vzorcev prek WiFi.')
            vstavi_podatke(ime_baze, vzorci)
    except Exception as e:
        print(f'Napaka pri WiFi pobiranju: {e}')

def poberi_iz_serije(port, baud, ime_baze):
    try:
        with serial.Serial(port, baudrate=baud, timeout=2) as ser:
            ser.write(b"preberi_iz_bufferja\n") 
            vrstica = ser.readline().decode('utf-8').strip()
            if not vrstica:
                print("Ni podatkov.")
                return
            vzorci = json.loads(vrstica)
            if not isinstance(vzorci, list):
                print("Podatki niso seznam.")
                return
            print(f'Prejeto {len(vzorci)} vzorcev prek kabla.')
            vstavi_podatke(ime_baze, vzorci)
    except serial.SerialException as e:
        print(f'Serijska napaka: {e}')
    except json.JSONDecodeError as e:
        print(f'Napaka pri JSON dekodiranju: {e}')


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

def poberi_podatke_mqtt(broker='localhost', port=1883, tema='pospešek'):
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
    print("Način pobiranja podatkov ('wifi', 'serija', 'mqtt' ali 'konec'):")

    while True:
        način = input("Način (wifi / serija / mqtt / konec): ").strip().lower()

        if način == 'wifi':
            poberi_podatke_wifi(url, ime_baze)
        elif način == 'serija':
            poberi_iz_serije(serijski_port, baud_rate, ime_baze)
        elif način == 'mqtt':
            poberi_podatke_mqtt(mqtt_broker, mqtt_port, mqtt_tema)
        elif način == 'konec':
            print("Zbiranje podatkov zaključeno.")
            break
        else:
            print("Neveljaven način.")

        time.sleep(0.25)

