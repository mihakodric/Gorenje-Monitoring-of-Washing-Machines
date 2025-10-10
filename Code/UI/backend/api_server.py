from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from typing import List, Optional
import json
import os
import time
import main_mqtt_listener as mqtt_listener
import main_mqtt_publisher as mqtt_publisher

from models import (
    Sensor, SensorCreate, SensorUpdate, SensorSettingsUpdate, 
    Test, TestCreate, TestUpdate, TestCreateWithRelations, TestWithRelations,
    TestRelation, TestRelationCreate, MachineUpdateForTest, UpdateRelationsRequest,
    Machine, MachineCreate, MachineUpdate, 
    MachineType, MachineTypeCreate, MachineTypeUpdate,
    SensorData, TestSummary,
    MqttConfig, MqttConfigUpdate,
    SensorType, SensorTypeCreate, SensorTypeUpdate,
)
from database import (
    ustvari_sql_bazo,
    get_all_sensors, get_sensor_by_id, create_sensor, update_sensor, update_sensor_settings, delete_sensor,
    get_all_tests, get_test_by_id, create_test, update_test, start_test, stop_test, delete_test,
    get_sensor_data, get_test_summary,
    get_test_relations, create_test_relation, delete_test_relation, update_test_machine,
    get_test_relations_for_sensor, get_test_relations_for_machine, is_sensor_or_machine_available, 
    get_mqtt_config, create_mqtt_config, update_mqtt_config,
    get_all_sensor_types, create_sensor_type, get_sensor_type_by_id, update_sensor_type, delete_sensor_type,
    get_all_machines, get_machine_by_id, create_machine, update_machine, delete_machine,
    get_all_machine_types, get_machine_type_by_id, create_machine_type, update_machine_type, delete_machine_type
)

# Load configuration
base_path = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(base_path, 'config.json')
with open(config_path, 'r') as config_file:
    config = json.load(config_file)

