// ======================= accel_sensor.h =======================
#pragma once

#define CONFIG_PATH "/accelerometer/config.json"

#include <Wire.h>
#include <ArduinoJson.h>
#include "MQTTHandler.h"

#define LIS2DW12_ADDR 0x19
#define OUT_X_L 0x28

// Structure to hold a single accelerometer sample
struct Sample {
    float x;
    float y;
    float z;
    uint64_t datetime;   // timestamp in milliseconds
};

// ======================= Public API =======================
void setupAccelerometer(MQTTHandler* mqttHandler);
void loopAccelerometer();

// Update runtime config (generic JSON from MQTT HM)
void updateAccelerometerConfig(const JsonDocument& cfg);
