#include <Wire.h>
#include <WiFi.h>
#include <ClassMQTT.h>
#include <PubSubClient.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "time.h"

#define LIS2DW12_ADDR 0x19
#define OUT_X_L 0x28

//spremenljivke iz configa
String wifi_ssid;
String wifi_password;
String mqtt_server;
int mqtt_port;
String mqtt_topic; 
String sensor_id;
float sensitivity;
int buffer_size;
int sampling_frequency;       
int range_g;
long gmt_offset_sec;          
int daylight_offset_sec;      

//buffer
struct Sample {
  float x, y, z;
  String datetime;   
};

Sample* samples = nullptr;
int sampleIndex = 0;

ClassMQTT* mqtt = nullptr;
unsigned long lastRead = 0;
unsigned long sampleIntervalMillis = 0;


bool saveConfig() {
  StaticJsonDocument<512> doc;
  doc["wifi_ssid"] = wifi_ssid;
  doc["wifi_password"] = wifi_password;
  doc["mqtt_server"] = mqtt_server;
  doc["mqtt_port"] = mqtt_port;
  doc["mqtt_topic"] = mqtt_topic;
  doc["sensor_id"] = sensor_id;
  doc["sensitivity"] = sensitivity;
  doc["buffer_size"] = buffer_size;
  doc["sampling_frequency_Hz"] = sampling_frequency;
  doc["range_g"] = range_g;
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



//da zloada config
bool loadConfig() {
  if (!LittleFS.begin()) { Serial.println("LittleFS mount failed"); return false; }
  if (!LittleFS.exists("/config.json")) { Serial.println("Config file not found"); return false; }

  File file = LittleFS.open("/config.json", "r");
  if (!file) { Serial.println("Failed to open config file"); return false; }

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();
  if (error) { Serial.print("JSON parse error: "); Serial.println(error.f_str()); return false; }

  wifi_ssid     = doc["wifi_ssid"].as<String>();
  wifi_password = doc["wifi_password"].as<String>();
  mqtt_server   = doc["mqtt_server"].as<String>();
  mqtt_port     = doc["mqtt_port"].as<int>();
  mqtt_topic    = doc["mqtt_topic"].as<String>();
  sensor_id     = doc["sensor_id"].as<String>();
  sensitivity   = doc["sensitivity"] | 0.000488;
  buffer_size   = doc["buffer_size"] | 10;
  sampling_frequency = doc["sampling_frequency_Hz"] | 200; 
  range_g       = doc["range_g"] | 16;
  gmt_offset_sec      = doc["gmt_offset_sec"] | 3600;
  daylight_offset_sec = doc["daylight_offset_sec"] | 3600;

  return true;
}


void setupAccelerometer() {
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x0F);
  Wire.endTransmission();
  Wire.requestFrom(LIS2DW12_ADDR, 1);
  if (Wire.available()) Serial.print("WHO_AM_I = 0x"), Serial.println(Wire.read(), HEX);
  else Serial.println("Error reading WHO_AM_I");

  uint8_t odr_reg_value = 0x60;
  if (sampling_frequency <= 1.6) odr_reg_value = 0x10;
  else if (sampling_frequency <= 12.5) odr_reg_value = 0x20;
  else if (sampling_frequency <= 25)  odr_reg_value = 0x30;
  else if (sampling_frequency <= 50)  odr_reg_value = 0x40;
  else if (sampling_frequency <= 100) odr_reg_value = 0x50;
  else if (sampling_frequency <= 200) odr_reg_value = 0x60;
  else if (sampling_frequency <= 400) odr_reg_value = 0x70;
  else if (sampling_frequency <= 800) odr_reg_value = 0x80;
  else if (sampling_frequency <= 1600) odr_reg_value = 0x90;

  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x20);
  Wire.write(odr_reg_value);
  Wire.endTransmission();

  uint8_t range_reg_value = 0x30;
  switch (range_g) {
    case 2:  range_reg_value = 0x00; break;
    case 4:  range_reg_value = 0x10; break;
    case 8:  range_reg_value = 0x20; break;
    case 16: range_reg_value = 0x30; break;
  }
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x25);
  Wire.write(range_reg_value);
  Wire.endTransmission();
}

