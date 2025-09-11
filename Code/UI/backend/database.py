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
            last_seen TEXT,
            visible BOOLEAN DEFAULT 1,
            settings TEXT
        )
    ''')
    
    # Create tests table
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_name TEXT NOT NULL,
            description TEXT,
            start_time TEXT,
            end_time TEXT,
            status TEXT DEFAULT 'idle',
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
            created_at TEXT NOT NULL,
            visible BOOLEAN DEFAULT 1
        )
    ''')
    
    # Create sensor data table
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS podatki (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            datetime TEXT NOT NULL,
            direction TEXT NOT NULL,                       
            value REAL NOT NULL,                       
            test_relation_id INTEGER NOT NULL,
            FOREIGN KEY (test_relation_id) REFERENCES test_relations (id)
        )
    ''')
    
    # Create indexes for better performance
    # orodje.execute('CREATE INDEX IF NOT EXISTS idx_podatki_sensor_id ON podatki(sensor_id)')
    # orodje.execute('CREATE INDEX IF NOT EXISTS idx_podatki_test_relation_id ON podatki(test_relation_id)')
    orodje.execute('CREATE INDEX IF NOT EXISTS idx_podatki_datetime ON podatki(datetime)')
    
    # Create MQTT configurations table
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS mqtt_configs (
            broker_host TEXT NOT NULL,
            broker_port INTEGER DEFAULT 1883,
            username TEXT,
            password TEXT,
            is_active BOOLEAN DEFAULT 1
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
            unit TEXT,
            min_value REAL,
            max_value REAL,
            created_at TEXT NOT NULL
        )
    ''')

    # Create test_relations table
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS test_relations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id INTEGER NOT NULL,
            machine_id INTEGER NOT NULL,
            sensor_id INTEGER NOT NULL,
            FOREIGN KEY (test_id) REFERENCES tests(id),
            FOREIGN KEY (machine_id) REFERENCES machines(id),
            FOREIGN KEY (sensor_id) REFERENCES sensors(id)
        )
    ''')    
    
    povezava_do_baze.commit()
    povezava_do_baze.close()




def vstavi_podatke(ime_baze: str, meta, data):
    """
    Insert sensor data samples into the database for a running test the sensor is linked to.
    Saves data from all sensors connected to the test (via test_relations).
    """
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()

    sensor_id = meta.get('sensor_id', '')
    topic = meta.get('mqtt_topic', '')


    # Map MQTT sensor_id string to primary key in sensors table
    cursor.execute("SELECT id FROM sensors WHERE sensor_id = ?", (sensor_id,))
    sensor_row = cursor.fetchone()
    if not sensor_row:
        print(f"Sensor {sensor_id} not found in database, skipping")
        conn.close()
        return

    sensor_primary_key = sensor_row[0]


    # Find running tests that include this sensor
    cursor.execute('''
        SELECT tr.id, t.id as test_id
        FROM test_relations tr
        JOIN tests t ON tr.test_id = t.id
        WHERE tr.sensor_id = ? AND t.status = 'running'
    ''', (sensor_primary_key,))
    relations = cursor.fetchall()
    if not relations:
        print(f"No running test found for sensor {sensor_id}, skipping")
        conn.close()
        return
    
    sql = '''
        INSERT INTO podatki (datetime, direction, value, test_relation_id)
        VALUES (?, ?, ?, ?)
    '''

    rows_to_insert = []
    for vzorec in data:
        try:
            trenutni_cas = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            sample_datetime = vzorec['datetime']

            for test_relation_id, test_id in relations:
                # Update last_seen for sensor
                cursor.execute('''
                    UPDATE sensors SET last_seen = ? WHERE sensor_id = ?
                ''', (trenutni_cas, sensor_id))

                if topic == "acceleration":
                    rows_to_insert.extend([
                        (sample_datetime, 'x', vzorec['ax_g'], test_relation_id),
                        (sample_datetime, 'y', vzorec['ay_g'], test_relation_id),
                        (sample_datetime, 'z', vzorec['az_g'], test_relation_id)
                        ])
            
                elif topic == "temperature":
                    rows_to_insert.extend([
                        (sample_datetime, 'Ambient', vzorec['ambient_temp_c'], test_relation_id),
                        (sample_datetime, 'Object', vzorec['object_temp_c'], test_relation_id)
                        ])

                else:
                    rows_to_insert.append((sample_datetime, 'None', vzorec.get('value', None), test_relation_id))

        except KeyError as e:
            print(f'Manjka ključ v podatkih: {e}')
            
    if rows_to_insert:
        cursor.executemany(sql, rows_to_insert)
    conn.commit()
    conn.close()


# New database functions for the API

def get_all_sensors(ime_baze: str) -> List[Dict]:
    """Get all sensors from the database."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM sensors ORDER BY created_at DESC
    ''')
    rows = cursor.fetchall()
    sensors = []
    for row in rows:
        sensor = dict(row)
        # Deserialize settings if present
        if sensor.get("settings"):
            try:
                sensor["settings"] = json.loads(sensor["settings"])
            except (json.JSONDecodeError, TypeError):
                sensor["settings"] = None
        sensors.append(sensor)
    conn.close()
    return sensors


