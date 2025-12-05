// ======================= dist_sensor.h =======================
#pragma once

#define CONFIG_PATH "/distance/config.json"

#include "DFRobot_VL6180X.h"
#include <ArduinoJson.h>
#include "MQTTHandler.h"

extern DFRobot_VL6180X VL6180X;


// Structure to hold a single accelerometer sample
struct Sample {
    float distance_mm;       // MUST be float for NaN support
    uint64_t timestamp_ms;
};

// ======================= Public API =======================
void setupDistanceSensor(MQTTHandler* mqttHandler);
void loopDistanceSensor();

// Update runtime config (generic JSON from MQTT HM)
void updateDistanceSensorConfig(const JsonDocument& cfg);