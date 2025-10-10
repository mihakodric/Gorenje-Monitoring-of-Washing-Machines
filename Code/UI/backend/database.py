import sqlite3
from datetime import datetime, timedelta
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
            mqtt_topic TEXT NOT NULL,
            is_online BOOLEAN DEFAULT 0,
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
            notes TEXT,
            created_by TEXT NOT NULL,
            status TEXT DEFAULT 'idle',
            created_at TEXT NOT NULL,
            last_modified_at TEXT NOT NULL
        )
    ''')

    # Create washing machines table
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS machines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_name TEXT NOT NULL,
            description TEXT,
            machine_type_id INTEGER,
            created_at TEXT NOT NULL,
            visible BOOLEAN DEFAULT 1,
            FOREIGN KEY (machine_type_id) REFERENCES machine_types (id)
        )
    ''')
    
    # Create machine types table
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS machine_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            display_name TEXT NOT NULL,
            description TEXT,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL
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
    # orodje.execute('CREATE INDEX IF NOT EXISTS idx_podatki_datetime ON podatki(datetime)')
    
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
            mqtt_topic TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            unit TEXT,
            description TEXT,
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
            sensor_location TEXT,
            FOREIGN KEY (test_id) REFERENCES tests(id),
            FOREIGN KEY (machine_id) REFERENCES machines(id),
            FOREIGN KEY (sensor_id) REFERENCES sensors(id)
        )
    ''')

    # Create test_summaries table for performance optimization
    orodje.execute('''
        CREATE TABLE IF NOT EXISTS test_summaries (
            test_id INTEGER PRIMARY KEY,
            sensor_count INTEGER DEFAULT 0,
            data_points INTEGER DEFAULT 0,
            first_data TEXT,
            last_data TEXT,
            test_duration_minutes REAL DEFAULT 0,
            last_updated TEXT NOT NULL,
            FOREIGN KEY (test_id) REFERENCES tests(id)
        )
    ''')
    
    povezava_do_baze.commit()
    povezava_do_baze.close()



def insert_settings(ime_baze: str, sensor_id: str, settings: Dict[str, Any]):
    """ on connection insert sensor settings if sensor_id exists, otherwise create new sensor with settings"""
    try:
        conn = sqlite3.connect(ime_baze)
        cursor = conn.cursor()

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        settings_json = json.dumps(settings)

        cursor.execute("""
            INSERT INTO sensors (sensor_id, sensor_type, sensor_name, description, mqtt_topic, 
                                 is_online, created_at, last_seen, visible, settings)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(sensor_id) DO UPDATE SET
                settings   = excluded.settings,
                last_seen  = excluded.last_seen,
                is_online  = excluded.is_online
        """, (
            sensor_id,
            settings.get("mqtt_topic", ""),                         # default sensor_type
            sensor_id,                      # default sensor_name
            None,                           # description
            settings.get("mqtt_topic", ""),
            1,                              # is_online
            now,                            # created_at
            now,                            # last_seen
            1,                              # visible
            settings_json
        ))

        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error saving settings for {sensor_id}: {e}")
        return False
    


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
            sample_datetime = vzorec['datetime']

            for test_relation_id, test_id in relations:

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
        
        # Update test summaries for all affected tests
        affected_test_ids = set([test_id for _, test_id in relations])
        conn.commit()
        conn.close()
        
        # Update summaries after committing data (using separate connections)
        for test_id in affected_test_ids:
            update_test_summary(ime_baze, test_id)
    else:
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


def mark_sensor_offline(ime_baze: str, timeout_seconds: int = 60):
    """Mark sensors as offline if they haven't sent data within the timeout period."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    threshold_time = (datetime.now() - timedelta(seconds=timeout_seconds)).strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        UPDATE sensors
        SET is_online = 0
        WHERE last_seen IS NULL OR last_seen < ?
    ''', (threshold_time,))
    
    conn.commit()
    conn.close()


