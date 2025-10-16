from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from typing import List, Optional
import json
import os
import time
# TODO: Update MQTT modules to work with new database architecture
# import main_mqtt_listener as mqtt_listener
# import main_mqtt_publisher as mqtt_publisher

class MockMQTTListener:
    mqtt_running = False
    def start_mqtt(self, host=None, port=None): pass
    def stop_mqtt(self): pass
    def start_offline_checker(self): pass

class MockMQTTPublisher:
    def send_config_update(self, sensor_id, settings): pass

mqtt_listener = MockMQTTListener()
mqtt_publisher = MockMQTTPublisher()

from models import (
    Sensor, SensorCreate, SensorUpdate, SensorSettingsUpdate, 
    Test, TestCreate, TestUpdate, TestCreateWithRelations, TestWithRelations,
    TestRelation, TestRelationCreate, MachineUpdateForTest, UpdateRelationsRequest,
    Machine, MachineCreate, MachineUpdate, 
    MachineType, MachineTypeCreate, MachineTypeUpdate,
    Sensor,
    MqttConfig, MqttConfigUpdate,
    SensorType, SensorTypeCreate, SensorTypeUpdate,
)
from database import (
    # Connection management
    set_db_pool,
    
    # Sensor functions
    get_all_sensors, get_sensor_by_id, update_sensor, create_sensor, update_sensor_settings, delete_sensor,
    get_test_relations_for_sensor,
    
    # Sensor types
    get_all_sensor_types, create_sensor_type, get_sensor_type_by_id, update_sensor_type, delete_sensor_type,
    
    # Machine functions  
    get_all_machines, get_machine_by_id, create_machine, update_machine, delete_machine,
    get_all_machine_types, get_machine_type_by_id, create_machine_type, update_machine_type, delete_machine_type,
    
    # Test functions
    get_all_tests, get_test_by_id, create_test, update_test, delete_test,
    get_test_relations, add_test_relation, delete_test_relation, update_test_relation,
    start_test, stop_test, is_sensor_or_machine_available, update_test_machine,
    
    # MQTT functions
    get_mqtt_config, create_mqtt_config, update_mqtt_config,
    
    # Measurement functions
    insert_measurements
)

# Load configuration
base_path = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(base_path, 'config.json')
with open(config_path, 'r') as config_file:
    config = json.load(config_file)

MQTT_BROKER = config['mqtt_broker']
MQTT_PORT = config['mqtt_port']

