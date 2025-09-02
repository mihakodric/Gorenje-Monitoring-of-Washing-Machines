from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SensorBase(BaseModel):
    sensor_id: str
    sensor_type: str  # 'acceleration', 'temperature', 'distance', etc.
    name: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    mqtt_topic: str
    is_active: Optional[bool] = True
    machine_id: Optional[str] = None


class SensorCreate(SensorBase):
    pass


class SensorUpdate(BaseModel):
    name: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    is_active: Optional[bool] = True
    machine_id: Optional[str] = None


class Sensor(SensorBase):
    id: int
    created_at: str
    last_seen: Optional[str] = None


class TestBase(BaseModel):
    test_name: str
    description: Optional[str] = ""
    machine_id: Optional[str] = ""
    status: Optional[str] = "running"
    created_by: Optional[str] = "user"
    notes: Optional[str] = ""


class TestCreate(TestBase):
    start_time: Optional[str] = None


class TestUpdate(BaseModel):
    description: Optional[str] = ""
    machine_id: Optional[str] = ""
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
    machine_id: str
    name: str
    description: Optional[str] = ""


class MachineCreate(MachineBase):
    pass


class MachineUpdate(BaseModel):
    name: str
    description: Optional[str] = ""


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
    test_name: str


class TestSummary(BaseModel):
    test_info: dict
    data_summary: List[dict]


# MQTT Configuration Models
class MqttConfigBase(BaseModel):
    name: str
    broker_host: str
    broker_port: Optional[int] = 1883
    username: Optional[str] = ""
    password: Optional[str] = ""
    topic_prefix: Optional[str] = ""
    description: Optional[str] = ""
    is_active: Optional[bool] = True


class MqttConfigCreate(MqttConfigBase):
    pass


class MqttConfigUpdate(BaseModel):
    name: Optional[str] = None
    broker_host: Optional[str] = None
    broker_port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    topic_prefix: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class MqttConfig(MqttConfigBase):
    id: int
    created_at: str


# Sensor Type Models
class SensorTypeBase(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = ""
    default_topic: Optional[str] = ""
    data_format: Optional[str] = "json"  # json, string, number
    unit: Optional[str] = ""
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    is_active: Optional[bool] = True


class SensorTypeCreate(SensorTypeBase):
    pass


class SensorTypeUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    default_topic: Optional[str] = None
    data_format: Optional[str] = None
    unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    is_active: Optional[bool] = None


class SensorType(SensorTypeBase):
    id: int
    created_at: str
