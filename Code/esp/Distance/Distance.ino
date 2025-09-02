#include "DFRobot_VL6180X.h"
#include <ArduinoJson.h>
#include "ClassMQTT.h"
#include <LittleFS.h>
#include "time.h"

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
long gmt_offset_sec;        
int daylight_offset_sec;

ClassMQTT* mqttClient;

bool saveConfig() {
  StaticJsonDocument<512> doc;
  doc["wifi_ssid"] = wifi_ssid;
  doc["wifi_password"] = wifi_password;
  doc["mqtt_server"] = mqtt_server;
  doc["mqtt_port"] = mqtt_port;
  doc["mqtt_topic"] = mqtt_topic;
  doc["sensor_id"] = sensor_id;
  doc["buffer_size"] = buffer_size;
  doc["sampling_interval_ms"] = sampling_interval_ms;
  doc["gmt_offset_sec"] = gmt_offset_sec;
  doc["daylight_offset_sec"] = daylight_offset_sec;

  File file = LittleFS.open("/config.json", "w");
  if (!file) {
    Serial.println("Failed to open config file for writing");
    return false;
  }
  serializeJson(doc, file);
  file.close();
  Serial.println("Config saved to LittleFS.");
  return true;
}

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
  gmt_offset_sec      = doc["gmt_offset_sec"] | 3600;      
  daylight_offset_sec = doc["daylight_offset_sec"] | 3600;

  return true;
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  message.trim();

  Serial.print("Prejet ukaz na "); Serial.print(topic);
  Serial.print(": "); Serial.println(message);

  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.println("Invalid JSON in MQTT command");
    return;
  }

  String set = doc["set"] | "";
  if (set == "sampling_interval_ms") {
    sampling_interval_ms = doc["value"];
    saveConfig();
  } else if (set == "gmt_offset_sec") {
    gmt_offset_sec = doc["value"];
    saveConfig();
    configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  } else if (set == "daylight_offset_sec") {
    daylight_offset_sec = doc["value"];
    saveConfig();
    configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  }
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

  mqttClient->setCallback(mqttCallback);
  mqttClient->setupWiFi();

  configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) Serial.println("Failed to obtain time");

  mqttClient->setupMQTT();
    mqttClient->subscribe("distance/cmd");
}

String getPreciseDatetime() {
    struct timeval tv;
    gettimeofday(&tv, NULL); 

    time_t now = tv.tv_sec;
    struct tm timeinfo;
    localtime_r(&now, &timeinfo);

    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);

    char usec_buf[7];
    snprintf(usec_buf, sizeof(usec_buf), "%06ld", tv.tv_usec);

    return String(buf) + "." + String(usec_buf);
}

void loop() {
  static unsigned long lastRead = 0;
  unsigned long now = millis();
  if (now - lastRead < sampling_interval_ms) return;  // 1 Hz
  lastRead = now;

  String datetime = getPreciseDatetime();

  uint8_t izmerjenaRazdalja = VL6180X.rangePollMeasurement();
  uint8_t status = VL6180X.getRangeResult();

  if (status == VL6180X_NO_ERR) {
    Serial.print(datetime);
    Serial.print(" ");
    Serial.print("Range: ");
    Serial.print(izmerjenaRazdalja);
    Serial.println(" mm");

    // Using ArduinoJson to format JSON objekt:
    StaticJsonDocument<200> doc;  // adjust size if needed
    doc["timestamp_ms"] = now;
    doc["datetime"] = datetime; 
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

