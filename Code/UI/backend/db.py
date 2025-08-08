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
            trenutni_cas = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            sensor = vzorec.get('sensor_id', '')
            ts_us = vzorec['timestamp_us']

            if sensor.startswith('acc'):
                seznam.append((trenutni_cas, ts_us, sensor, 'x', vzorec['ax_g'], 'test_1'))
                seznam.append((trenutni_cas, ts_us, sensor, 'y', vzorec['ay_g'], 'test_1'))
                seznam.append((trenutni_cas, ts_us, sensor, 'z', vzorec['az_g'], 'test_1'))
            
            elif sensor.startswith('dist'):
                value = vzorec.get('range_mm', None)
                if value is not None:
                    seznam.append((trenutni_cas, ts_us, sensor, 'None', value, 'test_1'))
        
            elif sensor.startswith('temp'):
                value = vzorec.get('temp_c', None)
                if value is not None:
                    seznam.append((trenutni_cas, ts_us, sensor, 'None', value, 'test_1'))

            elif sensor.startswith('current'):
                value = vzorec.get('current_a', None)
                if value is not None:
                    seznam.append((trenutni_cas, ts_us, sensor, 'None', value, 'test_1'))            

            elif sensor.startswith('flow'):
                value = vzorec.get('flow', None)
                if value is not None:
                    seznam.append((trenutni_cas, ts_us, sensor, 'None', value, 'test_1'))

            elif sensor.startswith('infra'):
                value = vzorec.get('yes_no', None)
                if value is not None:
                    seznam.append((trenutni_cas, ts_us, sensor, 'None', value, 'test_1'))

            else:
                print(f'Unknown sensor_id: {sensor}')

        except KeyError as e:
            print(f'Manjka ključ v podatkih: {e}')
            
    orodje.executemany(sql, seznam)
    povezava_do_baze.commit()
    povezava_do_baze.close()