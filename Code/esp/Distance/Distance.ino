#include "DFRobot_VL6180X.h"
#include <ArduinoJson.h>
#include "ClassMQTT.h"
#include <LittleFS.h>

DFRobot_VL6180X VL6180X;

// Config variables loaded from JSON
String wifi_ssid;
String wifi_password;
String mqtt_server;
int mqtt_port;
String mqtt_topic;
String sensor_id;
int buffer_size;
unsigned long sampling_interval_ms;

ClassMQTT* mqttClient;

// Load config from LittleFS
bool loadConfig() {
  if (!LittleFS.begin()) {
    Serial.println("Failed to mount LittleFS!");
    return false;
  }

  File file = LittleFS.open("/config.json", "r");
  if (!file) {
    Serial.println("Failed to open config.json");
    return false;
  }

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error) {
    Serial.print("Failed to parse config.json: ");
    Serial.println(error.c_str());
    return false;
  }

  wifi_ssid            = doc["wifi_ssid"] | "TP-Link_B0E0";
  wifi_password        = doc["wifi_password"] | "89846834";
  mqtt_server          = doc["mqtt_server"] | "192.168.0.77";
  mqtt_port            = doc["mqtt_port"] | 1883;
  mqtt_topic           = doc["mqtt_topic"] | "distance";
  sensor_id            = doc["sensor_id"] | "dist_1";
  buffer_size          = doc["buffer_size"] | 5;
  sampling_interval_ms = doc["sampling_interval_ms"] | 100;

  return true;
}

void setup() {
  Serial.begin(115200);

  
  if (!loadConfig()) {
    Serial.println("Config load failed! Stopping.");
    while (true) delay(1000);
  }

  if (!VL6180X.begin()) {
    Serial.println("Napaka pri povezavi s senzorjem VL6180X!");
    while (1) delay(1000);
  }

    // Create MQTT client with loaded values
  mqttClient = new ClassMQTT(
    wifi_ssid.c_str(),
    wifi_password.c_str(),
    mqtt_server.c_str(),
    mqtt_port,
    mqtt_topic.c_str(),
    buffer_size
  );

  mqttClient->setupWiFi();
  mqttClient->setupMQTT();
}



void loop() {
  static unsigned long lastRead = 0;
  unsigned long now = millis();
  if (now - lastRead < sampling_interval_ms) return;  // 1 Hz
  lastRead = now;

  Serial.print("t = ");
  Serial.print(now);
  Serial.print(" ms, ");

  uint8_t izmerjenaRazdalja = VL6180X.rangePollMeasurement();
  uint8_t status = VL6180X.getRangeResult();

  if (status == VL6180X_NO_ERR) {
    Serial.print("Range: ");
    Serial.print(izmerjenaRazdalja);
    Serial.println(" mm");

    // Using ArduinoJson to format JSON objekt:
    StaticJsonDocument<200> doc;  // adjust size if needed
    doc["timestamp_ms"] = now;
    doc["mqtt_topic"] = mqtt_topic;
    doc["sensor_id"] = sensor_id;
    doc["range_mm"] = izmerjenaRazdalja;

    String json;
    serializeJson(doc, json);
    mqttClient->dodajVBuffer(json);

  } else {
    Serial.println("Napaka pri meritvi razdalje.");
  }

  mqttClient->loop();
}

