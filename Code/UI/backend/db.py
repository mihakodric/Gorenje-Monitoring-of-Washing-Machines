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