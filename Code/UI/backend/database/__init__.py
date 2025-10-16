"""
Database package for Gorenje Washing Machine Monitoring System.

This package contains database connection management and all database operation modules.
"""

# Database connection pool (will be initialized by main application)
db_pool = None

# Import all modules and their functions
from . import sensors, machines, measurements, mqtt, tests

# Import specific functions to maintain compatibility
from .sensors import (
    # Async PostgreSQL functions
    get_all_sensors,
    get_sensor_by_id,
    mark_sensor_offline,
    create_sensor,
    update_sensor,
    update_sensor_settings,
    delete_sensor,
    get_test_relations_for_sensor,
    
    # Sensor types
    get_all_sensor_types,
    get_sensor_type_by_id,
    create_sensor_type,
    update_sensor_type,
    delete_sensor_type,
)

from .machines import (
    get_all_machines,
    get_machine_by_id,
    create_machine,
    update_machine,
    delete_machine,
    
    # Machine types
    get_all_machine_types,
    get_machine_type_by_id,
    create_machine_type,
    update_machine_type,
    delete_machine_type,
)

from .tests import (
    get_all_tests,
    get_test_by_id,
    create_test,
    update_test,
    delete_test,
    get_test_relations,
    add_test_relation,
    delete_test_relation,
    get_test_relation_by_id,
    update_test_relation,
    start_test,
    stop_test,
    is_sensor_or_machine_available,
    update_test_machine,
)

from .measurements import (
    get_sensor_measurements_avg,
    insert_measurements,
)

from .mqtt import (
    get_mqtt_config,
    create_mqtt_config,
    update_mqtt_config,
    sync_mqtt_active_state,
)

def set_db_pool(pool):
    """Set the database connection pool for all modules."""
    global db_pool
    db_pool = pool
    
    # Set pool for all database modules
    sensors.set_db_pool(pool)
    machines.set_db_pool(pool)
    measurements.set_db_pool(pool)
    mqtt.set_db_pool(pool)
    tests.set_db_pool(pool)

__all__ = [
    # Core database management
    'db_pool',
    'set_db_pool',
    
    # Module access
    'sensors',
    'machines', 
    'measurements',
    'mqtt',
    'tests',
    
    # Sensor functions
    'get_all_sensors',
    'get_sensor_by_id',
    'mark_sensor_offline', 
    'create_sensor',
    'update_sensor',
    'update_sensor_settings',
    'delete_sensor',
    'get_test_relations_for_sensor',
    'get_all_sensor_types',
    'get_sensor_type_by_id',
    'create_sensor_type',
    'update_sensor_type',
    'delete_sensor_type',
    
    # Machine functions
    'get_all_machines',
    'get_machine_by_id',
    'create_machine',
    'update_machine', 
    'delete_machine',
    'get_all_machine_types',
    'get_machine_type_by_id',
    'create_machine_type',
    'update_machine_type',
    'delete_machine_type',
    
    # Test functions
    'get_all_tests',
    'get_test_by_id',
    'create_test',
    'update_test',
    'delete_test',
    'get_test_relations',
    'add_test_relation',
    'delete_test_relation',
    'get_test_relation_by_id',
    'update_test_relation',
    'start_test',
    'stop_test',
    'is_sensor_or_machine_available',
    'update_test_machine',
    
    # Measurement functions
    'get_sensor_measurements_avg',
    'insert_measurements',
    
    # MQTT functions
    'get_mqtt_config',
    'create_mqtt_config',
    'update_mqtt_config',
    'sync_mqtt_active_state',
]