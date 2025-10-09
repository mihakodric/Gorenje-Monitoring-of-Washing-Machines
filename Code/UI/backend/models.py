from pydantic import BaseModel
from typing import Optional, List, Dict, Any


# Sensor Models
class SensorBase(BaseModel):
    sensor_id: str
    sensor_type: str  # 'acceleration', 'temperature', 'distance', etc.
    sensor_name: str
    description: Optional[str] = ""
    mqtt_topic: str
    visible: Optional[bool] = True


class SensorCreate(SensorBase):
    pass


class SensorUpdate(BaseModel):
    sensor_name: Optional[str] = ""
    description: Optional[str] = ""
    visible: Optional[bool] = True


class SensorSettingsUpdate(BaseModel):
    settings: Dict[str, Any]


class Sensor(SensorBase):
    id: int
    is_online: bool
    created_at: str
    last_seen: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None



# Test Models
class TestBase(BaseModel):
    test_name: str
    description: Optional[str] = ""
    notes: Optional[str] = ""
    created_by: str


class TestCreate(TestBase):
    pass


class TestUpdate(BaseModel):
    test_name: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None


class Test(TestBase):
    id: int
    status: Optional[str] = "idle"  # 'idle', 'running', 'completed', 'failed'
    created_at: str
    last_modified_at: str
    data_points: Optional[int] = 0
    first_data: Optional[str] = None
    last_data: Optional[str] = None


# Test relations models
class TestRelation(BaseModel):
    id: int
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


# Machine Models
class MachineBase(BaseModel):
    machine_name: str
    description: Optional[str] = ""
    machine_type_id: Optional[int] = None
    visible: Optional[bool] = True


class MachineCreate(MachineBase):
    pass


class MachineUpdate(BaseModel):
    machine_name: Optional[str] = None
    description: Optional[str] = ""
    machine_type_id: Optional[int] = None
    visible: Optional[bool] = True


class Machine(MachineBase):
    id: int
    created_at: str


# Machine Type Models
class MachineTypeBase(BaseModel):
    display_name: str
    description: Optional[str] = ""
    created_by: str


class MachineTypeCreate(MachineTypeBase):
    pass


class MachineTypeUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = ""


class MachineType(MachineTypeBase):
    id: int
    created_at: str


class SensorData(BaseModel):
    id: int
    datetime: str
    direction: str
    value: float
    test_relation_id: int


class TestSummary(BaseModel):
    test_info: dict
    data_summary: List[dict]


# MQTT Configuration Models
class MqttConfigBase(BaseModel):
    broker_host: str
    broker_port: Optional[int] = 1883
    username: Optional[str] = ""
    password: Optional[str] = ""


class MqttConfigUpdate(BaseModel):
    broker_host: Optional[str] = None
    broker_port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None


class MqttConfig(MqttConfigBase):
    is_active: bool



# Sensor Type Models
class SensorTypeBase(BaseModel):
    mqtt_topic: str
    display_name: str
    unit: Optional[str] = ""
    description: Optional[str] = ""


class SensorTypeCreate(SensorTypeBase):
    pass

class SensorTypeUpdate(BaseModel):
    mqtt_topic: Optional[str] = None
    display_name: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None


class SensorType(SensorTypeBase):
    id: int
    created_at: str