def create_sensor(ime_baze: str, sensor_data: Dict) -> bool:
    """Create a new sensor."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO sensors (
                       sensor_id, sensor_type, sensor_name, description, 
                       mqtt_topic, created_at, visible
                       )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            sensor_data['sensor_id'],
            sensor_data['sensor_type'],
            sensor_data['sensor_name'],
            sensor_data.get('description', ''),
            sensor_data['mqtt_topic'],
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            sensor_data.get('visible', True),
        ))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def update_sensor(ime_baze: str, sensor_id: str, sensor_data: Dict) -> bool:
    """Update an existing sensor and send settings via MQTT."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE sensors 
        SET sensor_name = ?, description = ?, visible = ?
        WHERE sensor_id = ?
    ''', (
        sensor_data['sensor_name'],
        sensor_data.get('description', ''),
        sensor_data.get('visible', True),
        sensor_id
    ))
    
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return success


def update_sensor_settings(ime_baze: str, sensor_id: str, new_settings: Dict[str, Any]) -> bool:
    """Update sensor settings."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()

    # Get current settings
    cursor.execute("SELECT settings FROM sensors WHERE sensor_id = ?", (sensor_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    current_settings = json.loads(row[0]) if row[0] else {}

    # Merge new settings into current settings
    current_settings.update(new_settings)

    # Save merged settings back
    cursor.execute("""
        UPDATE sensors
        SET settings = ?
        WHERE sensor_id = ?
    """, (json.dumps(current_settings), sensor_id))
    
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
    """Get all tests from the database with cached summary data."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT t.*, 
               COALESCE(ts.sensor_count, 0) as sensor_count,
               COALESCE(ts.data_points, 0) as data_points,
               ts.first_data,
               ts.last_data,
               COALESCE(ts.test_duration_minutes, 0) as test_duration_minutes
        FROM tests t
        LEFT JOIN test_summaries ts ON t.id = ts.test_id
        ORDER BY t.created_at DESC
    ''')
    tests = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return tests


