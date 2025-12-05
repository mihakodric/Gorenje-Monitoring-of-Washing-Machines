// ======================= infrared_sensor.h =======================
#pragma once

#define CONFIG_PATH "/infrared/config.json"

#include "DFRobot_MLX90614.h"
#include <ArduinoJson.h>
#include "MQTTHandler.h"

extern DFRobot_MLX90614_I2C sensor;


// Structure to hold a single infrared sample
struct Sample {
    float rpm;       // MUST be float for NaN support
    uint64_t timestamp_ms;
};

// ======================= Public API =======================
void setupInfraredSensor(MQTTHandler* mqttHandler);
void loopInfraredSensor();

// Update runtime config (generic JSON from MQTT HM)
void updateInfraredSensorConfig(const JsonDocument& cfg);