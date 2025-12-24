"""
Database package for Gorenje Washing Machine Monitoring System.

This package contains database connection management and all database operation modules.
"""

# Database connection pool (will be initialized by main application)
db_pool = None

# Import all modules and their functions
from . import sensors, sensor_types, machines, machine_types, machine_type_sensor_templates, measurements, mqtt, tests, test_relations, test_segments

# Import specific functions to maintain compatibility
from .sensors import (
    # Async PostgreSQL functions
    get_all_sensors,
    get_sensor_by_id,
    create_sensor,
    update_sensor,
    delete_sensor,

    get_sensors_by_sensor_type,
    mark_sensor_offline,
    get_tests_for_sensor,
)

from .sensor_types import (
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

    get_machines_by_machine_type,
    get_tests_for_machine_id
)

from .machine_types import (
    # Machine types
    get_all_machine_types,
    get_machine_type_by_id,
    create_machine_type,
    update_machine_type,
    delete_machine_type,
)

from .machine_type_sensor_templates import (
    # Machine type sensor templates
    get_templates_by_machine_type,
    get_template_by_id,
    create_template,
    update_template,
    delete_template,
    delete_templates_by_machine_type,
    bulk_update_template_orders,
)

from .tests import (
    get_all_tests,
    get_test_by_id,
    create_test,
    update_test_metadata,
    delete_test,

    start_test,
    stop_test,
)

from .test_relations import (
    get_test_relations,
    add_test_relation,
    delete_test_relation_for_single_relation_id,
    delete_all_test_relations_for_single_test,
    get_test_relation_by_id,
    update_test_relation,
    check_test_relation_has_measurements,
    delete_test_relation_with_measurements,
)

from .mqtt import (
    get_mqtt_config,
    create_mqtt_config,
    update_mqtt_config,
    set_active,
    set_inactive,
)

def set_db_pool(pool):
    """Set the database connection pool for all modules."""
    global db_pool
    db_pool = pool
    
    # Set pool for all database modules
    sensors.set_db_pool(pool)
    sensor_types.set_db_pool(pool)
    machines.set_db_pool(pool)
    machine_types.set_db_pool(pool)
    machine_type_sensor_templates.set_db_pool(pool)
    measurements.set_db_pool(pool)
    mqtt.set_db_pool(pool)
    tests.set_db_pool(pool)
    test_relations.set_db_pool(pool)
    test_segments.set_db_pool(pool)

__all__ = [
    # Core database management
    'db_pool',
    'set_db_pool',
    
    # Module access
    'sensors',
    'sensor_types',
    'machines',
    'machine_types',
    'machine_type_sensor_templates',
    'measurements',
    'mqtt',
    'tests',
    
    # Sensor functions
    'get_all_sensors',
    'get_sensor_by_id',
    'mark_sensor_offline', 
    'create_sensor',
    'update_sensor',
    'delete_sensor',
    'get_sensors_by_sensor_type',
    'get_tests_for_sensor',
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
    'get_machines_by_machine_type',
    'get_tests_for_machine_id',
    'get_templates_by_machine_type',
    'get_template_by_id',
    'create_template',
    'update_template',
    'delete_template',
    'delete_templates_by_machine_type',
    'bulk_update_template_orders',
    
    # Tests functions
    'get_all_tests',
    'get_test_by_id',
    'create_test',
    'update_test_metadata',
    'delete_test',
    'start_test',
    'stop_test',

    # Test relations functions
    'get_test_relations',
    'add_test_relation',
    'delete_test_relation_for_single_relation_id',
    'delete_all_test_relations_for_single_test',
    'get_test_relation_by_id',
    'update_test_relation',
    'check_test_relation_has_measurements',
    'delete_test_relation_with_measurements',
    
    # Measurement functions
    'get_sensor_measurements_avg',
    'insert_measurements',
    
    # MQTT functions
    'get_mqtt_config',
    'create_mqtt_config',
    'update_mqtt_config',
    'set_active',
    'set_inactive'
]