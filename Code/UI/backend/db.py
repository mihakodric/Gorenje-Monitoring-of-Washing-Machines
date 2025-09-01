import sqlite3
from datetime import datetime




def ustvari_sql_bazo(ime_baze):
    """
    Create an SQLite database and a table for storing sensor data.

    If the database file does not exist, it will be created.  
    The function creates a table named `podatki` with the following columns:
        - id (INTEGER, primary key, autoincrement)
        - datetime (INTEGER): global date and time (in microseconds)
        - sensor_id (TEXT): identifier of the sensor (e.g., 'acc1', 'temp2')
        - direction (REAL): axis or direction for accelerometer readings, or 'None' for scalar values
        - value (REAL): measured sensor value
        - unit (TEXT): unit of the measured value
        - test_name (REAL): test label (e.g., ime_testa)

    Args:
        ime_baze (str): Path or filename of the SQLite database file.

    Returns:
        None
    """

    povezava_do_baze = sqlite3.connect(ime_baze)
    orodje = povezava_do_baze.cursor()
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS podatki (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            datetime INTEGER NOT NULL,
            sensor_id TEXT NOT NULL,          
            direction TEXT NOT NULL,                       
            value REAL NOT NULL,                      
            test_name REAL NOT NULL 
        )
    ''')
    povezava_do_baze.commit()
    povezava_do_baze.close()




def vstavi_podatke(ime_baze, vzorci, ime_testa='test_1'):
    """
    Insert multiple sensor data samples into the SQLite database.

    The function processes each sensor reading dictionary in `vzorci` and inserts 
    one or more rows into the `podatki` table depending on the sensor type:
        - Accelerometer ('acc...'): inserts three rows (x, y, z) with `ax_g`, `ay_g`, `az_g`.
        - Distance ('dist...'): inserts one row with `range_mm`.
        - Temperature ('temp...'): inserts one row with `temp_c`.
        - Current ('current...'): inserts one row with `current_a`.
        - Flow ('flow...'): inserts one row with `flow`.
        - Infrared ('infra...'): inserts one row with `rotations`.

    If a sensor ID is unrecognized, a message is printed.  
    If a required key is missing in the data dictionary, an error message is printed.

    Args:
        ime_baze (str): Path or filename of the SQLite database file.
        vzorci (list[dict]): List of dictionaries containing sensor data.
            Each dictionary must contain:
                - 'sensor_id' (str)
                - 'datetime' (int)
            Plus sensor-specific keys depending on type.

    Returns:
        None
    """

    povezava_do_baze = sqlite3.connect(ime_baze)
    orodje = povezava_do_baze.cursor()
    
    sql = '''
        INSERT INTO podatki (datetime, sensor_id, direction, value, test_name)
        VALUES (?, ?, ?, ?, ?)
    '''

    seznam = []
    for vzorec in vzorci:
        try:
            sensor = vzorec.get('sensor_id', '')
            topic = vzorec.get('mqtt_topic', '')
            ts_us = vzorec['datetime']

            if topic == "acceleration":
                seznam.append((ts_us, sensor, 'x', vzorec['ax_g'], ime_testa))
                seznam.append((ts_us, sensor, 'y', vzorec['ay_g'], ime_testa))
                seznam.append((ts_us, sensor, 'z', vzorec['az_g'], ime_testa))
            
            elif topic == "distance":
                value = vzorec.get('range_mm', None)
                if value is not None:
                    seznam.append((ts_us, sensor, 'None', value, ime_testa))
        
            elif topic == "temperature":
                seznam.append((ts_us, sensor, 'Ambient', vzorec['ambient_temp_c'], ime_testa))
                seznam.append((ts_us, sensor, 'Object', vzorec['object_temp_c'], ime_testa))

            elif topic == "current":
                value = vzorec.get('current_a', None)
                if value is not None:
                    seznam.append((ts_us, sensor, 'None', value, ime_testa))            

            elif topic == "water_flow":
                value = vzorec.get('flow', None)
                if value is not None:
                    seznam.append((ts_us, sensor, 'None', value, ime_testa))

            elif topic == "infrared":
                value = vzorec.get('rotations', None)
                if value is not None:
                    seznam.append((ts_us, sensor, 'None', value, ime_testa))

            else:
                print(f'Unknown topic: {topic}')

        except KeyError as e:
            print(f'Manjka ključ v podatkih: {e}')
            
    orodje.executemany(sql, seznam)
    povezava_do_baze.commit()
    povezava_do_baze.close()