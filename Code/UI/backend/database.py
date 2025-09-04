import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional
import json




def ustvari_sql_bazo(ime_baze):
    """
    Create an SQLite database and tables for storing sensor data, sensors, and tests.
    """
    povezava_do_baze = sqlite3.connect(ime_baze)
    orodje = povezava_do_baze.cursor()
    
    # Create sensors table
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS sensors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id TEXT UNIQUE NOT NULL,
            sensor_type TEXT NOT NULL,
            sensor_name TEXT NOT NULL,
            description TEXT,
            location TEXT,
            mqtt_topic TEXT NOT NULL,
            is_online BOOLEAN DEFAULT 1,
            created_at TEXT NOT NULL,
            last_seen TEXT
        )
    ''')
    
    # Create tests table
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_name TEXT UNIQUE NOT NULL,
            description TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT,
            status TEXT DEFAULT 'running',
            created_by TEXT DEFAULT 'user',
            notes TEXT
        )
    ''')

    # Create washing machines table
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS machines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_name TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Create sensor data table (updated schema)
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS podatki (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            time TEXT NOT NULL,
            timestamp_ms INTEGER NOT NULL,
            sensor_id TEXT NOT NULL,          
            direction TEXT NOT NULL,                       
            value REAL NOT NULL,                       
            test_name TEXT NOT NULL,
            FOREIGN KEY (sensor_id) REFERENCES sensors (sensor_id),
            FOREIGN KEY (test_name) REFERENCES tests (test_name)
        )
    ''')
    
    # Create indexes for better performance
    orodje.execute('CREATE INDEX IF NOT EXISTS idx_podatki_sensor_id ON podatki(sensor_id)')
    orodje.execute('CREATE INDEX IF NOT EXISTS idx_podatki_test_name ON podatki(test_name)')
    orodje.execute('CREATE INDEX IF NOT EXISTS idx_podatki_time ON podatki(time)')
    
    # Create MQTT configurations table
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS mqtt_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            broker_host TEXT NOT NULL,
            broker_port INTEGER DEFAULT 1883,
            username TEXT,
            password TEXT,
            topic_prefix TEXT,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Create sensor types table
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS sensor_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            description TEXT,
            default_topic TEXT,
            data_format TEXT DEFAULT 'json',
            unit TEXT,
            min_value REAL,
            max_value REAL,
            is_active BOOLEAN DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')
    
    povezava_do_baze.commit()
    povezava_do_baze.close()




def vstavi_podatke(ime_baze, vzorci, ime_testa='test_1'):
    """
    Insert multiple sensor data samples into the SQLite database.
    Updated to work with the new schema and ensure test exists.
    """
    povezava_do_baze = sqlite3.connect(ime_baze)
    orodje = povezava_do_baze.cursor()
    
    # Ensure test exists (create if not exists)
    trenutni_cas = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    orodje.execute('''
        INSERT OR IGNORE INTO tests (test_name, start_time, status, description)
        VALUES (?, ?, 'running', 'Auto-created test')
    ''', (ime_testa, trenutni_cas))
    
    sql = '''
        INSERT INTO podatki (time, timestamp_ms, sensor_id, direction, value, test_name)
        VALUES (?, ?, ?, ?, ?, ?)
    '''

    seznam = []
    for vzorec in vzorci:
        try:
            trenutni_cas = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            sensor = vzorec.get('sensor_id', '')
            topic = vzorec.get('mqtt_topic', '')
            ts_us = vzorec['timestamp_ms']

            # Update last_seen for sensor
            orodje.execute('''
                UPDATE sensors SET last_seen = ? WHERE sensor_id = ?
            ''', (trenutni_cas, sensor))

            if topic == "acceleration":
                seznam.append((trenutni_cas, ts_us, sensor, 'x', vzorec['ax_g'], ime_testa))
                seznam.append((trenutni_cas, ts_us, sensor, 'y', vzorec['ay_g'], ime_testa))
                seznam.append((trenutni_cas, ts_us, sensor, 'z', vzorec['az_g'], ime_testa))
            
            elif topic == "distance":
                value = vzorec.get('range_mm', None)
                if value is not None:
                    seznam.append((trenutni_cas, ts_us, sensor, 'None', value, ime_testa))
        
            elif topic == "temperature":
                seznam.append((trenutni_cas, ts_us, sensor, 'Ambient', vzorec['ambient_temp_c'], ime_testa))
                seznam.append((trenutni_cas, ts_us, sensor, 'Object', vzorec['object_temp_c'], ime_testa))

            elif topic == "current":
                value = vzorec.get('current_a', None)
                if value is not None:
                    seznam.append((trenutni_cas, ts_us, sensor, 'None', value, ime_testa))            

            elif topic == "water_flow":
                value = vzorec.get('flow', None)
                if value is not None:
                    seznam.append((trenutni_cas, ts_us, sensor, 'None', value, ime_testa))

            elif topic == "infrared":
                value = vzorec.get('yes_no', None)
                if value is not None:
                    seznam.append((trenutni_cas, ts_us, sensor, 'None', value, ime_testa))

            else:
                print(f'Unknown topic: {topic}')

        except KeyError as e:
            print(f'Manjka ključ v podatkih: {e}')
            
    if seznam:
        orodje.executemany(sql, seznam)
    povezava_do_baze.commit()
    povezava_do_baze.close()


# New database functions for the API

def get_all_sensors(ime_baze: str) -> List[Dict]:
    """Get all sensors from the database."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM sensors ORDER BY created_at DESC
    ''')
    sensors = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return sensors


