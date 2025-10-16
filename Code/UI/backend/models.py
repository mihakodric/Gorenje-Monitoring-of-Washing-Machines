from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

# ---------------------------------
# Sensor Type Models
# ---------------------------------
class SensorTypeBase(BaseModel):
    sensor_type_name: str
    sensor_type_unit: Optional[str] = None
    sensor_type_description: Optional[str] = None

class SensorTypeCreate(SensorTypeBase):
    pass

class SensorTypeUpdate(BaseModel):
    sensor_type_name: Optional[str] = None
    sensor_type_unit: Optional[str] = None
    sensor_type_description: Optional[str] = None

class SensorType(SensorTypeBase):
    id: int
    sensor_type_created_at: datetime

# ---------------------------------
# Sensor Models
# ---------------------------------
class SensorBase(BaseModel):
    sensor_type_id: int
    sensor_mqtt_topic: str
    sensor_name: str
    sensor_description: Optional[str] = None

class SensorCreate(SensorBase):
    pass

class SensorUpdate(BaseModel):
    sensor_type_id: Optional[int] = None
    sensor_mqtt_topic: Optional[str] = None
    sensor_name: Optional[str] = None
    sensor_description: Optional[str] = None

class SensorSettingsUpdate(BaseModel):
    sensor_settings: Dict[str, Any]

class Sensor(SensorBase):
    id: int
    sensor_is_online: bool
    sensor_created_at: datetime
    sensor_last_seen: Optional[datetime] = None
    sensor_settings: Optional[Dict[str, Any]] = None

# ---------------------------------
# Machine Models
# ---------------------------------
class MachineBase(BaseModel):
    machine_name: str
    machine_description: Optional[str] = None
    machine_type_id: Optional[int] = None


class MachineCreate(MachineBase):
    pass


class MachineUpdate(BaseModel):
    machine_name: Optional[str] = None
    machine_description: Optional[str] = None
    machine_type_id: Optional[int] = None


class Machine(MachineBase):
    machine_id: int
    machine_created_at: datetime


# Machine Type Models
class MachineTypeBase(BaseModel):
    machine_type_name: str
    machine_type_description: Optional[str] = None


class MachineTypeCreate(MachineTypeBase):
    pass


class MachineTypeUpdate(BaseModel):
    machine_type_name: Optional[str] = None
    machine_type_description: Optional[str] = None


class MachineType(MachineTypeBase):
    machine_type_id: int
    machine_type_created_at: datetime


# Test Models
class TestBase(BaseModel):
    test_name: str
    test_description: Optional[str] = ""
    test_notes: Optional[str] = ""
    test_created_by: str


class TestCreate(TestBase):
    pass


class TestUpdate(BaseModel):
    test_name: Optional[str] = None
    test_description: Optional[str] = None
    test_notes: Optional[str] = None
    test_created_by: Optional[str] = None


class Test(TestBase):
    test_id: int
    test_status: Optional[str] = "idle"  # 'idle', 'running', 'completed', 'failed'
    test_created_at: datetime
    test_last_modified_at: datetime
    test_sensor_count: Optional[int] = 0
    test_first_data_time: Optional[datetime] = None
    test_last_data_time: Optional[datetime] = None


# Test relations models
class TestRelation(BaseModel):
    test_relation_id: int
    test_id: int
    machine_id: int
    sensor_id: int
    sensor_location: Optional[str] = ""


class TestRelationCreate(BaseModel):
    machine_id: int
    sensor_id: int
    sensor_location: Optional[str] = ""


class SensorWithLocation(BaseModel):
    sensor_id: int
    sensor_location: str = ""


class TestWithRelations(BaseModel):
    test: Test
    machine_id: Optional[int] = None
    sensors: List[SensorWithLocation] = []


class TestCreateWithRelations(BaseModel):
    test: TestCreate
    machine_id: int
    sensors: List[SensorWithLocation]


class MachineUpdateForTest(BaseModel):
    machine_id: int


class UpdateRelationsRequest(BaseModel):
    machine_id: int
    sensors: List[SensorWithLocation]



class Measurement(BaseModel):
    measurement_timestamp: datetime
    test_relation_id: int
    measurement_channel: str
    measurement_value: float


# MQTT Configuration Models
class MqttConfigBase(BaseModel):
    mqtt_broker_host: str
    mqtt_broker_port: Optional[int] = 1883
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None


class MqttConfigUpdate(BaseModel):
    mqtt_broker_host: Optional[str] = None
    mqtt_broker_port: Optional[int] = None
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None


class MqttConfig(MqttConfigBase):
    mqtt_is_active: bool