def get_test_by_id(ime_baze: str, test_id: int) -> Optional[Dict]:
    """Get a specific test by id with cached summary data."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT t.*, 
               COALESCE(ts.sensor_count, 0) as sensor_count,
               COALESCE(ts.data_points, 0) as data_points,
               ts.first_data,
               ts.last_data,
               COALESCE(ts.test_duration_minutes, 0) as test_duration_minutes
        FROM tests t
        LEFT JOIN test_summaries ts ON t.id = ts.test_id
        WHERE t.id = ?
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
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute('''
            INSERT INTO tests (test_name, description, notes, created_by, status, created_at, last_modified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            test_data['test_name'],
            test_data.get('description', ''),
            test_data.get('notes', ''),
            test_data['created_by'],
            'idle',
            current_time,
            current_time
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
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for key in ['test_name', 'description', 'notes', 'created_by']:
        if key in test_data:
            fields.append(f"{key} = ?")
            values.append(test_data[key])

    if not fields:
        conn.close()
        return False
    
    # Always update last_modified_at
    fields.append("last_modified_at = ?")
    values.append(current_time)
    values.append(test_id)
    
    sql = f"UPDATE tests SET {', '.join(fields)} WHERE id = ?"
    cursor.execute(sql, values)
    
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def start_test(ime_baze: str, test_id: int) -> bool:
    """Set a test as running only if test is idle."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()

    sql = "UPDATE tests SET status = ? WHERE id = ? AND status = ?"
    cursor.execute(sql, ('running', test_id, 'idle'))

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def stop_test(ime_baze: str, test_id: int) -> bool:
    """Set a test as completed."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()

    sql = "UPDATE tests SET status = ? WHERE id = ?"
    cursor.execute(sql, ('completed', test_id))

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
    
    # Delete test summary
    cursor.execute('DELETE FROM test_summaries WHERE test_id = ?', (test_id,))
    
    # Delete test
    cursor.execute('DELETE FROM tests WHERE id = ?', (test_id,))
    
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def get_sensor_data(ime_baze: str, test_id: int, sensor_id: str = None) -> List[Dict]:
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
        INSERT INTO test_relations (test_id, machine_id, sensor_id, sensor_location)
        VALUES (?, ?, ?, ?)
    ''', (
        test_id,
        relation_data["machine_id"],
        relation_data["sensor_id"],
        relation_data.get("sensor_location", "")
    ))
    conn.commit()
    conn.close()
    
    # Update test summary after relation changes
    update_test_summary(ime_baze, test_id)
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
    
    # Get test_id before deletion for summary update
    cursor.execute("SELECT test_id FROM test_relations WHERE id = ?", (relation_id,))
    result = cursor.fetchone()
    test_id = result[0] if result else None
    
    cursor.execute("DELETE FROM test_relations WHERE id = ?", (relation_id,))
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    
    # Update test summary after relation deletion
    if success and test_id:
        update_test_summary(ime_baze, test_id)
    
    return success


def get_test_relations_for_sensor(database_name, sensor_id):
    query = "SELECT * FROM test_relations WHERE sensor_id = ?"
    conn = sqlite3.connect(database_name)
    cursor = conn.cursor()
    cursor.execute(query, (sensor_id,))
    results = cursor.fetchall()
    conn.close()
    return results


def get_test_relations_for_machine(database_name, machine_id):
    query = "SELECT * FROM test_relations WHERE machine_id = ?"
    conn = sqlite3.connect(database_name)
    cursor = conn.cursor()
    cursor.execute(query, (machine_id,))
    results = cursor.fetchall()
    conn.close()
    return results


def is_sensor_or_machine_available(ime_baze: str, sensor_id: str = None, machine_id: int = None) -> bool:
    """
    Returns True if the sensor or machine is not currently part of a running test.
    """
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()

    # Check sensor availability
    if sensor_id:
        cursor.execute("""
            SELECT t.id
            FROM tests t
            JOIN test_relations tr ON t.id = tr.test_id
            WHERE t.status = 'running' AND tr.sensor_id = ?
        """, (sensor_id,))
        if cursor.fetchone():
            conn.close()
            return False

    # Check machine availability
    if machine_id:
        cursor.execute("""
            SELECT t.id
            FROM tests t
            JOIN test_relations tr ON t.id = tr.test_id
            WHERE t.status = 'running' AND tr.machine_id = ?
        """, (machine_id,))
        if cursor.fetchone():
            conn.close()
            return False

    conn.close()
    return True


def create_test_with_relations(ime_baze: str, test_data: Dict, machine_id: int, sensors: List[Dict]) -> Optional[int]:
    """Create a test with machine and sensor relations in a single transaction."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    try:
        # Create the test
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute('''
            INSERT INTO tests (test_name, description, notes, created_by, status, created_at, last_modified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            test_data['test_name'],
            test_data.get('description', ''),
            test_data.get('notes', ''),
            test_data['created_by'],
            'idle',
            current_time,
            current_time
        ))
        
        test_id = cursor.lastrowid
        
        # Create relations for each sensor
        for sensor in sensors:
            cursor.execute('''
                INSERT INTO test_relations (test_id, machine_id, sensor_id, sensor_location)
                VALUES (?, ?, ?, ?)
            ''', (test_id, machine_id, sensor['sensor_id'], sensor.get('sensor_location', '')))
        
        conn.commit()
        return test_id
        
    except Exception as e:
        conn.rollback()
        print(f"Error creating test with relations: {e}")
        return None
    finally:
        conn.close()


def get_test_with_relations(ime_baze: str, test_id: int) -> Optional[Dict]:
    """Get a test with its machine and sensor relations."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get test info
    cursor.execute('SELECT * FROM tests WHERE id = ?', (test_id,))
    test_row = cursor.fetchone()
    if not test_row:
        conn.close()
        return None
    
    test = dict(test_row)
    
    # Get relations
    cursor.execute('''
        SELECT tr.machine_id, tr.sensor_id, tr.sensor_location, m.machine_name, s.sensor_name
        FROM test_relations tr
        LEFT JOIN machines m ON tr.machine_id = m.id
        LEFT JOIN sensors s ON tr.sensor_id = s.id
        WHERE tr.test_id = ?
    ''', (test_id,))
    relations = cursor.fetchall()
    
    if relations:
        test['machine_id'] = relations[0]['machine_id']
        test['machine_name'] = relations[0]['machine_name']
        test['sensors'] = [{
            'sensor_id': rel['sensor_id'],
            'sensor_name': rel['sensor_name'],
            'sensor_location': rel['sensor_location'] or ''
        } for rel in relations]
    else:
        test['machine_id'] = None
        test['machine_name'] = None
        test['sensors'] = []
    
    conn.close()
    return test


def update_test_relations(ime_baze: str, test_id: int, machine_id: int, sensors: List[Dict]) -> bool:
    """Update test relations by replacing all existing relations."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    try:
        # Delete existing relations
        cursor.execute('DELETE FROM test_relations WHERE test_id = ?', (test_id,))
        
        # Create new relations
        for sensor in sensors:
            cursor.execute('''
                INSERT INTO test_relations (test_id, machine_id, sensor_id, sensor_location)
                VALUES (?, ?, ?, ?)
            ''', (test_id, machine_id, sensor['sensor_id'], sensor.get('sensor_location', '')))
        
        conn.commit()
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"Error updating test relations: {e}")
        return False
    finally:
        conn.close()


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
            INSERT INTO machines (machine_name, description, machine_type_id, created_at, visible)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            machine_data['machine_name'],
            machine_data.get('description', ''),
            machine_data.get('machine_type_id'),
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
        SET machine_name = ?, description = ?, machine_type_id = ?, visible = ?
        WHERE id = ?
    ''', (
        machine_data.get('machine_name', ''),
        machine_data.get('description', ''),
        machine_data.get('machine_type_id'),
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


def create_mqtt_config(ime_baze: str, config_data: Dict) -> Optional[Dict]:
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
        conn.close()
        
        # Return the created config
        return get_mqtt_config(ime_baze)
    except sqlite3.IntegrityError:
        conn.close()
        return None



def update_mqtt_config(ime_baze: str, config_data: Dict) -> Optional[Dict]:
    """Update MQTT configuration."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    set_clauses = []
    params = []
    
    for field in ['broker_host', 'broker_port', 'username', 'password']:
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


def sync_mqtt_active_state(ime_baze: str, mqtt_running: bool):
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    cursor.execute('UPDATE mqtt_configs SET is_active = ?', (1 if mqtt_running else 0,))
    conn.commit()
    conn.close()



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
        (mqtt_topic, display_name, unit, description, created_at)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        sensor_type['mqtt_topic'], sensor_type['display_name'], 
        sensor_type.get('unit', ''), sensor_type.get('description', ''),
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
    
    for field in ['mqtt_topic', 'display_name', 'unit', 'description']:
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
    
    # Get the sensor type mqtt_topic before deletion
    cursor.execute('SELECT mqtt_topic FROM sensor_types WHERE id = ?', (type_id,))
    result = cursor.fetchone()
    if not result:
        conn.close()
        return False
    
    mqtt_topic = result[0]
    
    # Mark sensors of this type as invisible
    cursor.execute('UPDATE sensors SET visible = 0 WHERE sensor_type = ?', (mqtt_topic,))
    
    # Delete the sensor type
    cursor.execute('DELETE FROM sensor_types WHERE id = ?', (type_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0


# Machine Types
def get_all_machine_types(ime_baze: str) -> List[Dict]:
    """Get all machine types."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM machine_types ORDER BY created_at DESC')
    types = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return types


def get_machine_type_by_id(ime_baze: str, type_id: int) -> Optional[Dict]:
    """Get machine type by ID."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM machine_types WHERE id = ?', (type_id,))
    result = cursor.fetchone()
    conn.close()
    
    return dict(result) if result else None


def create_machine_type(ime_baze: str, type_data: Dict) -> Dict:
    """Create new machine type."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute('''
        INSERT INTO machine_types (display_name, description, created_by, created_at)
        VALUES (?, ?, ?, ?)
    ''', (
        type_data['display_name'],
        type_data.get('description', ''),
        type_data['created_by'],
        created_at
    ))
    
    type_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return get_machine_type_by_id(ime_baze, type_id)


def update_machine_type(ime_baze: str, type_id: int, type_data: Dict) -> Optional[Dict]:
    """Update machine type."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    set_clauses = []
    params = []
    
    for field in ['display_name', 'description']:
        if field in type_data and type_data[field] is not None:
            set_clauses.append(f'{field} = ?')
            params.append(type_data[field])
    
    if not set_clauses:
        conn.close()
        return None
    
    query = f'UPDATE machine_types SET {", ".join(set_clauses)} WHERE id = ?'
    params.append(type_id)
    
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    
    return get_machine_type_by_id(ime_baze, type_id)


def delete_machine_type(ime_baze: str, type_id: int) -> bool:
    """Delete machine type."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM machine_types WHERE id = ?', (type_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0


# Test Summary Functions for Performance Optimization
def update_test_summary(ime_baze: str, test_id: int) -> bool:
    """Update or create summary statistics for a test based on atual data from podatki table."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    try:
        # Get sensor count for this test
        cursor.execute('''
            SELECT COUNT(DISTINCT tr.sensor_id) as sensor_count
            FROM test_relations tr
            WHERE tr.test_id = ?
        ''', (test_id,))
        sensor_count = cursor.fetchone()[0] or 0
        
        # Get data statistics from podatki table
        cursor.execute('''
            SELECT 
                COUNT(p.id) as data_points,
                MIN(p.datetime) as first_data,
                MAX(p.datetime) as last_data
            FROM test_relations tr
            LEFT JOIN podatki p ON tr.id = p.test_relation_id
            WHERE tr.test_id = ?
        ''', (test_id,))
        
        row = cursor.fetchone()
        data_points = row[0] or 0
        first_data = row[1]
        last_data = row[2]
        
        # Calculate test duration in minutes
        test_duration_minutes = 0
        if first_data and last_data:
            try:
                first_dt = datetime.fromisoformat(first_data.replace('Z', '+00:00'))
                last_dt = datetime.fromisoformat(last_data.replace('Z', '+00:00'))
                duration_seconds = (last_dt - first_dt).total_seconds()
                test_duration_minutes = duration_seconds / 60
            except:
                test_duration_minutes = 0
        
        # Upsert summary record
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute('''
            INSERT INTO test_summaries 
            (test_id, sensor_count, data_points, first_data, last_data, test_duration_minutes, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(test_id) DO UPDATE SET
                sensor_count = excluded.sensor_count,
                data_points = excluded.data_points,
                first_data = excluded.first_data,
                last_data = excluded.last_data,
                test_duration_minutes = excluded.test_duration_minutes,
                last_updated = excluded.last_updated
        ''', (test_id, sensor_count, data_points, first_data, last_data, test_duration_minutes, current_time))
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"Error updating test summary for test {test_id}: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def get_test_summary_by_id(ime_baze: str, test_id: int) -> Optional[Dict]:
    """Get cached summary for a specific test."""
    conn = sqlite3.connect(ime_baze)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM test_summaries WHERE test_id = ?', (test_id,))
    summary = cursor.fetchone()
    conn.close()
    
    return dict(summary) if summary else None


def ensure_test_summary_exists(ime_baze: str, test_id: int) -> Dict:
    """Ensure a test summary exists, create/update if missing or outdated."""
    # Check if summary exists and is recent (within last hour)
    summary = get_test_summary_by_id(ime_baze, test_id)
    
    if summary:
        try:
            last_updated = datetime.fromisoformat(summary['last_updated'])
            if (datetime.now() - last_updated).total_seconds() < 3600:  # Less than 1 hour old
                return summary
        except:
            pass  # If parsing fails, update anyway
    
    # Update/create summary
    update_test_summary(ime_baze, test_id)
    return get_test_summary_by_id(ime_baze, test_id) or {}


def rebuild_all_test_summaries(ime_baze: str) -> int:
    """Rebuild summaries for all tests. Use for maintenance or after schema changes."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    # Get all test IDs
    cursor.execute('SELECT id FROM tests')
    test_ids = [row[0] for row in cursor.fetchall()]
    conn.close()
    
    updated_count = 0
    for test_id in test_ids:
        if update_test_summary(ime_baze, test_id):
            updated_count += 1
    
    return updated_count


def delete_test_summary(ime_baze: str, test_id: int) -> bool:
    """Delete summary when test is deleted."""
    conn = sqlite3.connect(ime_baze)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM test_summaries WHERE test_id = ?', (test_id,))
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    
    return success