def get_sensor_by_id(ime_baze: str, sensor_id: str) -> Optional[Dict]:
    """Get a specific sensor by ID."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM sensors WHERE sensor_id = ?', (sensor_id,))
    sensor = cursor.fetchone()
    conn.close()
    return dict(sensor) if sensor else None


def create_sensor(ime_baze: str, sensor_data: Dict) -> bool:
    """Create a new sensor."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO sensors (sensor_id, sensor_type, sensor_name, description, location, mqtt_topic, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            sensor_data['sensor_id'],
            sensor_data['sensor_type'],
            sensor_data['sensor_name'],
            sensor_data.get('description', ''),
            sensor_data.get('location', ''),
            sensor_data['mqtt_topic'],
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def update_sensor(ime_baze: str, sensor_id: str, sensor_data: Dict) -> bool:
    """Update an existing sensor."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE sensors 
        SET sensor_name = ?, description = ?, location = ?, is_online = ?
        WHERE sensor_id = ?
    ''', (
        sensor_data['sensor_name'],
        sensor_data.get('description', ''),
        sensor_data.get('location', ''),
        sensor_data.get('is_online', True),
        sensor_id
    ))
    
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def delete_sensor(ime_baze: str, sensor_id: str) -> bool:
    """Delete a sensor."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM sensors WHERE sensor_id = ?', (sensor_id,))
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def get_all_tests(ime_baze: str) -> List[Dict]:
    """Get all tests from the database."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT t.*, 
               COUNT(p.id) as data_points,
               MIN(p.time) as first_data,
               MAX(p.time) as last_data
        FROM tests t
        LEFT JOIN podatki p ON t.test_name = p.test_name
        GROUP BY t.id
        ORDER BY t.start_time DESC
    ''')
    tests = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return tests


def get_test_by_name(ime_baze: str, test_name: str) -> Optional[Dict]:
    """Get a specific test by name."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT t.*, 
               COUNT(p.id) as data_points,
               MIN(p.time) as first_data,
               MAX(p.time) as last_data
        FROM tests t
        LEFT JOIN podatki p ON t.test_name = p.test_name
        WHERE t.test_name = ?
        GROUP BY t.id
    ''', (test_name,))
    test = cursor.fetchone()
    conn.close()
    return dict(test) if test else None


def create_test(ime_baze: str, test_data: Dict) -> bool:
    """Create a new test."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO tests (test_name, description, start_time, status, created_by, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            test_data['test_name'],
            test_data.get('description', ''),
            test_data.get('start_time', datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
            test_data.get('status', 'running'),
            test_data.get('created_by', 'user'),
            test_data.get('notes', '')
        ))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def update_test(ime_baze: str, test_name: str, test_data: Dict) -> bool:
    """Update an existing test."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE tests 
        SET description = ?, status = ?, end_time = ?, notes = ?
        WHERE test_name = ?
    ''', (
        test_data.get('description', ''),
        test_data.get('status', 'running'),
        test_data.get('end_time'),
        test_data.get('notes', ''),
        test_name
    ))
    
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def get_sensor_data(ime_baze: str, test_name: str, sensor_id: str = None, 
                   start_time: str = None, end_time: str = None, limit: int = 1000) -> List[Dict]:
    """Get sensor data for a test."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = '''
        SELECT * FROM podatki 
        WHERE test_name = ?
    '''
    params = [test_name]
    
    if sensor_id:
        query += ' AND sensor_id = ?'
        params.append(sensor_id)
    
    if start_time:
        query += ' AND time >= ?'
        params.append(start_time)
    
    if end_time:
        query += ' AND time <= ?'
        params.append(end_time)
    
    query += ' ORDER BY timestamp_ms DESC LIMIT ?'
    params.append(limit)
    
    cursor.execute(query, params)
    data = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return data


def get_test_summary(ime_baze: str, test_name: str) -> Dict:
    """Get summary statistics for a test."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get test info
    cursor.execute('SELECT * FROM tests WHERE test_name = ?', (test_name,))
    test_info = dict(cursor.fetchone()) if cursor.fetchone() else {}
    
    # Get data summary
    cursor.execute('''
        SELECT 
            sensor_id,
            direction,
            COUNT(*) as count,
            MIN(value) as min_value,
            MAX(value) as max_value,
            AVG(value) as avg_value,
            MIN(time) as first_reading,
            MAX(time) as last_reading
        FROM podatki 
        WHERE test_name = ?
        GROUP BY sensor_id, direction
    ''', (test_name,))
    
    data_summary = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return {
        'test_info': test_info,
        'data_summary': data_summary
    }


