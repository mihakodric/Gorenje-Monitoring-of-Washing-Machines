// ======================= MQTTHandler.h =======================
#pragma once
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <functional>
#include "LedController.h"

class MQTTHandler {
public:
    // ----------------- Constructor -----------------
    MQTTHandler(const char* commonConfigPath,
                const char* deviceConfigPath,
                const char* deviceName);

    // ----------------- Core -----------------
    void begin();
    void loop();

    // Publish JSON data
    bool publishData(const JsonDocument& doc);

    bool publishCurrentConfig(const char* source);

    // Topic prefix for this device
    String getSensorTopic() const { return sensorTopic; }

    // Transmission control
    bool isTransmissionEnabled() const { return transmitEnabled; }

    // Callback for sensor modules when config changes
    void setConfigCallback(std::function<void(const JsonDocument&)> cb) {
        onConfigChanged = cb;
    }

    // LED blink helpers
    void blinkIdentify(uint8_t cycles = 10);
    void blinkConnect();
    void blinkSend();

private:
    // ----------------- Internal helpers -----------------
    void loadConfigs();
    void setupWiFi();
    void setupMQTT();
    void reconnect();
    void handleMQTTMessage(char* topic, byte* payload, unsigned int length);
    void processCommand(const String& cmd);
    void sendHeartbeat();

    // ----------------- Device config helpers -----------------
    void saveDeviceConfig();       
    void applyUpdatedConfig();     

private:
    // ----------------- Path strings -----------------
    String commonConfigPath;
    String deviceConfigPath;

    // ----------------- MQTT -----------------
    WiFiClient espClient;
    PubSubClient client;
    String brokerIP;
    int brokerPort;

    // ----------------- Topics -----------------
    String deviceName;
    String sensorTopic;
    String topicData;
    String topicHeartbeat;
    String topicCmd;
    String topicConfig;

    // ----------------- Generic device configuration -----------------
    JsonDocument deviceConfig;

    // ----------------- LED controller -----------------
    LedController* ledCtrl = nullptr;

    // ----------------- Heartbeat -----------------
    unsigned long lastHeartbeat = 0;
    const unsigned long heartbeatInterval = 10000;

    // ----------------- Transmission control -----------------
    bool transmitEnabled = false;

    // ----------------- Config-change callback -----------------
    std::function<void(const JsonDocument&)> onConfigChanged = nullptr;

    // ----------------- Current test/run tracking -----------------
    int currentTestId = -1;   // ID of currently running test
    int currentRunId  = -1;   // ID of currently running test run

    // ----------------- Deferred config-publish flag -----------------
    bool mustPublishConfig = false;
};
