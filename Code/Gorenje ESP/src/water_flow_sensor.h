// ======================= water_flow_sensor.h =======================
#pragma once

#define CONFIG_PATH "/water_flow/config.json"

#include <ArduinoJson.h>
#include "MQTTHandler.h"

// ===== Sample Structure =====
struct Sample {
    float flow_rate_lpm;     // Instantaneous flow (L/min)
    float total_volume_l;   // Accumulated volume (L)
    uint64_t timestamp_ms;
};

// ======================= Public API =======================
void setupWaterFlowSensor(MQTTHandler* mqttHandler);
void loopWaterFlowSensor();

// Update runtime config (generic JSON from MQTT)
void updateWaterFlowSensorConfig(const JsonDocument& cfg);