# Washing machines
def get_all_machines(ime_baze: str) -> List[Dict]:
    """Get all washing machines from the database."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM machines ORDER BY created_at DESC
    ''')
    machines = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return machines


def get_machine_by_name(ime_baze: str, machine_name: str) -> Optional[Dict]:
    """Get a specific washing machine by name."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM machines WHERE machine_name = ?', (machine_name,))
    machine = cursor.fetchone()
    conn.close()
    return dict(machine) if machine else None


def create_machine(ime_baze: str, machine_data: Dict) -> bool:
    """Create a new washing machine."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO machines (machine_name, description, created_at)
            VALUES (?, ?, ?)
        ''', (
            machine_data['machine_name'],
            machine_data.get('description', ''),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def update_machine(ime_baze: str, machine_name: str, machine_data: Dict) -> bool:
    """Update an existing machine."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE machines 
        SET description = ?
        WHERE machine_name = ?
    ''', (
        machine_data.get('description', ''),
        machine_name
    ))
    
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def delete_machine(ime_baze: str, machine_name: str) -> bool:
    """Delete a washing machine."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM machines WHERE machine_name = ?', (machine_name,))
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


# MQTT Configuration functions
def get_all_mqtt_configs(ime_baze: str) -> List[Dict]:
    """Get all MQTT configurations."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM mqtt_configs ORDER BY created_at DESC')
    configs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return configs


def create_mqtt_config(ime_baze: str, config: Dict) -> Dict:
    """Create a new MQTT configuration."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    current_time = datetime.now().isoformat()
    
    cursor.execute('''
        INSERT INTO mqtt_configs 
        (name, broker_host, broker_port, username, password, topic_prefix, description, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        config['name'], config['broker_host'], config.get('broker_port', 1883),
        config.get('username', ''), config.get('password', ''), config.get('topic_prefix', ''),
        config.get('description', ''), config.get('is_active', True), current_time
    ))
    
    config_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return get_mqtt_config_by_id(ime_baze, config_id)


