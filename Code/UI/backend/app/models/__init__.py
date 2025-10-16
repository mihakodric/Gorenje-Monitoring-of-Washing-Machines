"""
Pydantic models for the Gorenje API.

This package contains all data models used by the FastAPI application,
organized by domain:

- sensor_types: SensorType models
- sensors: Sensor models  
- machines: Machine models
- machine_types: MachineType models
- tests: Test models and relations
- measurements: Measurement models
- mqtt: MQTT configuration models
"""

from .sensor_types import SensorType, SensorTypeCreate, SensorTypeUpdate, SensorTypeBase
from .sensors import Sensor, SensorCreate, SensorUpdate, SensorBase, SensorSettingsUpdate
from .machines import Machine, MachineCreate, MachineUpdate, MachineBase
from .machine_types import MachineType, MachineTypeCreate, MachineTypeUpdate, MachineTypeBase
from .tests import (
    Test, TestCreate, TestUpdate, TestBase,
    TestRelation, TestRelationCreate,
    SensorWithLocation, TestWithRelations, TestCreateWithRelations,
    MachineUpdateForTest, UpdateRelationsRequest
)
from .measurements import Measurement
from .mqtt import MqttConfig, MqttConfigUpdate, MqttConfigBase

__all__ = [
    # Sensor Types
    "SensorType", "SensorTypeCreate", "SensorTypeUpdate", "SensorTypeBase",
    
    # Sensors
    "Sensor", "SensorCreate", "SensorUpdate", "SensorBase", "SensorSettingsUpdate",
    
    # Machines
    "Machine", "MachineCreate", "MachineUpdate", "MachineBase",
    
    # Machine Types
    "MachineType", "MachineTypeCreate", "MachineTypeUpdate", "MachineTypeBase",
    
    # Tests
    "Test", "TestCreate", "TestUpdate", "TestBase",
    "TestRelation", "TestRelationCreate",
    "SensorWithLocation", "TestWithRelations", "TestCreateWithRelations",
    "MachineUpdateForTest", "UpdateRelationsRequest",
    
    # Measurements
    "Measurement",
    
    # MQTT
    "MqttConfig", "MqttConfigUpdate", "MqttConfigBase",
]