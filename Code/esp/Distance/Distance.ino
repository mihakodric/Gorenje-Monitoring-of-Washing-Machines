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

// Data buffer
struct Sample {
  String datetime;   
  uint8_t range_mm;
};

Sample* samples = nullptr;
int sampleIndex = 0;


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


void publishConfig() {
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

  String json;
  serializeJson(doc, json);

  String configTopic = mqtt_topic + "/config";
  mqttClient->publish(configTopic.c_str(), json.c_str());
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

  bool configChanged = false;

  // Loop over all keys in the JSON
  for (JsonPair kv : doc.as<JsonObject>()) {
      const char* key = kv.key().c_str();

      if (strcmp(key, "sampling_interval_ms") == 0) {
          unsigned long newInterval = kv.value().as<unsigned long>();
          if (newInterval > 0) {
              sampling_interval_ms = newInterval;
              Serial.print("Sampling interval set to: ");
              Serial.println(sampling_interval_ms);
              configChanged = true;
          } else {
              Serial.println("Invalid sampling_interval_ms received, ignoring.");
          }
      } 
      else if (strcmp(key, "buffer_size") == 0) {
          int newBuffer = kv.value().as<int>();
          if (newBuffer > 0) {
              buffer_size = newBuffer;
              Serial.print("Buffer size set to: ");
              Serial.println(buffer_size);
              configChanged = true;
          } else {
              Serial.println("Invalid buffer_size received, ignoring.");
          }
      } 
      else if (strcmp(key, "gmt_offset_sec") == 0) {
          gmt_offset_sec = kv.value().as<long>();
          configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
          configChanged = true;
      } 
      else if (strcmp(key, "daylight_offset_sec") == 0) {
          daylight_offset_sec = kv.value().as<long>();
          configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
          configChanged = true;
      } 
      else {
          Serial.print("Unknown key received: ");
          Serial.println(key);
      }
  }

  if (configChanged) {
      if (saveConfig()) {
          Serial.println("Configuration updated and saved.");
      } else {
          Serial.println("Failed to save configuration.");
      }
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

  samples = new Sample[buffer_size];

    // Create MQTT client with loaded values
  mqttClient = new ClassMQTT(
    wifi_ssid.c_str(),
    wifi_password.c_str(),
    mqtt_server.c_str(),
    mqtt_port,
    mqtt_topic.c_str(),
    1
  );

  mqttClient->setCallback(mqttCallback);
  mqttClient->setupWiFi();

  configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) Serial.println("Failed to obtain time");

  String cmd_topic = sensor_id + "/cmd";

  mqttClient->setupMQTT();
  mqttClient->subscribe(cmd_topic.c_str());
  publishConfig();
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

    samples[sampleIndex].datetime = datetime;
    samples[sampleIndex].range_mm = izmerjenaRazdalja;
    sampleIndex++;

    // If buffer is full, send JSON
    if (sampleIndex >= buffer_size) {
      size_t capacity = JSON_OBJECT_SIZE(2) +                // root: meta + data
                        JSON_OBJECT_SIZE(2) +                // meta object
                        JSON_ARRAY_SIZE(buffer_size) +       // data array
                        buffer_size * JSON_OBJECT_SIZE(3) +  // each sample
                        200;                                 // margin for strings

      DynamicJsonDocument doc(capacity);

      JsonObject meta = doc.createNestedObject("meta");
      meta["mqtt_topic"] = mqtt_topic;
      meta["sensor_id"] = sensor_id;
      JsonArray data = doc.createNestedArray("data");
      for (int i = 0; i < sampleIndex; i++) {
        JsonObject sample = data.createNestedObject();
        sample["datetime"] = samples[i].datetime;
        sample["value"] = samples[i].range_mm;
      }

    String jsonObj;
    serializeJson(doc, jsonObj);
    mqttClient->dodajVBuffer(jsonObj);
    sampleIndex = 0; // reset buffer
    }

  } else {
    Serial.println("Napaka pri meritvi razdalje.");
  }

  mqttClient->loop();
}