def get_mqtt_config_by_id(ime_baze: str, config_id: int) -> Optional[Dict]:
    """Get MQTT configuration by ID."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM mqtt_configs WHERE id = ?', (config_id,))
    config = cursor.fetchone()
    conn.close()
    
    return dict(config) if config else None


def update_mqtt_config(ime_baze: str, config_id: int, config_data: Dict) -> Optional[Dict]:
    """Update MQTT configuration."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    set_clauses = []
    params = []
    
    for field in ['name', 'broker_host', 'broker_port', 'username', 'password', 'topic_prefix', 'description', 'is_active']:
        if field in config_data:
            set_clauses.append(f'{field} = ?')
            params.append(config_data[field])
    
    if not set_clauses:
        conn.close()
        return None
    
    query = f'UPDATE mqtt_configs SET {", ".join(set_clauses)} WHERE id = ?'
    params.append(config_id)
    
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    
    return get_mqtt_config_by_id(ime_baze, config_id)


def delete_mqtt_config(ime_baze: str, config_id: int) -> bool:
    """Delete MQTT configuration and mark related sensors as inactive."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    # First, mark related sensors as inactive (if they reference this config)
    # For now, we'll just delete the config as sensor linking would need additional schema
    
    cursor.execute('DELETE FROM mqtt_configs WHERE id = ?', (config_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0


# Sensor Type functions
def get_all_sensor_types(ime_baze: str) -> List[Dict]:
    """Get all sensor types."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM sensor_types ORDER BY created_at DESC')
    types = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return types


def create_sensor_type(ime_baze: str, sensor_type: Dict) -> Dict:
    """Create a new sensor type."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    current_time = datetime.now().isoformat()
    
    cursor.execute('''
        INSERT INTO sensor_types 
        (name, display_name, description, default_topic, data_format, unit, min_value, max_value, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        sensor_type['name'], sensor_type['display_name'], sensor_type.get('description', ''),
        sensor_type.get('default_topic', ''), sensor_type.get('data_format', 'json'),
        sensor_type.get('unit', ''), sensor_type.get('min_value'), sensor_type.get('max_value'),
        sensor_type.get('is_active', True), current_time
    ))
    
    type_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return get_sensor_type_by_id(ime_baze, type_id)


def get_sensor_type_by_id(ime_baze: str, type_id: int) -> Optional[Dict]:
    """Get sensor type by ID."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM sensor_types WHERE id = ?', (type_id,))
    sensor_type = cursor.fetchone()
    conn.close()
    
    return dict(sensor_type) if sensor_type else None


def update_sensor_type(ime_baze: str, type_id: int, type_data: Dict) -> Optional[Dict]:
    """Update sensor type."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    set_clauses = []
    params = []
    
    for field in ['display_name', 'description', 'default_topic', 'data_format', 'unit', 'min_value', 'max_value', 'is_active']:
        if field in type_data:
            set_clauses.append(f'{field} = ?')
            params.append(type_data[field])
    
    if not set_clauses:
        conn.close()
        return None
    
    query = f'UPDATE sensor_types SET {", ".join(set_clauses)} WHERE id = ?'
    params.append(type_id)
    
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    
    return get_sensor_type_by_id(ime_baze, type_id)


def delete_sensor_type(ime_baze: str, type_id: int) -> bool:
    """Delete sensor type and mark related sensors as inactive."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    # Get the sensor type name before deletion
    cursor.execute('SELECT name FROM sensor_types WHERE id = ?', (type_id,))
    result = cursor.fetchone()
    if not result:
        conn.close()
        return False
    
    type_name = result[0]
    
    # Mark sensors of this type as inactive
    cursor.execute('UPDATE sensors SET is_active = 0 WHERE sensor_type = ?', (type_name,))
    
    # Delete the sensor type
    cursor.execute('DELETE FROM sensor_types WHERE id = ?', (type_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0
