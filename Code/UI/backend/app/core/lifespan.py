"""
Application lifespan management.

This module handles application startup and shutdown events,
including database initialization and default data seeding.
"""

import asyncpg
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.core.config import config
from database import set_db_pool
from database import (
    get_all_sensor_types, create_sensor_type,
    get_all_machine_types, create_machine_type, 
    get_all_machines, create_machine,
    create_sensor
)


async def create_default_data():
    """Create default sensor types, machine types, machines, and sensors."""
    
    # Default sensor types
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
    
    # Create sensor types and build mapping
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
    
    # Default machine types  
    default_machine_types = [
        {
            "machine_type_name": "Washing Machine",
            "machine_type_description": "Standard household washing machine for cleaning clothes and textiles"
        },
        {
            "machine_type_name": "Dishwasher", 
            "machine_type_description": "Automatic dishwashing appliance for cleaning dishes and utensils"
        }
    ]
    
    existing_machine_types = await get_all_machine_types()
    existing_machine_names = [mt['machine_type_name'] for mt in existing_machine_types]
    
    for machine_type_data in default_machine_types:
        if machine_type_data["machine_type_name"] not in existing_machine_names:
            await create_machine_type(machine_type_data)
    
    # Default machines
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
    
    # Default sensors
    default_sensors = [
        {
            "sensor_mqtt_topic": "acc_1",
            "sensor_type_id": sensor_type_mapping.get("Accelerometer", 1),
            "sensor_name": "Accelerometer 1", 
            "sensor_description": "Main washing machine accelerometer"
        },
        {
            "sensor_mqtt_topic": "temp_1",
            "sensor_type_id": sensor_type_mapping.get("Temperature Sensor", 2),
            "sensor_name": "Temperature Sensor 1",
            "sensor_description": "Water temperature sensor"
        },
        {
            "sensor_mqtt_topic": "dist_1", 
            "sensor_type_id": sensor_type_mapping.get("Distance Sensor", 3),
            "sensor_name": "Distance Sensor 1",
            "sensor_description": "Water level measurement"
        },
        {
            "sensor_mqtt_topic": "current_1",
            "sensor_type_id": sensor_type_mapping.get("Current Sensor", 4), 
            "sensor_name": "Current Sensor 1",
            "sensor_description": "Motor current measurement"
        },
        {
            "sensor_mqtt_topic": "flow_1",
            "sensor_type_id": sensor_type_mapping.get("Flow Sensor", 5),
            "sensor_name": "Flow Sensor 1", 
            "sensor_description": "Water flow measurement"
        },
        {
            "sensor_mqtt_topic": "infra_1",
            "sensor_type_id": sensor_type_mapping.get("Infrared Sensor", 6),
            "sensor_name": "Infrared Sensor 1",
            "sensor_description": "Door position sensor"
        }
    ]
    
    for sensor_data in default_sensors:
        try:
            await create_sensor(sensor_data)
        except Exception as e:
            # Sensor might already exist, continue with others
            print(f"Sensor creation skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events."""
    
    # Startup
    print("🚀 Starting Gorenje Washing Machine Monitoring API...")
    
    try:
        # Create database connection pool
        print(f"📊 Connecting to database: {config.database_url}")
        db_pool = await asyncpg.create_pool(
            config.database_url,
            min_size=5,
            max_size=20,
            command_timeout=60
        )
        
        # Set pool for all database modules
        set_db_pool(db_pool)
        print("✅ Database connection pool established")
        
        # Create default data
        print("📝 Creating default data...")
        await create_default_data()
        print("✅ Default data initialized")
        
        print("🎉 Application startup complete!")
        
        yield
        
    except Exception as e:
        print(f"❌ Startup failed: {e}")
        raise
    
    # Shutdown
    print("🛑 Shutting down application...")
    
    try:
        
        # Close database pool
        if 'db_pool' in locals():
            await db_pool.close()
            print("✅ Database connection pool closed")
            
    except Exception as e:
        print(f"⚠️  Shutdown error: {e}")
    
    print("👋 Application shutdown complete")