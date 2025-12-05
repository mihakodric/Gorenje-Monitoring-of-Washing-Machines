// ======================= temperature_sensor.h =======================
#pragma once

#define CONFIG_PATH "/temperature/config.json"

#include "DFRobot_MLX90614.h"
#include <ArduinoJson.h>
#include "MQTTHandler.h"

extern DFRobot_MLX90614_I2C sensor;


// Structure to hold a single temperature sample
struct Sample {
    float object_temperature_c;       // MUST be float for NaN support
    float ambient_temperature_c;      // MUST be float for NaN support
    uint64_t timestamp_ms;
};

// ======================= Public API =======================
void setupTemperatureSensor(MQTTHandler* mqttHandler);
void loopTemperatureSensor();

// Update runtime config (generic JSON from MQTT HM)
void updateTemperatureSensorConfig(const JsonDocument& cfg);