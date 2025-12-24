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
from .sensors import Sensor, SensorCreate, SensorUpdate, SensorBase
from .machines import Machine, MachineCreate, MachineUpdate, MachineBase
from .machine_types import MachineType, MachineTypeCreate, MachineTypeUpdate, MachineTypeBase
from .machine_type_sensor_templates import (
    MachineTypeSensorTemplate, 
    MachineTypeSensorTemplateCreate, 
    MachineTypeSensorTemplateUpdate,
    MachineTypeSensorTemplateWithDetails
)
from .tests import Test, TestCreate, TestUpdate, TestBase
from .test_relations import TestRelation, TestRelationCreate, TestRelationAllDetails
from .measurements import MeasurementAveraged, MeasurementRaw
from .mqtt import MqttConfig, MqttConfigUpdate, MqttConfigBase

__all__ = [
    # Sensor Types
    "SensorType", "SensorTypeCreate", "SensorTypeUpdate", "SensorTypeBase",
    
    # Sensors
    "Sensor", "SensorCreate", "SensorUpdate", "SensorBase",

    # Machines
    "Machine", "MachineCreate", "MachineUpdate", "MachineBase",
    
    # Machine Types
    "MachineType", "MachineTypeCreate", "MachineTypeUpdate", "MachineTypeBase",
    
    # Machine Type Sensor Templates
    "MachineTypeSensorTemplate", "MachineTypeSensorTemplateCreate", 
    "MachineTypeSensorTemplateUpdate", "MachineTypeSensorTemplateWithDetails",
    
    # Tests
    "Test", "TestCreate", "TestUpdate", "TestBase",

    # Test Relations
    "TestRelation", "TestRelationCreate", "TestRelationAllDetails",
    
    # Measurements
    "MeasurementAveraged", "MeasurementRaw"
    
    # MQTT
    "MqttConfig", "MqttConfigUpdate", "MqttConfigBase",
]