def get_sensor_by_id(ime_baze: str, sensor_id: str) -> Optional[Dict]:
    """Get a specific sensor by ID."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM sensors WHERE sensor_id = ?', (sensor_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        sensor = dict(row)
        if sensor.get("settings"):
            try:
                sensor["settings"] = json.loads(sensor["settings"])
            except (json.JSONDecodeError, TypeError):
                sensor["settings"] = None
        return sensor
    return None


def create_sensor(ime_baze: str, sensor_data: Dict) -> bool:
    """Create a new sensor."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO sensors (
                       sensor_id, sensor_type, sensor_name, description, location, 
                       mqtt_topic, created_at, visible, is_online, settings
                       )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            sensor_data['sensor_id'],
            sensor_data['sensor_type'],
            sensor_data['sensor_name'],
            sensor_data.get('description', ''),
            sensor_data.get('location', ''),
            sensor_data['mqtt_topic'],
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            sensor_data.get('visible', True),
            sensor_data.get('is_online', True),
            json.dumps(sensor_data.get('settings')) if sensor_data.get('settings') else None
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
        SET sensor_name = ?, description = ?, location = ?,
            is_online = ?, visible = ?, settings = ?
        WHERE sensor_id = ?
    ''', (
        sensor_data['sensor_name'],
        sensor_data.get('description', ''),
        sensor_data.get('location', ''),
        sensor_data.get('is_online', True),
        sensor_data.get('visible', True),
        json.dumps(sensor_data.get('settings')) if sensor_data.get('settings') else None,
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

# Tests
def get_all_tests(ime_baze: str) -> List[Dict]:
    """Get all tests from the database."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT t.*, 
               COUNT(p.id) as data_points,
               MIN(p.datetime) as first_data,
               MAX(p.datetime) as last_data
        FROM tests t
        LEFT JOIN test_relations tr ON t.id = tr.test_id
        LEFT JOIN podatki p ON tr.id = p.test_relation_id
        GROUP BY t.id
        ORDER BY t.start_time DESC
    ''')
    tests = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return tests


