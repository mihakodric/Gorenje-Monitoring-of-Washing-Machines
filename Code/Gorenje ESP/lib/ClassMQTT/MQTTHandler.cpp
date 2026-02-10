// ======================= MQTTHandler.cpp =======================
#include "MQTTHandler.h"
#include <Arduino.h>

// ---------------------- Constructor ----------------------
MQTTHandler::MQTTHandler(const char* commonPath,
                         const char* devicePath,
                         const char* name)
    : commonConfigPath(commonPath),
      deviceConfigPath(devicePath),
      deviceName(name),
      client(espClient)
{
    // ✅ Correct unified topic base
    sensorTopic   = String("sensors/") + deviceName;

    topicData      = sensorTopic + "/data";       // sensors/acc_1/data 
    topicHeartbeat = sensorTopic + "/heartbeat";  // sensors/acc_1/heartbeat 
    topicCmd       = sensorTopic + "/cmd";        // sensors/acc_1/cmd 
    topicConfig    = sensorTopic + "/config";     // sensors/acc_1/config

    // ✅ Initialize single LED on IO5 / D8
    ledCtrl = new LedController(5);
}

// ---------------------- begin ----------------------
void MQTTHandler::begin() {
    loadConfigs();
    setupWiFi();
    setupMQTT();
}

// ---------------------- Load JSON configs ----------------------
void MQTTHandler::loadConfigs() {
    // Load common config
    File f1 = LittleFS.open(commonConfigPath, "r");
    if (f1) {
        JsonDocument doc;
        deserializeJson(doc, f1);
        brokerIP = doc["mqtt_server"] | "";
        brokerPort = doc["mqtt_port"] | 1883;
        
        // Load NTP settings (use broker IP as NTP server if not specified)
        const char* ntpFromConfig = doc["ntp_server"] | "";
        if (ntpFromConfig && strlen(ntpFromConfig) > 0) {
            ntpServer = String(ntpFromConfig);
        } else {
            ntpServer = brokerIP;  // Default to same server as MQTT broker
        }
        gmtOffsetSec = doc["gmt_offset_sec"] | 3600;
        daylightOffsetSec = doc["daylight_offset_sec"] | 3600;
        
        f1.close();
        Serial.println("Loaded common config.");
        Serial.printf("NTP will use: %s\n", ntpServer.c_str());
    } else {
        Serial.println("Failed to load common config!");
    }

    // Load device config
    File f2 = LittleFS.open(deviceConfigPath, "r");
    if (f2) {
        deserializeJson(deviceConfig, f2);
        f2.close();
        Serial.println("Loaded device config.");
    } else {
        Serial.println("No device config found, using empty JSON.");
    }
}

// ---------------------- WiFi setup ----------------------
void MQTTHandler::setupWiFi() {
    File f = LittleFS.open(commonConfigPath, "r");
    if (!f) return;

    JsonDocument doc;
    deserializeJson(doc, f);
    f.close();

    String ssid = doc["wifi_ssid"] | "";
    String pass = doc["wifi_password"] | "";

    WiFi.begin(ssid.c_str(), pass.c_str());
    Serial.printf("Connecting to WiFi %s...\n", ssid.c_str());

    ledCtrl->blinkConnect();

    while (WiFi.status() != WL_CONNECTED) {
        unsigned long now = millis();
        if (now % 250 == 0) {
            Serial.print(".");
        }

        ledCtrl->loop();   // animates without interruption
    }

    Serial.println("\nWiFi connected.");
    ledCtrl->stop();
}


// ---------------------- MQTT setup ----------------------
void MQTTHandler::setupMQTT() {
    client.setServer(brokerIP.c_str(), brokerPort);
    Serial.printf("MQTT broker: %s:%d\n", brokerIP.c_str(), brokerPort);
    client.setCallback([this](char* t, byte* p, unsigned int l) {
        this->handleMQTTMessage(t, p, l);
    });
    client.setBufferSize(16384);  // Increased to 16KB for larger payloads
    reconnect();
}

// ---------------------- MQTT reconnect ----------------------
void MQTTHandler::reconnect() {
    static unsigned long lastAttempt = 0;
    if (client.connected()) return;

    unsigned long now = millis();
    if (now - lastAttempt < 500) return;

    lastAttempt = now;
    ledCtrl->blinkConnect();

    Serial.println("Connecting to MQTT...");
    if (client.connect(deviceName.c_str())) {
        Serial.println("MQTT connected.");
        client.subscribe(topicCmd.c_str());
        ledCtrl->stop();

        // FLAG: publish later
        mustPublishConfig = true;
    }
}


// ---------------------- MQTT message handler ----------------------
void MQTTHandler::handleMQTTMessage(char* topic, byte* payload, unsigned int length) {
    String msg;
    for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
    msg.trim();
    Serial.printf("MQTT CMD: %s\n", msg.c_str());
    processCommand(msg);
}

