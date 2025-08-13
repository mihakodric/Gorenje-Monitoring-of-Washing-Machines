#include "ClassMQTT.h"
#include <ArduinoJson.h>
#include <LittleFS.h>


int value;
const int sensorPin = 4;  //signal na pinu 4

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
  mqtt_topic           = doc["mqtt_topic"] | "infrared";
  sensor_id            = doc["sensor_id"] | "infra_x";
  buffer_size          = doc["buffer_size"] | 50;
  sampling_interval_ms = doc["sampling_interval_ms"] | 200;

  return true;
}

void setup() {
  Serial.begin(115200);  

  if (!loadConfig()) {
    Serial.println("Config load failed! Stopping.");
    while (true) delay(1000);
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

  pinMode(sensorPin, INPUT); //signal je vhodni
}

void loop() {
  static unsigned long lastRead = 0;
  unsigned long now = millis();
  if (now - lastRead < sampling_interval_ms) return;  // 0.2 sekunde
  lastRead = now;

  int sensorValue = digitalRead(sensorPin); //bere stanje senzorja

  if (sensorValue == 0) {
    Serial.println("Objekt zaznan!");  // IR svetloba se odbija nazaj, predmet je blizu, bela barva
    value = 1;
  } 
  else {
    Serial.println("Ni objekta.");      // ni odboja, ni predmeta pred senzorjem, črna barva
    value = 0;
  }

  // Use ArduinoJson to create JSON
  StaticJsonDocument<200> doc; // adjust size as needed
  doc["timestamp_ms"] = now;
  doc["mqtt_topic"] = mqtt_topic;
  doc["sensor_id"] = sensor_id;
  doc["yes_no"] = value;

  String json;
  serializeJson(doc, json);

  mqttClient->dodajVBuffer(json);
  mqttClient->loop();
}