def get_test_by_id(ime_baze: str, test_id: int) -> Optional[Dict]:
    """Get a specific test by id with aggregates + related machines and sensors."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT t.*, 
               COUNT(p.id) as data_points,
               MIN(p.datetime) as first_data,
               MAX(p.datetime) as last_data
        FROM tests t
        LEFT JOIN test_relations tr ON t.id = tr.test_id
        LEFT JOIN podatki p ON tr.id = p.test_relation_id
        WHERE t.id = ?
        GROUP BY t.id
    ''', (test_id,))

    test = cursor.fetchone()
    if not test:
        conn.close()
        return None
    test = dict(test)

    conn.close()

    return test


def create_test(ime_baze: str, test_data: Dict) -> bool:
    """Create a new test."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO tests (test_name, description, status, created_by, notes)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            test_data['test_name'],
            test_data.get('description', ''),
            test_data.get('status', 'idle'),
            test_data.get('created_by', 'user'),
            test_data.get('notes', '')
        ))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def update_test(ime_baze: str, test_id: int, test_data: Dict) -> bool:
    """Update an existing test."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()

    fields = []
    values = []

    for key in ['test_name', 'description', 'notes']:
        if key in test_data:
            fields.append(f"{key} = ?")
            values.append(test_data[key])

    if not fields:
        conn.close()
        return False
    
    values.append(test_id)
    sql = f"UPDATE tests SET {', '.join(fields)} WHERE id = ?"
    cursor.execute(sql, values)
    
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def start_test(ime_baze: str, test_id: int) -> bool:
    """Set a test as running and record start_time."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()

    start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sql = "UPDATE tests SET status = ?, start_time = ? WHERE id = ?"
    cursor.execute(sql, ('running', start_time, test_id))

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def stop_test(ime_baze: str, test_id: int) -> bool:
    """Set a test as completed and record end_time."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()

    end_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sql = "UPDATE tests SET status = ?, end_time = ? WHERE id = ?"
    cursor.execute(sql, ('completed', end_time, test_id))

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def delete_test(ime_baze: str, test_id: int) -> bool:
    """Delete a test and all related data."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    # Delete related data entries
    cursor.execute('''
        DELETE FROM podatki 
        WHERE test_relation_id IN (
            SELECT id FROM test_relations WHERE test_id = ?
        )
    ''', (test_id,))
    
    # Delete test relations
    cursor.execute('DELETE FROM test_relations WHERE test_id = ?', (test_id,))
    
    # Delete test
    cursor.execute('DELETE FROM tests WHERE id = ?', (test_id,))
    
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def get_sensor_data(ime_baze: str, test_id: int, sensor_id: str = None, 
                   start_time: str = None, end_time: str = None) -> List[Dict]:
    """Get sensor data for a test."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get all test_relation_ids for this test
    cursor.execute('SELECT id FROM test_relations WHERE test_id = ?', (test_id,))
    relation_rows = cursor.fetchall()
    relation_ids = [r["id"] for r in relation_rows]

    if not relation_ids:
        conn.close()
        return []
    
    placeholders = ",".join("?" for _ in relation_ids)
    query = f'''
        SELECT * FROM podatki
        WHERE test_relation_id IN ({placeholders})
    '''
    params = relation_ids
    
    if sensor_id:
        query += ' AND sensor_id = ?'
        params.append(sensor_id)
    
    if start_time:
        query += ' AND datetime >= ?'
        params.append(start_time)
    
    if end_time:
        query += ' AND datetime <= ?'
        params.append(end_time)
    
    query += ' ORDER BY datetime DESC'
    
    cursor.execute(query, params)
    data = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return data


def get_test_summary(ime_baze: str, test_id: int) -> Dict:
    """Get summary statistics for a test."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    row = cursor.fetchone()
    
    # Get test info
    cursor.execute('SELECT * FROM tests WHERE id = ?', (test_id,))
    test_info = dict(row) if row else {}

    # Get all test_relation_ids for the test
    cursor.execute('SELECT id FROM test_relations WHERE test_id = ?', (test_id,))
    relation_rows = cursor.fetchall()
    relation_ids = [r["id"] for r in relation_rows]

    # Get data summary
    data_summary = []
    if relation_ids:
        placeholders = ','.join('?' for _ in relation_ids)
        query = f'''
            SELECT 
                direction,
                COUNT(*) as count,
                MIN(value) as min_value,
                MAX(value) as max_value,
                AVG(value) as avg_value,
                MIN(datetime) as first_reading,
                MAX(datetime) as last_reading
            FROM podatki 
            WHERE test_relation_id IN ({placeholders})
            GROUP BY test_relation_id, direction
        '''
        cursor.execute(query, relation_ids)
        data_summary = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return {
        'test_info': test_info,
        'data_summary': data_summary
    }


# Test relations

# def get_related_machines(ime_baze: str, test_id: int) -> List[Dict]:
#     """Return all machines related to a given test."""
#     conn = sqlite3.connect(ime_baze)
#     conn.row_factory = sqlite3.Row
#     cursor = conn.cursor()
    
#     cursor.execute('''
#         SELECT DISTINCT 
#             m.id, m.machine_name, m.description, m.created_at, m.visible
#         FROM test_relations tr
#         JOIN machines m ON tr.machine_id = m.id
#         WHERE tr.test_id = ?
#     ''', (test_id,))
    
#     machines = [dict(row) for row in cursor.fetchall()]
#     conn.close()
#     return machines


# def get_related_sensors(ime_baze: str, test_id: int) -> List[Dict]:
#     """Return all sensors related to a given test."""
#     conn = sqlite3.connect(ime_baze)
#     conn.row_factory = sqlite3.Row
#     cursor = conn.cursor()
    
#     cursor.execute('''
#         SELECT DISTINCT 
#             s.id, s.sensor_id, s.sensor_type, s.sensor_name, 
#             s.description, s.location, s.mqtt_topic, 
#             s.is_online, s.created_at, s.last_seen, s.visible, s.settings
#         FROM test_relations tr
#         JOIN sensors s ON tr.sensor_id = s.id
#         WHERE tr.test_id = ?
#     ''', (test_id,))
    