DATABASE_URL = "postgresql://admin:admin123@timescaledb:5432/long_term_monitoring_db"



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and setup on startup"""
    # Startup - Create connection pool and set it for all database modules
    import asyncpg
    db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)
    set_db_pool(db_pool)
    
    # Add default sensor types first if they don't exist
    default_sensor_types = [
        {
            "sensor_type_name": "Accelerometer",
            "sensor_type_unit": "g",
            "sensor_type_description": "Measures vibration and movement acceleration"
        },
        {
            "sensor_type_name": "Temperature Sensor",
            "sensor_type_unit": "°C",
            "sensor_type_description": "Measures temperature of water or ambient"
        },
        {
            "sensor_type_name": "Distance Sensor",
            "sensor_type_unit": "cm",
            "sensor_type_description": "Measures distance or water level"
        },
        {
            "sensor_type_name": "Current Sensor",
            "sensor_type_unit": "A",
            "sensor_type_description": "Measures electrical current consumption"
        },
        {
            "sensor_type_name": "Flow Sensor",
            "sensor_type_unit": "L/min",
            "sensor_type_description": "Measures water flow rate"
        },
        {
            "sensor_type_name": "Infrared Sensor",
            "sensor_type_unit": "",
            "sensor_type_description": "Detects presence or position using infrared"
        }
    ]
    
    # Create sensor types and get their IDs
    sensor_type_mapping = {}
    existing_sensor_types = await get_all_sensor_types()
    existing_names = [st['sensor_type_name'] for st in existing_sensor_types]
    
    for sensor_type_data in default_sensor_types:
        if sensor_type_data["sensor_type_name"] not in existing_names:
            created_type = await create_sensor_type(sensor_type_data)
            if created_type:
                sensor_type_mapping[sensor_type_data["sensor_type_name"]] = created_type['id']
        else:
            # Find existing type ID
            for st in existing_sensor_types:
                if st['sensor_type_name'] == sensor_type_data["sensor_type_name"]:
                    sensor_type_mapping[sensor_type_data["sensor_type_name"]] = st['id']
                    break

    # Add default sensors if they don't exist
    default_sensors = [
        {
            "sensor_mqtt_topic": "acc_1",
            "sensor_type_id": 0,
            "sensor_name": "Accelerometer 1",
            "sensor_description": "Main washing machine accelerometer"
        },
        {
            "sensor_mqtt_topic": "temp_1",
            "sensor_type_id": 1,
            "sensor_name": "Temperature Sensor 1",
            "sensor_description": "Water temperature sensor"
        },
        {
            "sensor_mqtt_topic": "dist_1",
            "sensor_type_id": 2,
            "sensor_name": "Distance Sensor 1",
            "sensor_description": "Water level measurement"
        },
        {
            "sensor_mqtt_topic": "current_1",
            "sensor_type_id": 3,
            "sensor_name": "Current Sensor 1",
            "sensor_description": "Motor current measurement"
        },
        {
            "sensor_mqtt_topic": "flow_1",
            "sensor_type_id": 4,
            "sensor_name": "Flow Sensor 1",
            "sensor_description": "Water flow measurement"
        },
        {
            "sensor_mqtt_topic": "infra_1",
            "sensor_type_id": 5,
            "sensor_name": "Infrared Sensor 1",
            "sensor_description": "Door position sensor"
        }
    ]
    
    for sensor_data in default_sensors:
        if sensor_data["sensor_type_id"]:
            await create_sensor(sensor_data)

    # Add default machine types if they don't exist
    default_machine_types = [
        {
            "machine_type_name": "Washing Machine",
            "machine_type_description": "Standard household washing machine for cleaning clothes and textiles",
        },
        {
            "machine_type_name": "Dishwasher",
            "machine_type_description": "Automatic dishwashing appliance for cleaning dishes and utensils",
        }
    ]

    existing_machine_types = await get_all_machine_types()
    print("existing_machine_types:", existing_machine_types)
    existing_machine_names = [mt['machine_type_name'] for mt in existing_machine_types]
    
    for machine_type_data in default_machine_types:
        if machine_type_data["machine_type_name"] not in existing_machine_names:
            await create_machine_type(machine_type_data)

        
    default_machines = [
        {
            "machine_name": "machine1",
            "machine_description": "Test Washing Machine 1",
            "machine_type_id": 1
        },
        {
            "machine_name": "machine2", 
            "machine_description": "Test Washing Machine 2",
            "machine_type_id": 1
        }
    ]

    existing_machines = await get_all_machines()
    existing_machine_names = [m['machine_name'] for m in existing_machines]
    for machine_data in default_machines:
        if machine_data["machine_name"] not in existing_machine_names:
            await create_machine(machine_data)

    # # Add default test and test relation if they don't exist
    # default_test = {
    #         "test_name": "Test 1",
    #         "description": "Initial test run",
    #         "status": "idle",
    #         "created_by": "user"
    #     }

    # if not get_all_tests(DATABASE_NAME):
    #     create_test(DATABASE_NAME, default_test)
    #     test_id = get_all_tests(DATABASE_NAME)[0]['id']
    #     machines = get_all_machines(DATABASE_NAME)
    #     sensors = get_all_sensors(DATABASE_NAME)
    #     if machines and sensors:
    #         create_test_relation(
    #             DATABASE_NAME,
    #             test_id,
    #             {"machine_id": machines[0]['id'], "sensor_id": sensors[4]['id']}
    #             )


    # # Add default MQTT config if it doesn't exist
    # default_mqtt_config = {
    #     "broker_host": MQTT_BROKER,
    #     "broker_port": MQTT_PORT,
    #     "username": "",
    #     "password": "",
    # }

    # if not get_mqtt_config(DATABASE_NAME):
    #     create_mqtt_config(DATABASE_NAME, default_mqtt_config)
    
    # # Add default sensor types if they don't exist
    # default_sensor_types = [
    #     {
    #         "display_name": "Accelerometer",
    #         "description": "Measures vibration and movement acceleration",
    #         "unit": "g"
    #     },
    #     {
    #         "display_name": "Temperature Sensor",
    #         "description": "Measures temperature of water or ambient",
    #         "unit": "°C"
    #     },
    #     {
    #         "display_name": "Distance/Ultrasonic Sensor",
    #         "description": "Measures distance or water level",
    #         "unit": "cm"
    #     },
    #     {
    #         "display_name": "Current Sensor", 
    #         "description": "Measures electrical current consumption",
    #         "unit": "A"
    #     },
    #     {
    #         "display_name": "Water Flow Sensor",
    #         "description": "Measures water flow rate",
    #         "unit": "L/min"
    #     },
    #     {
    #         "display_name": "Infrared Sensor",
    #         "description": "Detects presence or position using infrared",
    #         "unit": ""
    #     }
    # ]
    
    # existing_sensor_types = get_all_sensor_types(DATABASE_NAME)
    # existing_topics = [st['mqtt_topic'] for st in existing_sensor_types]
    
    # for sensor_type_data in default_sensor_types:
    #     if sensor_type_data["mqtt_topic"] not in existing_topics:
    #         create_sensor_type(DATABASE_NAME, sensor_type_data)

    # # Try to start MQTT connection, but don't fail if broker is not available
    # if not mqtt_listener.mqtt_running:
    #     try:
    #         print(f"Attempting to connect to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
    #         mqtt_listener.start_mqtt(MQTT_BROKER, MQTT_PORT)
    #         mqtt_listener.start_offline_checker(DATABASE_NAME)
    #         print("MQTT broker connected successfully.")
    #     except Exception as e:
    #         print(f"Warning: Could not connect to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
    #         print(f"MQTT Error: {e}")
    #         print("Server will start without MQTT functionality. You can configure MQTT later.")
    
    yield
    # Shutdown
    try:
        if mqtt_listener.mqtt_running:
            mqtt_listener.stop_mqtt()
            time.sleep(1)
        # Close database connection pool
        if db_pool:
            await db_pool.close()
    except Exception as e:
        print(f"Error during shutdown: {e}")



app = FastAPI(
    title="Washing Machine Monitoring API", 
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Sensor endpoints
@app.get("/api/sensors", response_model=List[Sensor])
async def get_sensors():
    """Get all sensors"""
    sensors = await get_all_sensors()
    return sensors


@app.get("/api/sensor-types", response_model=List[SensorType])
async def get_sensor_types_for_sensors():
    """Get all sensor types for sensor selection"""
    return await get_all_sensor_types()


@app.get("/api/sensors/{sensor_id}", response_model=Sensor)
async def get_sensor(sensor_id: int):
    """Get a specific sensor"""
    sensor = await get_sensor_by_id(sensor_id)
    print(sensor)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return sensor


@app.post("/api/sensors", response_model=dict)
async def add_sensor(sensor: SensorCreate):
    """Create a new sensor"""
    created_sensor = await create_sensor(sensor.model_dump())
    if not created_sensor:
        raise HTTPException(status_code=400, detail="Sensor with this ID already exists")
    return {"message": "Sensor created successfully"}


@app.put("/api/sensors/{sensor_id}", response_model=dict)
async def modify_sensor(sensor_id: int, sensor: SensorUpdate):
    """Update a sensor"""
    success = await update_sensor(sensor_id, sensor.model_dump())
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return {"message": "Sensor updated successfully"}


@app.put("/api/sensors/{sensor_id}/settings", response_model=dict)
async def modify_sensor_settings(sensor_id: int, sensor: SensorSettingsUpdate):
    """Update sensor sensor_settings and notify via MQTT"""
    success = await update_sensor_settings(sensor_id, sensor.sensor_settings)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    mqtt_publisher.send_config_update(sensor_id, sensor.sensor_settings)
    return {"message": "Sensor updated successfully"}


@app.delete("/api/sensors/{sensor_id}", response_model=dict)
async def remove_sensor(sensor_id: int):
    """Delete a sensor only if it has no test relations"""
    relations = await get_test_relations_for_sensor(sensor_id)
    if relations:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete sensor with existing test relations"
            )
    success = await delete_sensor(sensor_id)
    print(success)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return {"message": "Sensor deleted successfully"}


# Test endpoints
@app.get("/api/tests", response_model=List[Test])
async def get_tests():
    """Get all tests"""
    tests = await get_all_tests()
    return tests


@app.get("/api/tests/{test_id}", response_model=Test)
async def get_test(test_id: int):
    """Get a specific test"""
    test = await get_test_by_id(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test


@app.post("/api/tests", response_model=dict)
async def add_test(test: TestCreate):
    """Create a new test"""
    success = await create_test(test.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail="Test with this name already exists")
    return {"message": "Test created successfully"}


@app.post("/api/tests/create-with-relations", response_model=dict)
async def add_test_with_relations(test_data: TestCreateWithRelations):
    """Create a new test with machine and sensor relations in one operation"""
    # First create the test
    success = await create_test(test_data.test.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail="Test with this name already exists")
    
    # Get the created test to find its ID
    created_test = None
    tests = await get_all_tests()
    for test in tests:
        if test['test_name'] == test_data.test.test_name:
            created_test = test
            break
    
    if not created_test:
        raise HTTPException(status_code=500, detail="Failed to retrieve created test")
    
    test_id = created_test['id']
    
    try:
        # Create relations for each sensor
        for sensor_info in test_data.sensors:
            # Check if sensor or machine is available
            if not await is_sensor_or_machine_available(sensor_info.sensor_id, test_data.machine_id):
                # Clean up: delete the test we just created
                await delete_test(test_id)
                raise HTTPException(
                    status_code=400, 
                    detail="Sensor or Machine is currently used by another running test"
                )
            
            # Create the relation
            relation_data = {
                'sensor_id': sensor_info.sensor_id,
                'machine_id': test_data.machine_id,
                'sensor_location': sensor_info.sensor_location
            }
            relation_success = await add_test_relation(test_id, relation_data)
            if not relation_success:
                # Clean up: delete the test we just created
                await delete_test(test_id)
                raise HTTPException(status_code=400, detail="Failed to create sensor relation")
    
    except Exception as e:
        # Clean up: delete the test we just created
        await delete_test(test_id)
        raise e
    
    return {"message": "Test created with relations successfully", "test_id": test_id}


@app.put("/api/tests/{test_id}", response_model=dict)
async def modify_test(test_id: int, test: TestUpdate):
    """Update a test"""
    success = await update_test(test_id, test.model_dump())
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"message": "Test updated successfully"}


@app.post("/api/tests/{test_id}/start", response_model=dict)
async def begin_test(test_id: int):
    """Start a test, only if it has at least one sensor and machine connected"""
    relations = await get_test_relations(test_id)
    if not relations:
        raise HTTPException(
            status_code=400, 
            detail="Cannot start test: no sensors or machines connected"
            )
    success = await start_test(test_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to start test: already running or completed")
    return {"message": "Test started successfully"}


@app.post("/api/tests/{test_id}/stop", response_model=dict)
async def end_test(test_id: int):
    """Stop a test"""
    success = await stop_test(test_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"message": "Test stopped successfully"}


@app.delete("/api/tests/{test_id}", response_model=dict)
async def remove_test(test_id: int):
    """Delete a test and all its related data"""
    success = await delete_test(test_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"message": "Test and related data deleted successfully"}


# Test relations endpoints
@app.get("/api/tests/{test_id}/relations", response_model=List[TestRelation])
async def get_relations(test_id: int):
    return await get_test_relations(test_id)


@app.get("/api/tests/{test_id}/with-relations", response_model=dict)
async def get_test_with_relations(test_id: int):
    """Get test details with machine and sensor relations"""
    # Get test details
    test = await get_test_by_id(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Get relations
    relations = await get_test_relations(test_id)
    
    # Extract machine_id and sensors from relations
    machine_id = None
    sensors = []
    
    for relation in relations:
        if relation['machine_id'] and not machine_id:
            machine_id = relation['machine_id']
        
        sensors.append({
            'sensor_id': relation['sensor_id'],
            'sensor_location': relation.get('sensor_location') or ''
        })
    
    # Create response with flattened structure for frontend compatibility
    response_data = {
        **test,  # Spread all test fields at the top level
        'machine_id': machine_id,
        'sensors': sensors
    }
    
    return response_data


@app.post("/api/tests/{test_id}/relations", response_model=dict)
async def add_relation(test_id: int, relation: TestRelationCreate):
    """Create a new test relation only if the test is idle and sensor/machine are available"""
    test = await get_test_by_id(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    if test['status'] != 'idle':
        raise HTTPException(
            status_code=400, 
            detail="Can only add relations to idle tests"
            )
    if not await is_sensor_or_machine_available(relation.sensor_id, relation.machine_id):
        raise HTTPException(
            status_code=400, 
            detail="Sensor or Machine is currently used by another running test"
            )
    success = await add_test_relation(test_id, relation.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail="Failed to create relation")
    return {"message": "Relation created successfully"}


@app.delete("/api/tests/{test_id}/relations/{relation_id}", response_model=dict)
async def remove_relation(test_id: int, relation_id: int):
    success = await delete_test_relation(relation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Relation not found")
    return {"message": "Relation deleted successfully"}


@app.put("/api/tests/{test_id}/relations", response_model=dict)
async def update_test_relations(test_id: int, relations_update: UpdateRelationsRequest):
    """Update all relations for a test - replaces existing relations with new ones"""
    # Check if test exists and is idle
    test = await get_test_by_id(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    if test['status'] != 'idle':
        raise HTTPException(
            status_code=400, 
            detail="Can only update relations for idle tests"
        )
    
    # Get current relations to delete them first
    current_relations = await get_test_relations(test_id)
    
    # Delete all current relations first to free up resources
    for relation in current_relations:
        await delete_test_relation(relation['id'])
    
    # Now check if sensor or machine is available
    for sensor_info in relations_update.sensors:
        if not await is_sensor_or_machine_available(sensor_info.sensor_id, relations_update.machine_id):
            # If not available, we need to restore the old relations and fail
            # For now, just fail - the old relations are already deleted
            raise HTTPException(
                status_code=400, 
                detail=f"Sensor {sensor_info.sensor_id} or Machine {relations_update.machine_id} is currently used by another running test"
            )
    
    # Create new relations
    for sensor_info in relations_update.sensors:
        relation_data = {
            'sensor_id': sensor_info.sensor_id,
            'machine_id': relations_update.machine_id,
            'sensor_location': sensor_info.sensor_location
        }
        success = await add_test_relation(test_id, relation_data)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to create new relations")
    
    return {"message": "Relations updated successfully"}


@app.put("/api/tests/{test_id}/relations/machine", response_model=dict)
async def change_machine(test_id: int, update: MachineUpdateForTest):
    success = await update_test_machine(test_id, update.machine_id)
    if not success:
        raise HTTPException(status_code=404, detail="No relations found for this test")
    return {"message": "Machine updated successfully"}


# Washing machines endpoints
@app.get("/api/machines", response_model=List[Machine])
async def get_machines():
    """Get all washing machines"""
    machines = await get_all_machines()
    return machines


@app.get("/api/machine-types", response_model=List[MachineType])
async def get_machine_types_for_machines():
    """Get all machine types for machine selection"""
    return await get_all_machine_types()


@app.get("/api/machines/{machine_id}", response_model=Machine)
async def get_machine(machine_id: int):
    """Get a specific washing machine"""
    machine = await get_machine_by_id(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Washing Machine not found")
    return machine


@app.post("/api/machines", response_model=dict)
async def add_machine(machine: MachineCreate):
    """Create a new washing machine"""
    success = await create_machine(machine.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail="Washing Machine with this ID already exists")
    return {"message": "Washing Machine created successfully"}


@app.put("/api/machines/{machine_id}", response_model=dict)
async def modify_machine(machine_id: int, machine: MachineUpdate):
    """Update a washing machine"""
    success = await update_machine(machine_id, machine.model_dump())
    if not success:
        raise HTTPException(status_code=404, detail="Washing Machine not found")
    return {"message": "Washing Machine updated successfully"}


@app.delete("/api/machines/{machine_id}", response_model=dict)
async def remove_machine(machine_id: int):
    """Delete a washing machine only if it has no test relations"""
    # Note: Need to implement get_test_relations_for_machine function
    # For now, just try to delete the machine
    success = await delete_machine(machine_id)
    if not success:
        raise HTTPException(status_code=404, detail="Washing Machine not found")
    return {"message": "Washing Machine deleted successfully"}


# Data endpoints  
@app.get("/api/tests/{test_id}/data", response_model=List[Sensor])
async def get_test_data(
    test_id: int,
    sensor_id: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
):
    """Get sensor data for a test"""
    # TODO: Implement get_sensor_data function in measurements module
    return []


# MQTT Control endpoints
@app.post("/api/mqtt/start", response_model=dict)
async def start_mqtt_listener():
    """Start MQTT data collection"""    
    if mqtt_listener.mqtt_running:
        return {"message": "MQTT listener is already running"}
    mqtt_listener.start_mqtt()
    # TODO: Update offline checker to work with new database structure
    # mqtt_listener.start_offline_checker()
    return {"message": "MQTT listener started successfully"}


@app.post("/api/mqtt/stop", response_model=dict)
async def stop_mqtt_listener():
    """Stop MQTT data collection"""
    if not mqtt_listener.mqtt_running:
        return {"message": "MQTT listener is not running"}
    mqtt_listener.stop_mqtt()
    return {"message": "MQTT listener stopped successfully"}


@app.get("/api/mqtt/status", response_model=dict)
async def get_mqtt_status():
    """Get MQTT listener status"""
    return {"running": mqtt_listener.mqtt_running}


# System endpoints
@app.get("/api/status", response_model=dict)
async def get_system_status():
    """Get system status"""
    sensors = await get_all_sensors()
    tests = await get_all_tests()
    
    return {
        "database": "PostgreSQL",
        "sensors_count": len(sensors),
        "tests_count": len(tests),
        "mqtt_status": mqtt_listener.mqtt_running,
        "mqtt_broker": MQTT_BROKER
    }


# Settings endpoints
@app.get("/api/settings/mqtt-config", response_model=MqttConfig)
async def get_mqtt_config_endpoint():
    """Get all MQTT configurations"""
    config = await get_mqtt_config()
    if not config:
        raise HTTPException(status_code=404, detail="MQTT configuration not found")
    return config


@app.post("/api/settings/mqtt-config", response_model=MqttConfig)
async def create_mqtt_config_endpoint(config: MqttConfigUpdate):
    """Create or update MQTT configuration"""
    config_dict = {k: v for k, v in config.model_dump().items() if v is not None}
    
    # Check if config already exists
    existing_config = await get_mqtt_config()
    if existing_config:
        # If config exists, update it instead
        result = await update_mqtt_config(config_dict)
        if not result:
            raise HTTPException(status_code=404, detail="MQTT configuration not found")
    else:
        # Create new config
        result = await create_mqtt_config(config_dict)
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create MQTT configuration")
    
    try:
        if mqtt_listener.mqtt_running:
            mqtt_listener.stop_mqtt()
            time.sleep(1)
        mqtt_listener.start_mqtt(result['broker_host'], result['broker_port'])
        # TODO: Update offline checker to work with new database structure
        # mqtt_listener.start_offline_checker()
        
    except Exception as e:
        print(f"Warning: Failed to restart MQTT listener: {e}")
        # Don't raise an exception here, just log the warning
    
    return result


@app.put("/api/settings/mqtt-config", response_model=MqttConfig)
async def update_mqtt_config_endpoint(config: MqttConfigUpdate):
    """Update MQTT configuration"""
    config_dict = {k: v for k, v in config.model_dump().items() if v is not None}
    result = await update_mqtt_config(config_dict)
    if not result:
        raise HTTPException(status_code=404, detail="MQTT configuration not found")
    
    try:
        if mqtt_listener.mqtt_running:
            mqtt_listener.stop_mqtt()
            time.sleep(1)
        mqtt_listener.start_mqtt(result['broker_host'], result['broker_port'])
        # TODO: Update offline checker to work with new database structure
        # mqtt_listener.start_offline_checker()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restart MQTT listener: {e}")

    return result


# @app.delete("/api/settings/mqtt-configs/{config_id}")
# async def delete_mqtt_config_endpoint(config_id: int):
#     """Delete MQTT configuration"""
#     success = delete_mqtt_config(DATABASE_NAME, config_id)
#     if not success:
#         raise HTTPException(status_code=404, detail="MQTT configuration not found")
#     return {"message": "MQTT configuration deleted successfully"}

@app.get("/api/settings/sensor-types", response_model=List[SensorType])
async def get_sensor_types():
    """Get all sensor types"""
    return await get_all_sensor_types()


@app.post("/api/settings/sensor-types", response_model=SensorType)
async def create_sensor_type_endpoint(sensor_type: SensorTypeCreate):
    """Create a new sensor type"""
    sensor_type_dict = sensor_type.model_dump()
    return await create_sensor_type(sensor_type_dict)


@app.put("/api/settings/sensor-types/{type_id}", response_model=SensorType)
async def update_sensor_type_endpoint(type_id: int, sensor_type: SensorTypeUpdate):
    """Update sensor type"""
    sensor_type_dict = {k: v for k, v in sensor_type.model_dump().items() if v is not None}
    result = await update_sensor_type(type_id, sensor_type_dict)
    if not result:
        raise HTTPException(status_code=404, detail="Sensor type not found")
    return result


@app.delete("/api/settings/sensor-types/{type_id}")
async def delete_sensor_type_endpoint(type_id: int):
    """Delete sensor type"""
    success = await delete_sensor_type(type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor type not found")
    return {"message": "Sensor type deleted successfully. Related sensors marked as inactive."}


# Machine Types endpoints
@app.get("/api/settings/machine-types", response_model=List[MachineType])
async def get_machine_types():
    """Get all machine types"""
    return await get_all_machine_types()


@app.get("/api/settings/machine-types/{type_id}", response_model=MachineType)
async def get_machine_type(type_id: int):
    """Get machine type by ID"""
    machine_type = await get_machine_type_by_id(type_id)
    if not machine_type:
        raise HTTPException(status_code=404, detail="Machine type not found")
    return machine_type


@app.post("/api/settings/machine-types", response_model=dict)
async def create_machine_type_endpoint(machine_type: MachineTypeCreate):
    """Create new machine type"""
    result = await create_machine_type(machine_type.model_dump())
    return {"message": "Machine type created successfully", "machine_type": result}


@app.put("/api/settings/machine-types/{type_id}", response_model=dict)
async def update_machine_type_endpoint(type_id: int, machine_type: MachineTypeUpdate):
    """Update machine type"""
    result = await update_machine_type(type_id, machine_type.dict(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Machine type not found")
    return {"message": "Machine type updated successfully", "machine_type": result}


@app.delete("/api/settings/machine-types/{type_id}")
async def delete_machine_type_endpoint(type_id: int):
    """Delete machine type"""
    success = await delete_machine_type(type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Machine type not found")
    return {"message": "Machine type deleted successfully"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Washing Machine Monitoring API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=True)
