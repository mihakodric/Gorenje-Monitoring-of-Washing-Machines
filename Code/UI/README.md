# Washing Machine Monitoring System

A comprehensive React-based web application with FastAPI backend for monitoring washing machines through various sensors connected via MQTT.

## Features

### Backend (FastAPI)
- **RESTful API** for managing sensors, tests, and data
- **MQTT Integration** with existing Mosquitto broker
- **SQLite Database** with relational schema
- **Real-time Data Collection** from multiple sensor types
- **Data Analysis** with summary statistics

### Frontend (React)
- **Dashboard** with system overview and statistics
- **Sensor Management** - add, edit, delete, and monitor sensors
- **Test Management** - create, monitor, and analyze tests
- **Real-time Charts** using Chart.js for data visualization
- **Responsive Design** for desktop use

### Supported Sensors
- **Accelerometer** (3-axis: X, Y, Z)
- **Temperature** (Ambient & Object)
- **Distance** (Water level)
- **Current** (Motor current)
- **Water Flow**
- **Infrared** (Door position)

## Installation & Setup

### Prerequisites
- Python 3.7+
- Node.js 14+
- MQTT Broker (Mosquitto) running on your network

### Quick Start

1. **Run Setup Script**
   ```bash
   setup.bat
   ```
   This installs all Python and Node.js dependencies.

2. **Start Backend Server**
   ```bash
   start_backend.bat
   ```
   Backend runs on http://localhost:8000

3. **Start Frontend Server**
   ```bash
   start_frontend.bat
   ```
   Frontend runs on http://localhost:3000

4. **Open Application**
   Navigate to http://localhost:3000 in your web browser

## Usage Guide

### 1. Dashboard
- View system status and statistics
- Control MQTT data collection (Start/Stop)
- Quick access to sensor and test management

### 2. Sensor Management
- **Add New Sensors**: Click "Add Sensor" to register new sensors
- **Configure Sensors**: Set sensor type, location, and MQTT topics
- **Monitor Status**: View active/inactive status and last seen timestamps
- **Edit/Delete**: Modify sensor settings or remove sensors

### 3. Test Management
- **Create Tests**: Start new monitoring tests with descriptions
- **Monitor Progress**: View running tests and their status
- **Stop Tests**: End active tests when monitoring is complete
- **View Results**: Access detailed test analysis and data

### 4. Test Analysis
- **Real-time Charts**: Visualize sensor data with interactive graphs
- **Filter by Sensor**: Focus on specific sensors or view all data
- **Data Limits**: Control how many data points to display
- **Summary Statistics**: Min, max, average values per sensor
- **Time-based Analysis**: Track sensor readings over time

## API Endpoints

### Sensors
- `GET /api/sensors` - Get all sensors
- `POST /api/sensors` - Create new sensor
- `PUT /api/sensors/{id}` - Update sensor
- `DELETE /api/sensors/{id}` - Delete sensor

### Tests
- `GET /api/tests` - Get all tests
- `POST /api/tests` - Create new test
- `PUT /api/tests/{name}` - Update test
- `POST /api/tests/{name}/stop` - Stop test
- `GET /api/tests/{name}/data` - Get test data
- `GET /api/tests/{name}/summary` - Get test statistics

### MQTT Control
- `POST /api/mqtt/start` - Start MQTT listener
- `POST /api/mqtt/stop` - Stop MQTT listener
- `GET /api/mqtt/status` - Get MQTT status

## Configuration

### Backend Configuration (`Code/UI/backend/config.json`)
```json
{
  "ime_baze": "prebrani_podatki.db",
  "mqtt_broker": "192.168.0.77",
  "mqtt_port": 1883,
  "mqtt_topics": ["acceleration", "distance", "temperature", "current", "water_flow", "infrared"]
}
```

### Default Sensors
The system automatically creates default sensors:
- `acc1` - Accelerometer (Machine body)
- `temp1` - Temperature Sensor (Water inlet)
- `dist1` - Distance Sensor (Water tank)
- `current1` - Current Sensor (Motor)
- `flow1` - Flow Sensor (Water pipe)
- `infra1` - Infrared Sensor (Door)

## Database Schema

### Tables
- **sensors** - Sensor registration and configuration
- **tests** - Test definitions and metadata
- **podatki** - Time-series sensor data

### Data Storage
- All sensor readings stored with timestamps
- Relational links between tests and sensor data
- Automatic indexing for performance

## MQTT Data Format

Expected MQTT message format:
```json
{
  "sensor_id": "acc1",
  "timestamp_ms": 1640995200000,
  "mqtt_topic": "acceleration",
  "ax_g": 0.123,
  "ay_g": -0.456,
  "az_g": 0.789
}
```

## Troubleshooting

### Backend Issues
- Check if Python dependencies are installed: `pip install -r requirements.txt`
- Verify MQTT broker is accessible
- Check database permissions

### Frontend Issues
- Ensure Node.js dependencies: `npm install`
- Check if backend is running on port 8000
- Clear browser cache if UI doesn't load

### MQTT Connection Issues
- Verify broker IP and port in config.json
- Check network connectivity
- Ensure sensors are publishing to correct topics

## Development

### File Structure
```
Code/UI/
├── backend/
│   ├── api_server.py      # FastAPI main server
│   ├── database.py        # Database operations
│   ├── models.py         # Pydantic models
│   ├── main_mqtt_listener.py # MQTT client
│   └── config.json       # Configuration
└── frontend/
    ├── src/
    │   ├── components/    # React components
    │   ├── api.js        # API client
    │   └── App.js        # Main app component
    └── package.json      # Node.js dependencies
```

### Adding New Sensor Types
1. Update `mqtt_topics` in config.json
2. Add sensor type to backend models
3. Update data parsing in `database.py`
4. Add UI support in React components

## License
This project is for internal use and monitoring of washing machine systems.



# connect to docker container database in terminal
docker exec -it timescaledb psql -U admin -d long_term_monitoring_db

where:
- `timescaledb` is the name of the Docker container
- `admin` is the database user
- `long_term_monitoring_db` is the database name
  


# Create database form schema.sql file form terminal
docker exec -it timescaledb psql -U admin -d long_term_monitoring_db -f /schema.sql