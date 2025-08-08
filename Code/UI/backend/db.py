import sqlite3
from datetime import datetime




def ustvari_sql_bazo(ime_baze):
    povezava_do_baze = sqlite3.connect(ime_baze)
    orodje = povezava_do_baze.cursor()
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS podatki (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            čas TEXT NOT NULL,
            timestamp_us INTEGER NOT NULL,
            sensor_id TEXT NOT NULL,          
            direction REAL NOT NULL,                       
            value REAL NOT NULL,                       
            test_name REAL NOT NULL 
        )
    ''')
    povezava_do_baze.commit()
    povezava_do_baze.close()


def vstavi_podatke(ime_baze, vzorci):
    povezava_do_baze = sqlite3.connect(ime_baze)
    orodje = povezava_do_baze.cursor()
    
    sql = '''
        INSERT INTO podatki (čas, timestamp_us, sensor_id, direction, value, test_name)
        VALUES (?, ?, ?, ?, ?, ?)
    '''

    seznam = []
    for vzorec in vzorci:
        try:
            trenutni_čas = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            seznam.append((trenutni_čas, vzorec['timestamp_us'], vzorec['sensor_id'], 'x', vzorec['ax_g'], 'test_1'))
            seznam.append((trenutni_čas, vzorec['timestamp_us'], vzorec['sensor_id'], 'y', vzorec['ay_g'], 'test_1'))
            seznam.append((trenutni_čas, vzorec['timestamp_us'], vzorec['sensor_id'], 'z', vzorec['az_g'], 'test_1'))
        except KeyError as e:
            print(f'Manjka ključ v podatkih: {e}')
            
    orodje.executemany(sql, seznam)
    povezava_do_baze.commit()
    povezava_do_baze.close()