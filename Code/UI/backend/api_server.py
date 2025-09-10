from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from typing import List, Optional
import json
import os
from datetime import datetime
import threading

from models import (
    Sensor, SensorCreate, SensorUpdate, 
    Test, TestCreate, TestUpdate, 
    Machine, MachineCreate, MachineUpdate, 
    SensorData, TestSummary,
    MqttConfig, MqttConfigUpdate,
    SensorType, SensorTypeCreate, SensorTypeUpdate,
    TestRelation
)
from database import (
    ustvari_sql_bazo,
    get_all_sensors, get_sensor_by_id, create_sensor, update_sensor, delete_sensor,
    get_all_tests, get_test_by_id, create_test, update_test, delete_test,
    get_sensor_data, get_test_summary,
    get_sensor_relations, create_sensor_relation, delete_sensor_relation,
    get_mqtt_config, create_mqtt_config, update_mqtt_config,
    get_all_sensor_types, create_sensor_type, get_sensor_type_by_id, update_sensor_type, delete_sensor_type,
    get_all_machines, get_machine_by_id, create_machine, update_machine, delete_machine
)
from main_mqtt_listener import poberi_podatke_mqtt

# Load configuration
base_path = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(base_path, 'config.json')
with open(config_path, 'r') as config_file:
    config = json.load(config_file)

DATABASE_NAME = config['ime_baze']
MQTT_BROKER = config['mqtt_broker']
MQTT_PORT = config['mqtt_port']

