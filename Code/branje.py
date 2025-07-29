import requests
import sqlite3
import json
import time


ime_baze = 'prebrani_podatki.db'
url = 'http://10.180.137.123/buffer'

def ustvari_sql_bazo(ime_baze):
    povezava_do_baze = sqlite3.connect(ime_baze)
    orodje = povezava_do_baze.cursor()
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS podatki (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        INSERT INTO podatki (timestamp_us, ax, ay, az)
        VALUES (?, ?, ?, ?)
    '''
    seznam = []
    for vzorec in vzorci:
        seznam.append((vzorec['timestamp_us'], vzorec['ax_g'], vzorec['ay_g'], vzorec['az_g']))
    orodje.executemany(sql, seznam)
    povezava_do_baze.commit()
    povezava_do_baze.close()

def poberi_podatke(url, ime_baze):
    try:
        zahtevek = requests.get(url, timeout=5)
        zahtevek.raise_for_status()

        vzorci = zahtevek.json()
        print("Tip podatkov:", type(vzorci))
        if not isinstance(vzorci, list):
            print('Podatki so v napačno obliki: type(vzorci).')
            return
        
        print(f'Prejeto število vzorcev: {len(vzorci)}')
        vstavi_podatke(ime_baze, vzorci)

    except requests.exceptions.RequestException as e:
        print(f'Napaka pri pridobivanju podatkov: {e}')

if __name__ == "__main__":

    print('Ustvarjanje baze podatkov...'   )
    ustvari_sql_bazo(ime_baze)
    print('Baza podatkov ustvarjena.')

    print('Pobiranje podatkov...'  )
    while True:
        poberi_podatke(url, ime_baze)
        time.sleep(0.25)