//MQTT callback za prejete ukaze
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
  if (set == "sensitivity") {
    sensitivity = doc["value"];
    saveConfig();
  } else if (set == "sampling_frequency_Hz") {
    sampling_frequency = doc["value"];
    sampleIntervalMillis = 1000UL / sampling_frequency;
    setupAccelerometer();
    saveConfig();
  } else if (set == "range_g") {
    range_g = doc["value"];
    setupAccelerometer();
    saveConfig();
  } else if (set == "gmt_offset_sec") {
    gmt_offset_sec = doc["value"];
    saveConfig();
    configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  } else if (set == "daylight_offset_sec") {
    daylight_offset_sec = doc["value"];
    saveConfig();
    configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  } else if (set == "buffer_size") {
    buffer_size = doc["value"];
    saveConfig();
    mqtt->setBufferSize(buffer_size);
  }
}


void setup() {
  Serial.begin(230400);
  Wire.begin(21, 22);

  if (!loadConfig()) { Serial.println("Failed to load config"); while (true) delay(1000); }

  samples = new Sample[buffer_size];
  sampleIntervalMillis = 1000UL / sampling_frequency;

  mqtt = new ClassMQTT(wifi_ssid.c_str(), wifi_password.c_str(), mqtt_server.c_str(), mqtt_port, mqtt_topic.c_str(), 1);    // buffer size inside classmqtt is set to 1, because we send all samples in one json object
  mqtt->setCallback(mqttCallback);
  mqtt->setupWiFi();

  configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) Serial.println("Failed to obtain time");

  mqtt->setupMQTT();
  mqtt->subscribe("acceleration/cmd");
  setupAccelerometer();
  lastRead = millis();
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
  unsigned long now = millis();
  if (now - lastRead >= sampleIntervalMillis) {
    lastRead = now;

    uint8_t data[6];
    Wire.beginTransmission(LIS2DW12_ADDR);
    Wire.write(OUT_X_L | 0x80);
    Wire.endTransmission();
    Wire.requestFrom(LIS2DW12_ADDR, 6);
    for (int i = 0; i < 6; i++) if (Wire.available()) data[i] = Wire.read();

    int16_t x = (int16_t)(data[1] << 8 | data[0]);
    int16_t y = (int16_t)(data[3] << 8 | data[2]);
    int16_t z = (int16_t)(data[5] << 8 | data[4]);

    float ax = x * sensitivity;
    float ay = y * sensitivity;
    float az = z * sensitivity;

   //shrani v buffer
    samples[sampleIndex].x = ax;
    samples[sampleIndex].y = ay;
    samples[sampleIndex].z = az;
    samples[sampleIndex].datetime = getPreciseDatetime();   
    sampleIndex++;

   
    Serial.print(samples[sampleIndex-1].datetime);
    Serial.print(" x:"); Serial.print(ax,3);
    Serial.print(" y:"); Serial.print(ay,3);
    Serial.print(" z:"); Serial.println(az,3);

    //pošlje buffer
    if (sampleIndex >= buffer_size) {

      size_t capacity = JSON_OBJECT_SIZE(2) +                // root: meta + data
                  JSON_OBJECT_SIZE(2) +                // meta object
                  JSON_ARRAY_SIZE(buffer_size) +       // data array
                  buffer_size * JSON_OBJECT_SIZE(5) +  // samples
                  200;                                  // margin for strings

      DynamicJsonDocument doc(capacity);
      JsonObject meta = doc.createNestedObject("meta");
      meta["mqtt_topic"] = mqtt_topic;
      meta["sensor_id"] = sensor_id;

      JsonArray data = doc.createNestedArray("data");
      for (int i = 0; i < sampleIndex; i++) {
        JsonObject sample = data.createNestedObject();
        sample["datetime"] = samples[i].datetime;
        sample["ax_g"] = samples[i].x;
        sample["ay_g"] = samples[i].y;
        sample["az_g"] = samples[i].z;
      }
      String jsonObj;
      serializeJson(doc, jsonObj);

      size_t needed = measureJson(doc);
      Serial.print("JSON size: "); Serial.println(needed);
      Serial.print("capacity: "); Serial.println(capacity);

      mqtt->dodajVBuffer(jsonObj);
      sampleIndex = 0;
    }
  }
  
  mqtt->loop();
}