// ---------------------- Process commands ----------------------
void MQTTHandler::processCommand(const String& cmd) {
    JsonDocument doc;

    DeserializationError err = deserializeJson(doc, cmd);
    if (err) {
        Serial.println("Invalid JSON command");
        return;
    }

    const char* command = doc["cmd"];
    if (!command) {
        Serial.println("No cmd field in JSON");
        return;
    }

    String cmdStr = command;

    // ---------- IDENTIFY ----------
    if (cmdStr == "identify") {
        ledCtrl->blinkIdentify();
        return;
    }

    // ---------- START ----------
    if (cmdStr == "start") {
        if (doc["run_id"].is<int>())
            currentRunId = doc["run_id"].as<int>();

        if (doc["test_id"].is<int>())
            currentTestId = doc["test_id"].as<int>();

        transmitEnabled = true;

        Serial.printf(
            "DATA TRANSMISSION ENABLED for run_id %d, test_id %d\n",
            currentRunId, currentTestId
        );
        return;
    }

    // ---------- STOP ----------
    if (cmdStr == "stop") {
        if (doc["run_id"].is<int>()) {
            int stopRun = doc["run_id"].as<int>();
            if (stopRun != currentRunId) {
                Serial.println("Stop ignored: run_id mismatch");
                return;
            }
        }
        if (doc["test_id"].is<int>()) {
            int stopTest = doc["test_id"].as<int>();
            if (stopTest != currentTestId) {
                Serial.println("Stop ignored: test_id mismatch");
                return;
            }
        }

        transmitEnabled = false;
        Serial.println("DATA TRANSMISSION DISABLED");
        return;
    }


    // ---------- CONFIG UPDATE ----------
    if (cmdStr == "update_config") {
        if (transmitEnabled) {
            Serial.println("Config update ignored: transmission is enabled");
            return;
        }
        if (!doc["config"].is<JsonObject>()) {
            Serial.println("Invalid config field in JSON");
            return;
        }

        JsonObject cfg = doc["config"].as<JsonObject>();
        for (auto kv : cfg) {
            deviceConfig[kv.key().c_str()] = kv.value();
        }

        saveDeviceConfig();

        if (onConfigChanged)
            onConfigChanged(deviceConfig);

        bool ok = publishCurrentConfig("update");   // ✅ SYNC BACK TO FRONTEND

        Serial.println("Config merged + saved.");

        if (ok && doc["restart"].as<bool>()) {
            delay(500);
            ESP.restart();
        }
        return;
    }

    // ---------- CURRENT CONFIG ----------
    if (cmdStr == "get_config") {
        publishCurrentConfig("request");
        Serial.println("Published current config.");
        return;
    }

    Serial.printf("Unknown command: %s\n", cmdStr.c_str());
}


// ---------------------- Save device config ----------------------
void MQTTHandler::saveDeviceConfig() {
    File f = LittleFS.open(deviceConfigPath, "w");
    if (f) {
        serializeJson(deviceConfig, f);
        f.close();
        Serial.println("Device config saved.");
    } else {
        Serial.println("Failed to save device config!");
    }
}

// ---------------------- Heartbeat ----------------------
void MQTTHandler::sendHeartbeat() {
    JsonDocument hb;
    hb["alive"] = true;
    hb["ts"] = millis();

    String out;
    serializeJson(hb, out);
    client.publish(topicHeartbeat.c_str(), out.c_str());
}

// ---------------------- Publish data ----------------------
bool MQTTHandler::publishData(const JsonDocument& doc) {
    if (!transmitEnabled || !client.connected()) return false;

    JsonDocument payload;
    payload["run_id"] = currentRunId;
    payload["test_id"] = currentTestId;

     // iterate a const JsonDocument
    JsonObjectConst obj = doc.as<JsonObjectConst>();
    for (JsonPairConst kv : obj) {
        payload[kv.key()] = kv.value();
    }

    String out;
    serializeJson(payload, out);

    Serial.printf("[MQTT] Payload size: %d bytes\n", out.length());
    Serial.printf("[MQTT] Publishing data at topic %s... ", topicData.c_str());
    Serial.print("MQTT state: ");
    Serial.println(client.state());

    client.loop();

    bool ok = client.publish(
        topicData.c_str(),
        (const uint8_t*)out.c_str(),
        out.length(),
        false
    );

    if (ok) {
        ledCtrl->blinkSend();
    } else {
        Serial.printf("[MQTT] Publish failed - payload size %d may exceed buffer\n", out.length());
    }

    return ok;
}

bool MQTTHandler::publishCurrentConfig(const char* source) {
    if (!client.connected()) return false;

    JsonDocument doc;
    doc["source"] = source;
    doc["ts"] = millis();

    // create config object
    JsonObject cfg = doc.createNestedObject("config");

    // Copy all stored config fields
    for (auto kv : deviceConfig.as<JsonObject>()) {
        cfg[kv.key()] = kv.value();
    }

    String out;
    serializeJson(doc, out);

    client.publish(topicConfig.c_str(), out.c_str(), true); // ✅ retained
    Serial.println("Auto-published current config.");
    return true;
}



// ---------------------- Main loop ----------------------
void MQTTHandler::loop() {
    // 1. Maintain MQTT connection
    if (!client.connected()) {
        reconnect();
        return;             // ← Prevent double-calling client.loop() while reconnecting
    }

    // 2. Process MQTT traffic
    client.loop();

    // 3. If we owe the broker a config publish, do it only AFTER loop() is stable
    if (mustPublishConfig && client.connected()) {
        if (publishCurrentConfig("boot")) {
            mustPublishConfig = false;
        }
    }

    // 4. Update LED
    ledCtrl->loop();

    // 5. Heartbeat
    if (millis() - lastHeartbeat > heartbeatInterval) {
        lastHeartbeat = millis();
        sendHeartbeat();
    }
}


// ---------------------- LED wrappers ----------------------
void MQTTHandler::blinkIdentify(uint8_t cycles) {
    ledCtrl->blinkIdentify(cycles);
}

void MQTTHandler::blinkConnect() {
    ledCtrl->blinkConnect();
}

void MQTTHandler::blinkSend() {
    ledCtrl->blinkSend();
}
