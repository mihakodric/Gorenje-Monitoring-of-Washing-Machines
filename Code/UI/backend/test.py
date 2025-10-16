# insert_sensor_test.py
import asyncio
from database import connect_to_db, close_db_connection, create_sensor, create_sensor_type, get_all_sensor_types

DATABASE_URL = "postgresql://admin:admin123@localhost:5432/long_term_monitoring_db"

sensor_data = {
    "mqtt_id": "acc_01",
    "sensor_type": 0,
    "sensor_name": "Main Drum Accelerometer",
    "description": "Measures vibration in x, y, z axes",
}
default_sensor_types = [
    {
        "display_name": "Accelerometer",
        "description": "Measures vibration and movement acceleration",
        "unit": "g"
    },
]

async def main():
    await connect_to_db(DATABASE_URL)  # initialize pool

    # ✅ await here!
    created = await create_sensor_type(default_sensor_types[0])
    print("✅ Created sensor type:", created)

    all_types = await get_all_sensor_types()
    print("📋 All sensor types:", all_types)

    await close_db_connection()  # close pool

if __name__ == "__main__":
    asyncio.run(main())