#     sensors = [dict(row) for row in cursor.fetchall()]
#     conn.close()
#     return sensors

def get_test_relations(ime_baze, test_id):
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM test_relations WHERE test_id = ?", (test_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(zip([c[0] for c in cursor.description], row)) for row in rows]


def create_test_relation(ime_baze, test_id, relation_data):
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO test_relations (test_id, machine_id, sensor_id)
        VALUES (?, ?, ?)
    ''', (
        test_id,
        relation_data["machine_id"],
        relation_data["sensor_id"]
    ))
    conn.commit()
    conn.close()
    return True


def update_test_machine(ime_baze, test_id, machine_id):
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE test_relations
        SET machine_id = ?
        WHERE test_id = ?
    ''', (machine_id, test_id))
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def delete_test_relation(ime_baze, relation_id):
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM test_relations WHERE id = ?", (relation_id,))
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


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


def get_machine_by_id(ime_baze: str, machine_id: int) -> Optional[Dict]:
    """Get a specific washing machine by id."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM machines WHERE id = ?', (machine_id,))
    machine = cursor.fetchone()
    conn.close()
    return dict(machine) if machine else None


def create_machine(ime_baze: str, machine_data: Dict) -> bool:
    """Create a new washing machine."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO machines (machine_name, description, created_at, visible)
            VALUES (?, ?, ?, ?)
        ''', (
            machine_data['machine_name'],
            machine_data.get('description', ''),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            machine_data.get('visible', True)
        ))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def update_machine(ime_baze: str, machine_id: int, machine_data: Dict) -> bool:
    """Update an existing machine."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE machines 
        SET machine_name = ?, description = ?, visible = ?
        WHERE id = ?
    ''', (
        machine_data.get('machine_name', ''),
        machine_data.get('description', ''),
        machine_data.get('visible', True),
        machine_id
    ))
    
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def delete_machine(ime_baze: str, machine_id: int) -> bool:
    """Delete a washing machine."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM machines WHERE id = ?', (machine_id,))
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


# MQTT Configuration functions
def get_mqtt_config(ime_baze: str) -> Optional[Dict]:
    """Get MQTT configuration."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM mqtt_configs LIMIT 1')
    config = cursor.fetchone()
    conn.close()
    return dict(config) if config else None


def create_mqtt_config(ime_baze: str, config_data: Dict) -> bool:
    """Create the MQTT configuration."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO mqtt_configs (broker_host, broker_port, username, password, is_active)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            config_data['broker_host'],
            config_data.get('broker_port', 1883),
            config_data.get('username', ''),
            config_data.get('password', ''),
            config_data.get('is_active', True)
        ))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()



def update_mqtt_config(ime_baze: str, config_data: Dict) -> Optional[Dict]:
    """Update MQTT configuration."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    set_clauses = []
    params = []
    
    for field in ['broker_host', 'broker_port', 'username', 'password', 'is_active']:
        if field in config_data:
            set_clauses.append(f'{field} = ?')
            params.append(config_data[field])
    
    if not set_clauses:
        conn.close()
        return None
    
    query = f'UPDATE mqtt_configs SET {", ".join(set_clauses)}'
    
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    
    return get_mqtt_config(ime_baze)


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
        (name, display_name, description, default_topic, unit, min_value, max_value, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        sensor_type['name'], sensor_type['display_name'], sensor_type.get('description', ''),
        sensor_type.get('default_topic', ''),
        sensor_type.get('unit', ''), sensor_type.get('min_value'), sensor_type.get('max_value'),
        current_time
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
    
    for field in ['display_name', 'description', 'default_topic', 'unit', 'min_value', 'max_value']:
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
    """Delete sensor type and mark related sensors as invisible."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    # Get the sensor type name before deletion
    cursor.execute('SELECT name FROM sensor_types WHERE id = ?', (type_id,))
    result = cursor.fetchone()
    if not result:
        conn.close()
        return False
    
    type_name = result[0]
    
    # Mark sensors of this type as invisible
    cursor.execute('UPDATE sensors SET visible = 0 WHERE sensor_type = ?', (type_name,))
    
    # Delete the sensor type
    cursor.execute('DELETE FROM sensor_types WHERE id = ?', (type_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0
