// ======================= main.cpp =======================

// Device configuration
// CHANEGE THIS to a unique name for each device (e.g. "acc_1", "dist_2", etc.)
// =========================================================
const char* DEVICE_NAME = "dist_1";
// =========================================================

#include <Arduino.h>
#include <Wire.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "time.h"
#include "MQTTHandler.h"

#ifdef SENSOR_ACCEL
#include "accel_sensor.h"
#endif

#ifdef SENSOR_DIST
#include "dist_sensor.h"
#endif

#ifdef SENSOR_TEMP
#include "temperature_sensor.h"
#endif

#ifdef SENSOR_IR
#include "infrared_sensor.h"
#endif

#ifdef SENSOR_WATER_FLOW
#include "water_flow_sensor.h"
#endif

// Shared MQTT client
MQTTHandler* mqttClient = nullptr;

void setup() {
    Serial.begin(230400);
    delay(100);

    // Mount LittleFS
    if (!LittleFS.begin()) {
        Serial.println("Failed to mount LittleFS");
        while (true) delay(1000);
    }

    // --- Create MQTT handler ---
    #ifdef SENSOR_ACCEL
        mqttClient = new MQTTHandler(
            "/common/config.json",
            "/accelerometer/config.json",
            DEVICE_NAME
        );
    #endif

    #ifdef SENSOR_DIST
        mqttClient = new MQTTHandler(
            "/common/config.json",
            "/distance/config.json",
            DEVICE_NAME
        );
    #endif

    #ifdef SENSOR_TEMP
        mqttClient = new MQTTHandler(
            "/common/config.json",
            "/temperature/config.json",
            DEVICE_NAME
        );
    #endif

    #ifdef SENSOR_IR
        mqttClient = new MQTTHandler(
            "/common/config.json",
            "/infrared/config.json",
            DEVICE_NAME
        );
    #endif

    #ifdef SENSOR_WATER_FLOW
        mqttClient = new MQTTHandler(
            "/common/config.json",
            "/water_flow/config.json",
            DEVICE_NAME
        );
    #endif

    mqttClient->begin();

    // --- Configure NTP time from local server ---
    String ntpServer = mqttClient->getNtpServer();
    long gmtOffset = mqttClient->getGmtOffsetSec();
    long daylightOffset = mqttClient->getDaylightOffsetSec();
    
    Serial.printf("Configuring NTP: server=%s, GMT offset=%ld, DST offset=%ld\n", 
                  ntpServer.c_str(), gmtOffset, daylightOffset);
    
    configTime(gmtOffset, daylightOffset, ntpServer.c_str());

    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        Serial.println("Failed to obtain time from NTP server");
    } else {
        Serial.println("Time synchronized successfully");
    }

    // --- Setup sensor ---
    #ifdef SENSOR_ACCEL
        setupAccelerometer(mqttClient);
    #endif

    #ifdef SENSOR_DIST
        setupDistanceSensor(mqttClient);
    #endif

    #ifdef SENSOR_TEMP
        setupTemperatureSensor(mqttClient);
    #endif

    #ifdef SENSOR_IR
        setupInfraredSensor(mqttClient);
    #endif

    #ifdef SENSOR_WATER_FLOW
        setupWaterFlowSensor(mqttClient);
    #endif
}

void loop() {
    #ifdef SENSOR_ACCEL
        loopAccelerometer();
    #endif

    #ifdef SENSOR_DIST
        loopDistanceSensor();
    #endif

    #ifdef SENSOR_TEMP
        loopTemperatureSensor();
    #endif

    #ifdef SENSOR_IR
        loopInfraredSensor();
    #endif

    #ifdef SENSOR_WATER_FLOW
        loopWaterFlowSensor();
    #endif

    if (mqttClient) mqttClient->loop();
}