# Global variable to track MQTT listener
mqtt_thread = None
mqtt_running = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and setup on startup"""
    # Startup
    ustvari_sql_bazo(DATABASE_NAME)
    
    # Add default sensors if they don't exist
    default_sensors = [
        {
            "sensor_id": "acc1",
            "sensor_type": "acceleration",
            "sensor_name": "Accelerometer 1",
            "description": "Main washing machine accelerometer",
            "location": "Machine body",
            "mqtt_topic": "acceleration"
        },
        {
            "sensor_id": "temp1",
            "sensor_type": "temperature",
            "sensor_name": "Temperature Sensor 1",
            "description": "Water temperature sensor",
            "location": "Water inlet",
            "mqtt_topic": "temperature"
        },
        {
            "sensor_id": "dist1",
            "sensor_type": "distance",
            "sensor_name": "Distance Sensor 1",
            "description": "Water level measurement",
            "location": "Water tank",
            "mqtt_topic": "distance"
        },
        {
            "sensor_id": "current1",
            "sensor_type": "current",
            "sensor_name": "Current Sensor 1",
            "description": "Motor current measurement",
            "location": "Motor",
            "mqtt_topic": "current"
        },
        {
            "sensor_id": "flow1",
            "sensor_type": "water_flow",
            "sensor_name": "Flow Sensor 1",
            "description": "Water flow measurement",
            "location": "Water pipe",
            "mqtt_topic": "water_flow"
        },
        {
            "sensor_id": "infra1",
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

    # Add default washing machines, if they don't exist
    default_machines = [
        {
            "machine_name": "machine1",
            "description": "Test Washing Machine 1",
        },
        {
            "machine_name": "machine2",
            "description": "Test Washing Machine 2",
        }
    ]

    for machine_data in default_machines:
        if not get_all_machines(DATABASE_NAME):
            create_machine(DATABASE_NAME, machine_data)

    # Add default MQTT config if it doesn't exist
    default_mqtt_config = {
        "broker_host": MQTT_BROKER,
        "broker_port": MQTT_PORT,
        "username": "",
        "password": "",
        "is_active": True
    }

    if not get_mqtt_config(DATABASE_NAME):
        create_mqtt_config(DATABASE_NAME, default_mqtt_config)
    
    # Add default sensor types if they don't exist
    default_sensor_types = [
        {
            "name": "acceleration",
            "display_name": "Accelerometer",
            "description": "Measures vibration and movement acceleration",
            "default_topic": "acceleration",
            "unit": "g",
            "min_value": -10.0,
            "max_value": 10.0
        },
        {
            "name": "temperature",
            "display_name": "Temperature Sensor",
            "description": "Measures temperature of water or ambient",
            "default_topic": "temperature",
            "unit": "°C",
            "min_value": -20.0,
            "max_value": 100.0
        },
        {
            "name": "distance",
            "display_name": "Distance/Ultrasonic Sensor",
            "description": "Measures distance or water level",
            "default_topic": "distance",
            "unit": "cm",
            "min_value": 0.0,
            "max_value": 400.0
        },
        {
            "name": "current",
            "display_name": "Current Sensor",
            "description": "Measures electrical current consumption",
            "default_topic": "current",
            "unit": "A",
            "min_value": 0.0,
            "max_value": 30.0
        },
        {
            "name": "water_flow",
            "display_name": "Water Flow Sensor",
            "description": "Measures water flow rate",
            "default_topic": "water_flow",
            "unit": "L/min",
            "min_value": 0.0,
            "max_value": 50.0
        },
        {
            "name": "infrared",
            "display_name": "Infrared Sensor",
            "description": "Detects presence or position using infrared",
            "default_topic": "infrared",
            "unit": "",
            "min_value": 0.0,
            "max_value": 1.0
        }
    ]
    
    existing_sensor_types = get_all_sensor_types(DATABASE_NAME)
    existing_names = [st['name'] for st in existing_sensor_types]
    
    for sensor_type_data in default_sensor_types:
        if sensor_type_data["name"] not in existing_names:
            create_sensor_type(DATABASE_NAME, sensor_type_data)
    
    yield
    # Shutdown - cleanup if needed

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
    success = create_sensor(DATABASE_NAME, sensor.dict())
    if not success:
        raise HTTPException(status_code=400, detail="Sensor with this ID already exists")
    return {"message": "Sensor created successfully"}


@app.put("/api/sensors/{sensor_id}", response_model=dict)
async def modify_sensor(sensor_id: str, sensor: SensorUpdate):
    """Update a sensor"""
    success = update_sensor(DATABASE_NAME, sensor_id, sensor.dict())
    if not success:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return {"message": "Sensor updated successfully"}


@app.delete("/api/sensors/{sensor_id}", response_model=dict)
async def remove_sensor(sensor_id: str):
    """Delete a sensor"""
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
    success = create_test(DATABASE_NAME, test.dict())
    if not success:
        raise HTTPException(status_code=400, detail="Test with this name already exists")
    return {"message": "Test created successfully"}


@app.put("/api/tests/{test_id}", response_model=dict)
async def modify_test(test_id: int, test: TestUpdate):
    """Update a test"""
    success = update_test(DATABASE_NAME, test_id, test.dict())
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"message": "Test updated successfully"}


@app.post("/api/tests/{test_id}/start", response_model=dict)
async def start_test(test_id: int):
    """Start a test"""
    test_update = {
        "status": "running",
        "start_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    success = update_test(DATABASE_NAME, test_id, test_update)
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"message": "Test started successfully"}


@app.post("/api/tests/{test_id}/stop", response_model=dict)
async def stop_test(test_id: int):
    """Stop a test"""
    test_update = {
        "status": "completed",
        "end_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    success = update_test(DATABASE_NAME, test_id, test_update)
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
# Get all relations for a test
@app.get("/api/tests/{test_id}/relations", response_model=List[TestRelation])
async def get_relations(test_id: int):
    return get_test_relations(DATABASE_NAME, test_id)

# Add a relation (sensor or machine) to a test
@app.post("/api/tests/{test_id}/relations", response_model=dict)
async def add_relation(test_id: int, relation: TestRelationCreate):
    success = create_test_relation(DATABASE_NAME, test_id, relation.dict())
    if not success:
        raise HTTPException(status_code=400, detail="Failed to create relation")
    return {"message": "Relation created successfully"}

# Delete a relation (remove a sensor or machine from a test)
@app.delete("/api/tests/{test_id}/relations/{relation_id}", response_model=dict)
async def remove_relation(test_id: int, relation_id: int):
    success = delete_test_relation(DATABASE_NAME, relation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Relation not found")
    return {"message": "Relation deleted successfully"}


# Washing machines endpoints
@app.get("/api/machines", response_model=List[Machine])
async def get_machines():
    """Get all washing machines"""
    sensors = get_all_machines(DATABASE_NAME)
    return sensors


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
    success = create_machine(DATABASE_NAME, machine.dict())
    if not success:
        raise HTTPException(status_code=400, detail="Washing Machine with this ID already exists")
    return {"message": "Washing Machine created successfully"}


@app.put("/api/machines/{machine_id}", response_model=dict)
async def modify_machine(machine_id: int, machine: MachineUpdate):
    """Update a washing machine"""
    success = update_machine(DATABASE_NAME, machine_id, machine.dict())
    if not success:
        raise HTTPException(status_code=404, detail="Washing Machine not found")
    return {"message": "Washing Machine updated successfully"}


@app.delete("/api/machines/{machine_id}", response_model=dict)
async def remove_machine(machine_id: str):
    """Delete a washing machine"""
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
    global mqtt_thread, mqtt_running
    
    if mqtt_running:
        return {"message": "MQTT listener is already running"}
    
    def mqtt_worker():
        global mqtt_running
        mqtt_running = True
        try:
            poberi_podatke_mqtt(MQTT_BROKER, MQTT_PORT)
        except Exception as e:
            print(f"MQTT error: {e}")
        finally:
            mqtt_running = False
    
    mqtt_thread = threading.Thread(target=mqtt_worker, daemon=True)
    mqtt_thread.start()
    
    return {"message": "MQTT listener started successfully"}


@app.post("/api/mqtt/stop", response_model=dict)
async def stop_mqtt_listener():
    """Stop MQTT data collection"""
    global mqtt_running
    mqtt_running = False
    return {"message": "MQTT listener stop signal sent"}


@app.get("/api/mqtt/status", response_model=dict)
async def get_mqtt_status():
    """Get MQTT listener status"""
    return {"running": mqtt_running}


# System endpoints
@app.get("/api/status", response_model=dict)
async def get_system_status():
    """Get system status"""
    sensors_count = len(get_all_sensors(DATABASE_NAME))
    tests_count = len(get_all_tests(DATABASE_NAME))
    
    return {
        "status": "running",
        "database": DATABASE_NAME,
        "sensors_count": sensors_count,
        "tests_count": tests_count,
        "mqtt_status": mqtt_running,
        "mqtt_broker": MQTT_BROKER
    }


# Settings endpoints
@app.get("/api/settings/mqtt-configs", response_model=List[MqttConfig])
async def get_mqtt_configs():
    """Get all MQTT configurations"""
    return get_mqtt_config(DATABASE_NAME)


# @app.post("/api/settings/mqtt-configs", response_model=MqttConfig)
# async def create_mqtt_config_endpoint(config: MqttConfigCreate):
#     """Create a new MQTT configuration"""
#     config_dict = config.dict()
#     return create_mqtt_config(DATABASE_NAME, config_dict)


@app.put("/api/settings/mqtt-configs/{config_id}", response_model=MqttConfig)
async def update_mqtt_config_endpoint(config_id: int, config: MqttConfigUpdate):
    """Update MQTT configuration"""
    config_dict = {k: v for k, v in config.dict().items() if v is not None}
    result = update_mqtt_config(DATABASE_NAME, config_dict)
    if not result:
        raise HTTPException(status_code=404, detail="MQTT configuration not found")
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
    return get_all_sensor_types(DATABASE_NAME)


@app.post("/api/settings/sensor-types", response_model=SensorType)
async def create_sensor_type_endpoint(sensor_type: SensorTypeCreate):
    """Create a new sensor type"""
    sensor_type_dict = sensor_type.dict()
    return create_sensor_type(DATABASE_NAME, sensor_type_dict)


@app.put("/api/settings/sensor-types/{type_id}", response_model=SensorType)
async def update_sensor_type_endpoint(type_id: int, sensor_type: SensorTypeUpdate):
    """Update sensor type"""
    sensor_type_dict = {k: v for k, v in sensor_type.dict().items() if v is not None}
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


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Washing Machine Monitoring API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=True)
