#include <Wire.h>
#include <WiFi.h>
#include <ClassMQTT.h>
#include <PubSubClient.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "time.h"

#define LIS2DW12_ADDR 0x19
#define OUT_X_L 0x28

// ---------------- CONFIG VARIABLES ----------------
String wifi_ssid;
String wifi_password;
String mqtt_server;
int mqtt_port;
String mqtt_topic;
String sensor_id;
float sensitivity;
int buffer_size;
int sampling_frequency;       // 🟩 zdaj bere iz config JSON
unsigned long send_interval_ms;
int range_g;

// ---------------- TIME OFFSETS ----------------
long gmt_offset_sec;          // 🟩 dodano: zamik časovnega pasu
int daylight_offset_sec;      // 🟩 dodano: poletni čas

// ---------------- DYNAMIC BUFFER ----------------
struct Sample {
  unsigned long timestamp;  
  float x, y, z;
};

Sample* samples = nullptr;
int sampleIndex = 0;

ClassMQTT* mqtt = nullptr;

unsigned long lastRead = 0;
unsigned long lastSend = 0;
unsigned long sampleIntervalMillis = 0;

float ax = 0, ay = 0, az = 0;

// ---------------- LOAD CONFIG ----------------
bool loadConfig() {
  if (!LittleFS.begin()) {
    Serial.println("LittleFS mount failed");
    return false;
  }

  if (!LittleFS.exists("/config.json")) {
    Serial.println("Config file not found");
    return false;
  }

  File file = LittleFS.open("/config.json", "r");
  if (!file) {
    Serial.println("Failed to open config file");
    return false;
  }

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.f_str());
    return false;
  }

  wifi_ssid     = doc["wifi_ssid"].as<String>();
  wifi_password = doc["wifi_password"].as<String>();
  mqtt_server   = doc["mqtt_server"].as<String>();
  mqtt_port     = doc["mqtt_port"].as<int>();
  mqtt_topic    = doc["mqtt_topic"].as<String>();
  sensor_id     = doc["sensor_id"].as<String>();
  sensitivity   = doc["sensitivity"] | 0.000488;
  buffer_size   = doc["buffer_size"] | 10;
  sampling_frequency = doc["sampling_frequency_Hz"] | 200; // 🟩 ime iz tvojega config
  send_interval_ms  = doc["send_interval_ms"] | 1000;
  range_g       = doc["range_g"] | 16;

  // 🟩 time offsets from config
  gmt_offset_sec      = doc["gmt_offset_sec"] | 3600;
  daylight_offset_sec = doc["daylight_offset_sec"] | 3600;

  Serial.println("Config loaded:");
  Serial.println("WiFi SSID: " + wifi_ssid);
  Serial.println("MQTT Server: " + mqtt_server);
  Serial.println("MQTT Port: " + String(mqtt_port));
  Serial.println("MQTT Topic: " + mqtt_topic);
  Serial.println("Sensor ID: " + sensor_id);
  Serial.println("Sensitivity: " + String(sensitivity));
  Serial.println("Buffer size: " + String(buffer_size));
  Serial.println("Sampling frequency: " + String(sampling_frequency) + " Hz");
  Serial.println("Send interval: " + String(send_interval_ms) + " ms");
  Serial.println("Range: ±" + String(range_g) + "g");
  Serial.println("GMT offset: " + String(gmt_offset_sec) + " sec");          // 🟩
  Serial.println("Daylight offset: " + String(daylight_offset_sec) + " sec"); // 🟩

  return true;
}

// ---------------- ACCELEROMETER SETUP ----------------
void setupAccelerometer() {
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x0F);
  Wire.endTransmission();
  Wire.requestFrom(LIS2DW12_ADDR, 1);
  if (Wire.available()) {
    uint8_t whoami = Wire.read();
    Serial.print("WHO_AM_I = 0x");
    Serial.println(whoami, HEX);
  } else {
    Serial.println("Error reading WHO_AM_I");
  }

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
  else {
    Serial.println("Invalid sampling frequency, defaulting to 200 Hz");
    odr_reg_value = 0x60;
  }

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

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(230400);
  Serial.println("Booting...");
  Wire.begin(21, 22);

  if (!loadConfig()) {
    Serial.println("Failed to load config, stopping...");
    while (true) { delay(1000); }
  }

  samples = new Sample[buffer_size];
  sampleIntervalMillis = 1000UL / sampling_frequency;

  mqtt = new ClassMQTT(
    wifi_ssid.c_str(),
    wifi_password.c_str(),
    mqtt_server.c_str(),
    mqtt_port,
    mqtt_topic.c_str(),
    buffer_size
  );

  mqtt->setupWiFi();

  // 🟩 setup NTP with offsets from config.json
  configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
  } else {
    Serial.println(&timeinfo, "NTP time synced: %Y-%m-%d %H:%M:%S");
  }

  mqtt->setupMQTT();
  setupAccelerometer();

  lastRead = millis();
  lastSend = millis();
  delay(100);
}

// ---------------- LOOP ----------------
void loop() {
  static unsigned long lastRead = 0;
  unsigned long now = millis();
  if (now - lastRead >= sampleIntervalMillis) {
    lastRead += sampleIntervalMillis;

    uint8_t data[6];
    Wire.beginTransmission(LIS2DW12_ADDR);
    Wire.write(OUT_X_L | 0x80);
    Wire.endTransmission();
    Wire.requestFrom(LIS2DW12_ADDR, 6);
    for (int i = 0; i < 6; i++) {
      if (Wire.available()) data[i] = Wire.read();
    }

    int16_t x = (int16_t)(data[1] << 8 | data[0]);
    int16_t y = (int16_t)(data[3] << 8 | data[2]);
    int16_t z = (int16_t)(data[5] << 8 | data[4]);

    ax = x * sensitivity;
    ay = y * sensitivity;
    az = z * sensitivity;

    if (sampleIndex < buffer_size) {
      samples[sampleIndex].timestamp = now;
      samples[sampleIndex].x = ax;
      samples[sampleIndex].y = ay;
      samples[sampleIndex].z = az;
      sampleIndex++;
    }
  }

  if (sampleIndex >= buffer_size || (millis() - lastSend >= send_interval_ms)) {
    for (int i = 0; i < sampleIndex; i++) {
      StaticJsonDocument<256> doc;

      // 🟩 datetime from NTP + millis for ms
      struct tm timeinfo;
      getLocalTime(&timeinfo);
      char timeString[64];
      strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);
      unsigned long ms = millis() % 1000;
      String datetime = String(timeString) + "." + String(ms, 3);

      doc["datetime"] = datetime;      // 🟩
      doc["mqtt_topic"] = mqtt_topic;
      doc["sensor_id"] = sensor_id;
      doc["ax_g"] = samples[i].x;
      doc["ay_g"] = samples[i].y;
      doc["az_g"] = samples[i].z;

      String jsonObj;
      serializeJson(doc, jsonObj);

      // 🟩 debug: show what is going to buffer
      Serial.println(jsonObj);

      mqtt->dodajVBuffer(jsonObj);
    }
    sampleIndex = 0;
    lastSend = millis();
  }

  Serial.print("t = ");
  Serial.print(now);
  Serial.print(" ms, X: "); 
  Serial.print(ax, 3);
  Serial.print(" g, Y: "); 
  Serial.print(ay, 3);
  Serial.print(" g, Z: "); 
  Serial.println(az, 3);

  mqtt->loop();
}
