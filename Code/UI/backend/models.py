from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class SensorBase(BaseModel):
    sensor_id: str
    sensor_type: str  # 'acceleration', 'temperature', 'distance', etc.
    sensor_name: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    mqtt_topic: str
    is_online: Optional[bool] = True
    visible: Optional[bool] = True
    settings: Optional[Dict[str, Any]] = None


class SensorCreate(SensorBase):
    pass


class SensorUpdate(BaseModel):
    sensor_name: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    is_online: Optional[bool] = True
    visible: Optional[bool] = True
    settings: Optional[Dict[str, Any]] = None


class Sensor(SensorBase):
    id: int
    created_at: str
    last_seen: Optional[str] = None


class TestBase(BaseModel):
    test_name: str
    description: Optional[str] = ""
    status: Optional[str] = "idle"  # 'idle', 'running', 'completed', 'failed'
    created_by: Optional[str] = "user"
    notes: Optional[str] = ""


class TestCreate(TestBase):
    start_time: Optional[str] = None


class TestUpdate(BaseModel):
    test_name: Optional[str] = ""
    description: Optional[str] = ""
    status: Optional[str] = "running"
    end_time: Optional[str] = None
    notes: Optional[str] = ""


class Test(TestBase):
    id: int
    start_time: str
    end_time: Optional[str] = None
    data_points: Optional[int] = 0
    first_data: Optional[str] = None
    last_data: Optional[str] = None



class MachineBase(BaseModel):
    machine_name: str
    description: Optional[str] = ""
    visible: Optional[bool] = True


class MachineCreate(MachineBase):
    pass


class MachineUpdate(BaseModel):
    machine_name: str
    description: Optional[str] = ""
    visible: Optional[bool] = True


class Machine(MachineBase):
    id: int
    created_at: str


class SensorData(BaseModel):
    id: int
    time: str
    timestamp_ms: int
    sensor_id: str
    direction: str
    value: float
    test_relations_id: int


class TestSummary(BaseModel):
    test_info: dict
    data_summary: List[dict]


# MQTT Configuration Models
class MqttConfigBase(BaseModel):
    broker_host: str
    broker_port: Optional[int] = 1883
    username: Optional[str] = ""
    password: Optional[str] = ""
    is_active: Optional[bool] = True


class MqttConfigUpdate(BaseModel):
    broker_host: Optional[str] = None
    broker_port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class MqttConfig(MqttConfigBase):
    pass


# Sensor Type Models
class SensorTypeBase(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = ""
    default_topic: Optional[str] = ""
    unit: Optional[str] = ""
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class SensorTypeCreate(SensorTypeBase):
    pass

class SensorTypeUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    default_topic: Optional[str] = None
    unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class SensorType(SensorTypeBase):
    id: int
    created_at: str


# Test realtions models
class TestRelation(BaseModel):
    test_id: int
    machine_id: int
    sensor_id: int