DATABASE_NAME = config['ime_baze']
MQTT_BROKER = config['mqtt_broker']
MQTT_PORT = config['mqtt_port']



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and setup on startup"""
    # Startup
    ustvari_sql_bazo(DATABASE_NAME)
    
    # Add default sensors if they don't exist
    default_sensors = [
        {
            "sensor_id": "acc_1",
            "sensor_type": "acceleration",
            "sensor_name": "Accelerometer 1",
            "description": "Main washing machine accelerometer",
            "location": "Machine body",
            "mqtt_topic": "acceleration"
        },
        {
            "sensor_id": "temp_1",
            "sensor_type": "temperature",
            "sensor_name": "Temperature Sensor 1",
            "description": "Water temperature sensor",
            "location": "Water inlet",
            "mqtt_topic": "temperature"
        },
        {
            "sensor_id": "dist_1",
            "sensor_type": "distance",
            "sensor_name": "Distance Sensor 1",
            "description": "Water level measurement",
            "location": "Water tank",
            "mqtt_topic": "distance"
        },
        {
            "sensor_id": "current_1",
            "sensor_type": "current",
            "sensor_name": "Current Sensor 1",
            "description": "Motor current measurement",
            "location": "Motor",
            "mqtt_topic": "current"
        },
        {
            "sensor_id": "flow_1",
            "sensor_type": "water_flow",
            "sensor_name": "Flow Sensor 1",
            "description": "Water flow measurement",
            "location": "Water pipe",
            "mqtt_topic": "water_flow"
        },
        {
            "sensor_id": "infra_1",
            "sensor_type": "infrared",
            "sensor_name": "Infrared Sensor 1",
            "description": "Door position sensor",
            "location": "Door",
            "mqtt_topic": "infrared"
        }
    ]
    
    for sensor_data in default_sensors:
        if not get_sensor_by_id(DATABASE_NAME, sensor_data["sensor_id"]):
            create_sensor(DATABASE_NAME, sensor_data)     

    # Add default machine types if they don't exist
    default_machine_types = [
        {
            "display_name": "Washing Machine",
            "description": "Standard household washing machine for cleaning clothes and textiles",
            "created_by": "system"
        },
        {
            "display_name": "Dishwasher",
            "description": "Automatic dishwashing appliance for cleaning dishes and utensils",
            "created_by": "system"
        }
    ]
    
    existing_machine_types = get_all_machine_types(DATABASE_NAME)
    existing_machine_names = [mt['display_name'] for mt in existing_machine_types]
    
    for machine_type_data in default_machine_types:
        if machine_type_data["display_name"] not in existing_machine_names:
            create_machine_type(DATABASE_NAME, machine_type_data)

    # Add default washing machines, if they don't exist
    if not get_all_machines(DATABASE_NAME):
        # Get the first machine type (washing machine) for default assignment
        machine_types = get_all_machine_types(DATABASE_NAME)
        washing_machine_type_id = None
        if machine_types:
            for mt in machine_types:
                if "washing" in mt['display_name'].lower():
                    washing_machine_type_id = mt['id']
                    break
            if not washing_machine_type_id:
                washing_machine_type_id = machine_types[0]['id']
        
        default_machines = [
            {
                "machine_name": "machine1",
                "description": "Test Washing Machine 1",
                "machine_type_id": washing_machine_type_id
            },
            {
                "machine_name": "machine2", 
                "description": "Test Washing Machine 2",
                "machine_type_id": washing_machine_type_id
            }
        ]

        for machine_data in default_machines:
            create_machine(DATABASE_NAME, machine_data)

    # Add default test and test relation if they don't exist
    default_test = {
            "test_name": "Test 1",
            "description": "Initial test run",
            "status": "idle",
            "created_by": "user"
        }

    if not get_all_tests(DATABASE_NAME):
        create_test(DATABASE_NAME, default_test)
        test_id = get_all_tests(DATABASE_NAME)[0]['id']
        machines = get_all_machines(DATABASE_NAME)
        sensors = get_all_sensors(DATABASE_NAME)
        if machines and sensors:
            create_test_relation(
                DATABASE_NAME,
                test_id,
                {"machine_id": machines[0]['id'], "sensor_id": sensors[4]['id']}
                )


    # Add default MQTT config if it doesn't exist
    default_mqtt_config = {
        "broker_host": MQTT_BROKER,
        "broker_port": MQTT_PORT,
        "username": "",
        "password": "",
    }

    if not get_mqtt_config(DATABASE_NAME):
        create_mqtt_config(DATABASE_NAME, default_mqtt_config)
    
    # Add default sensor types if they don't exist
    default_sensor_types = [
        {
            "mqtt_topic": "acceleration",
            "display_name": "Accelerometer",
            "description": "Measures vibration and movement acceleration",
            "unit": "g"
        },
        {
            "mqtt_topic": "temperature", 
            "display_name": "Temperature Sensor",
            "description": "Measures temperature of water or ambient",
            "unit": "°C"
        },
        {
            "mqtt_topic": "distance",
            "display_name": "Distance/Ultrasonic Sensor",
            "description": "Measures distance or water level",
            "unit": "cm"
        },
        {
            "mqtt_topic": "current",
            "display_name": "Current Sensor", 
            "description": "Measures electrical current consumption",
            "unit": "A"
        },
        {
            "mqtt_topic": "water_flow",
            "display_name": "Water Flow Sensor",
            "description": "Measures water flow rate",
            "unit": "L/min"
        },
        {
            "mqtt_topic": "infrared",
            "display_name": "Infrared Sensor",
            "description": "Detects presence or position using infrared",
            "unit": ""
        }
    ]
    
    existing_sensor_types = get_all_sensor_types(DATABASE_NAME)
    existing_topics = [st['mqtt_topic'] for st in existing_sensor_types]
    
    for sensor_type_data in default_sensor_types:
        if sensor_type_data["mqtt_topic"] not in existing_topics:
            create_sensor_type(DATABASE_NAME, sensor_type_data)

    # Try to start MQTT connection, but don't fail if broker is not available
    if not mqtt_listener.mqtt_running:
        try:
            print(f"Attempting to connect to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
            mqtt_listener.start_mqtt(MQTT_BROKER, MQTT_PORT)
            mqtt_listener.start_offline_checker(DATABASE_NAME)
            print("MQTT broker connected successfully.")
        except Exception as e:
            print(f"Warning: Could not connect to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
            print(f"MQTT Error: {e}")
            print("Server will start without MQTT functionality. You can configure MQTT later.")
    
    yield
    # Shutdown
    try:
        if mqtt_listener.mqtt_running:
            mqtt_listener.stop_mqtt()
            time.sleep(1)
    except Exception as e:
        print(f"Error stopping MQTT listener on shutdown: {e}")



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
    sensors = get_all_sensors(DATABASE_NAME)
    return sensors


@app.get("/api/sensor-types", response_model=List[SensorType])
async def get_sensor_types_for_sensors():
    """Get all sensor types for sensor selection"""
    return get_all_sensor_types(DATABASE_NAME)


@app.get("/api/sensors/{sensor_id}", response_model=Sensor)
async def get_sensor(sensor_id: str):
    """Get a specific sensor"""
    sensor = get_sensor_by_id(DATABASE_NAME, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return sensor


@app.post("/api/sensors", response_model=dict)
async def add_sensor(sensor: SensorCreate):
    """Create a new sensor"""
    success = create_sensor(DATABASE_NAME, sensor.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail="Sensor with this ID already exists")
    return {"message": "Sensor created successfully"}


@app.put("/api/sensors/{sensor_id}", response_model=dict)
async def modify_sensor(sensor_id: str, sensor: SensorUpdate):
    """Update a sensor"""
    success = update_sensor(DATABASE_NAME, sensor_id, sensor.model_dump())
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return {"message": "Sensor updated successfully"}


@app.put("/api/sensors/{sensor_id}/settings", response_model=dict)
async def modify_sensor_settings(sensor_id: str, sensor: SensorSettingsUpdate):
    """Update sensor settings"""
    success = update_sensor_settings(DATABASE_NAME, sensor_id, sensor.settings)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    mqtt_publisher.send_config_update(sensor_id, sensor.settings)
    return {"message": "Sensor updated successfully"}


@app.delete("/api/sensors/{sensor_id}", response_model=dict)
async def remove_sensor(sensor_id: str):
    """Delete a sensor only if it has no test relations"""
    relations = get_test_relations_for_sensor(DATABASE_NAME, sensor_id)
    if relations:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete sensor with existing test relations"
            )
    success = delete_sensor(DATABASE_NAME, sensor_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return {"message": "Sensor deleted successfully"}


# Test endpoints
@app.get("/api/tests", response_model=List[Test])
async def get_tests():
    """Get all tests"""
    tests = get_all_tests(DATABASE_NAME)
    return tests


@app.get("/api/tests/{test_id}", response_model=Test)
async def get_test(test_id: int):
    """Get a specific test"""
    test = get_test_by_id(DATABASE_NAME, test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test


@app.post("/api/tests", response_model=dict)
async def add_test(test: TestCreate):
    """Create a new test"""
    success = create_test(DATABASE_NAME, test.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail="Test with this name already exists")
    return {"message": "Test created successfully"}


@app.post("/api/tests/create-with-relations", response_model=dict)
async def add_test_with_relations(test_data: TestCreateWithRelations):
    """Create a new test with machine and sensor relations in one operation"""
    # First create the test
    success = create_test(DATABASE_NAME, test_data.test.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail="Test with this name already exists")
    
    # Get the created test to find its ID
    created_test = None
    tests = get_all_tests(DATABASE_NAME)
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
            if not is_sensor_or_machine_available(DATABASE_NAME, sensor_info.sensor_id, test_data.machine_id):
                # Clean up: delete the test we just created
                delete_test(DATABASE_NAME, test_id)
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
            relation_success = create_test_relation(DATABASE_NAME, test_id, relation_data)
            if not relation_success:
                # Clean up: delete the test we just created
                delete_test(DATABASE_NAME, test_id)
                raise HTTPException(status_code=400, detail="Failed to create sensor relation")
    
    except Exception as e:
        # Clean up: delete the test we just created
        delete_test(DATABASE_NAME, test_id)
        raise e
    
    return {"message": "Test created with relations successfully", "test_id": test_id}


@app.put("/api/tests/{test_id}", response_model=dict)
async def modify_test(test_id: int, test: TestUpdate):
    """Update a test"""
    success = update_test(DATABASE_NAME, test_id, test.model_dump())
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"message": "Test updated successfully"}


@app.post("/api/tests/{test_id}/start", response_model=dict)
async def begin_test(test_id: int):
    """Start a test, only if it has at least one sensor and machine connected"""
    relations = get_test_relations(DATABASE_NAME, test_id)
    if not relations:
        raise HTTPException(
            status_code=400, 
            detail="Cannot start test: no sensors or machines connected"
            )
    success = start_test(DATABASE_NAME, test_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to start test: already running or completed")
    return {"message": "Test started successfully"}


@app.post("/api/tests/{test_id}/stop", response_model=dict)
async def end_test(test_id: int):
    """Stop a test"""
    success = stop_test(DATABASE_NAME, test_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"message": "Test stopped successfully"}


@app.delete("/api/tests/{test_id}", response_model=dict)
async def remove_test(test_id: int):
    """Delete a test and all its related data"""
    success = delete_test(DATABASE_NAME, test_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"message": "Test and related data deleted successfully"}


# Test relations endpoints
@app.get("/api/tests/{test_id}/relations", response_model=List[TestRelation])
async def get_relations(test_id: int):
    return get_test_relations(DATABASE_NAME, test_id)


@app.get("/api/tests/{test_id}/with-relations", response_model=dict)
async def get_test_with_relations(test_id: int):
    """Get test details with machine and sensor relations"""
    # Get test details
    test = get_test_by_id(DATABASE_NAME, test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Get relations
    relations = get_test_relations(DATABASE_NAME, test_id)
    
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
    test = get_test_by_id(DATABASE_NAME, test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    if test['status'] != 'idle':
        raise HTTPException(
            status_code=400, 
            detail="Can only add relations to idle tests"
            )
    if not is_sensor_or_machine_available(DATABASE_NAME, relation.sensor_id, relation.machine_id):
        raise HTTPException(
            status_code=400, 
            detail="Sensor or Machine is currently used by another running test"
            )
    success = create_test_relation(DATABASE_NAME, test_id, relation.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail="Failed to create relation")
    return {"message": "Relation created successfully"}


@app.delete("/api/tests/{test_id}/relations/{relation_id}", response_model=dict)
async def remove_relation(test_id: int, relation_id: int):
    success = delete_test_relation(DATABASE_NAME, relation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Relation not found")
    return {"message": "Relation deleted successfully"}


@app.put("/api/tests/{test_id}/relations", response_model=dict)
async def update_test_relations(test_id: int, relations_update: UpdateRelationsRequest):
    """Update all relations for a test - replaces existing relations with new ones"""
    # Check if test exists and is idle
    test = get_test_by_id(DATABASE_NAME, test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    if test['status'] != 'idle':
        raise HTTPException(
            status_code=400, 
            detail="Can only update relations for idle tests"
        )
    
    # Get current relations to delete them first
    current_relations = get_test_relations(DATABASE_NAME, test_id)
    
    # Delete all current relations first to free up resources
    for relation in current_relations:
        delete_test_relation(DATABASE_NAME, relation['id'])
    
    # Now check if sensor or machine is available
    for sensor_info in relations_update.sensors:
        if not is_sensor_or_machine_available(DATABASE_NAME, sensor_info.sensor_id, relations_update.machine_id):
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
        success = create_test_relation(DATABASE_NAME, test_id, relation_data)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to create new relations")
    
    return {"message": "Relations updated successfully"}


@app.put("/api/tests/{test_id}/relations/machine", response_model=dict)
async def change_machine(test_id: int, update: MachineUpdateForTest):
    success = update_test_machine(DATABASE_NAME, test_id, update.machine_id)
    if not success:
        raise HTTPException(status_code=404, detail="No relations found for this test")
    return {"message": "Machine updated successfully"}


# Washing machines endpoints
@app.get("/api/machines", response_model=List[Machine])
async def get_machines():
    """Get all washing machines"""
    machines = get_all_machines(DATABASE_NAME)
    return machines


@app.get("/api/machine-types", response_model=List[MachineType])
async def get_machine_types_for_machines():
    """Get all machine types for machine selection"""
    return get_all_machine_types(DATABASE_NAME)


@app.get("/api/machines/{machine_id}", response_model=Machine)
async def get_machine(machine_id: int):
    """Get a specific washing machine"""
    sensor = get_machine_by_id(DATABASE_NAME, machine_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Washing Machine not found")
    return sensor


@app.post("/api/machines", response_model=dict)
async def add_machine(machine: MachineCreate):
    """Create a new washing machine"""
    success = create_machine(DATABASE_NAME, machine.model_dump())
    if not success:
        raise HTTPException(status_code=400, detail="Washing Machine with this ID already exists")
    return {"message": "Washing Machine created successfully"}


@app.put("/api/machines/{machine_id}", response_model=dict)
async def modify_machine(machine_id: int, machine: MachineUpdate):
    """Update a washing machine"""
    success = update_machine(DATABASE_NAME, machine_id, machine.model_dump())
    if not success:
        raise HTTPException(status_code=404, detail="Washing Machine not found")
    return {"message": "Washing Machine updated successfully"}


@app.delete("/api/machines/{machine_id}", response_model=dict)
async def remove_machine(machine_id: str):
    """Delete a washing machine only if it has no test relations"""
    relations = get_test_relations_for_machine(DATABASE_NAME, machine_id)
    if relations:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete washing machine with existing test relations"
            )
    success = delete_machine(DATABASE_NAME, machine_id)
    if not success:
        raise HTTPException(status_code=404, detail="Washing Machine not found")
    return {"message": "Washing Machine deleted successfully"}


# Data endpoints
@app.get("/api/tests/{test_id}/data", response_model=List[SensorData])
async def get_test_data(
    test_id: int,
    sensor_id: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
):
    """Get sensor data for a test"""
    data = get_sensor_data(DATABASE_NAME, test_id, sensor_id, start_time, end_time)
    return data


@app.get("/api/tests/{test_id}/summary", response_model=TestSummary)
async def get_test_data_summary(test_id: int):
    """Get test summary with statistics"""
    summary = get_test_summary(DATABASE_NAME, test_id)
    return summary


# MQTT Control endpoints
@app.post("/api/mqtt/start", response_model=dict)
async def start_mqtt_listener():
    """Start MQTT data collection"""    
    if mqtt_listener.mqtt_running:
        return {"message": "MQTT listener is already running"}
    mqtt_listener.start_mqtt()
    mqtt_listener.start_offline_checker(DATABASE_NAME)
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
    sensors_count = len(get_all_sensors(DATABASE_NAME))
    tests_count = len(get_all_tests(DATABASE_NAME))
    
    return {
        "database": DATABASE_NAME,
        "sensors_count": sensors_count,
        "tests_count": tests_count,
        "mqtt_status": mqtt_listener.mqtt_running,
        "mqtt_broker": MQTT_BROKER
    }


# Settings endpoints
@app.get("/api/settings/mqtt-config", response_model=MqttConfig)
async def get_mqtt_config_endpoint():
    """Get all MQTT configurations"""
    return get_mqtt_config(DATABASE_NAME)


# @app.post("/api/settings/mqtt-configs", response_model=MqttConfig)
# async def create_mqtt_config_endpoint(config: MqttConfigCreate):
#     """Create a new MQTT configuration"""
#     config_dict = config.dict()
#     return create_mqtt_config(DATABASE_NAME, config_dict)


@app.put("/api/settings/mqtt-config", response_model=MqttConfig)
async def update_mqtt_config_endpoint(config: MqttConfigUpdate):
    """Update MQTT configuration"""
    config_dict = {k: v for k, v in config.model_dump().items() if v is not None}
    result = update_mqtt_config(DATABASE_NAME, config_dict)
    if not result:
        raise HTTPException(status_code=404, detail="MQTT configuration not found")
    
    try:
        if mqtt_listener.mqtt_running:
            mqtt_listener.stop_mqtt()
            time.sleep(1)
        mqtt_listener.start_mqtt(result['broker_host'], result['broker_port'])
        mqtt_listener.start_offline_checker(DATABASE_NAME)
        
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

@app.get("/api/settings/mqtt-configs/")
async def delete_mqtt_config_endpoint():
    return {"data": {"broker_host": "192.168.220.121", "broker_port": "1883"}}

@app.get("/api/settings/sensor-types", response_model=List[SensorType])
async def get_sensor_types():
    """Get all sensor types"""
    return get_all_sensor_types(DATABASE_NAME)


@app.post("/api/settings/sensor-types", response_model=SensorType)
async def create_sensor_type_endpoint(sensor_type: SensorTypeCreate):
    """Create a new sensor type"""
    sensor_type_dict = sensor_type.model_dump()
    return create_sensor_type(DATABASE_NAME, sensor_type_dict)


@app.put("/api/settings/sensor-types/{type_id}", response_model=SensorType)
async def update_sensor_type_endpoint(type_id: int, sensor_type: SensorTypeUpdate):
    """Update sensor type"""
    sensor_type_dict = {k: v for k, v in sensor_type.model_dump().items() if v is not None}
    result = update_sensor_type(DATABASE_NAME, type_id, sensor_type_dict)
    if not result:
        raise HTTPException(status_code=404, detail="Sensor type not found")
    return result


@app.delete("/api/settings/sensor-types/{type_id}")
async def delete_sensor_type_endpoint(type_id: int):
    """Delete sensor type"""
    success = delete_sensor_type(DATABASE_NAME, type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sensor type not found")
    return {"message": "Sensor type deleted successfully. Related sensors marked as inactive."}


# Machine Types endpoints
@app.get("/api/settings/machine-types", response_model=List[MachineType])
async def get_machine_types():
    """Get all machine types"""
    return get_all_machine_types(DATABASE_NAME)


@app.get("/api/settings/machine-types/{type_id}", response_model=MachineType)
async def get_machine_type(type_id: int):
    """Get machine type by ID"""
    machine_type = get_machine_type_by_id(DATABASE_NAME, type_id)
    if not machine_type:
        raise HTTPException(status_code=404, detail="Machine type not found")
    return machine_type


@app.post("/api/settings/machine-types", response_model=dict)
async def create_machine_type_endpoint(machine_type: MachineTypeCreate):
    """Create new machine type"""
    result = create_machine_type(DATABASE_NAME, machine_type.model_dump())
    return {"message": "Machine type created successfully", "machine_type": result}


@app.put("/api/settings/machine-types/{type_id}", response_model=dict)
async def update_machine_type_endpoint(type_id: int, machine_type: MachineTypeUpdate):
    """Update machine type"""
    result = update_machine_type(DATABASE_NAME, type_id, machine_type.dict(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Machine type not found")
    return {"message": "Machine type updated successfully", "machine_type": result}


@app.delete("/api/settings/machine-types/{type_id}")
async def delete_machine_type_endpoint(type_id: int):
    """Delete machine type"""
    success = delete_machine_type(DATABASE_NAME, type_id)
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
