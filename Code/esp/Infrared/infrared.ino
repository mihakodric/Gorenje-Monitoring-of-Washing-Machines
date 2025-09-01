#include <Arduino.h>
#include <Ticker.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include "ClassMQTT.h"
#include "time.h"


volatile unsigned int counter = 0;
volatile unsigned long lastMicros = 0;
const int sensorPin = 4;
volatile bool newData = false;
unsigned int lastCount = 0;

// --- Config variables loaded from JSON ---
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

// --- MQTT client pointer ---
ClassMQTT* mqttClient;

Ticker timerTicker;  // software timer


void IRAM_ATTR blink() {
  unsigned long now = micros();
  if (now - lastMicros > 1000) {
    counter++;
    lastMicros = now;
  }
}

void onTimer() {
  lastCount = counter;
  counter = 0;
  newData = true;
  // Serial.printf("Pulses counted: %u in %lu ms\n", lastCount, sampling_interval_ms);
}

// --- Load config from LittleFS ---
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
  sensor_id            = doc["sensor_id"] | "infra_1";
  buffer_size          = doc["buffer_size"] | 50;
  sampling_interval_ms = doc["sampling_interval_ms"] | 5000;  // default 5s
  gmt_offset_sec      = doc["gmt_offset_sec"] | 3600;
  daylight_offset_sec = doc["daylight_offset_sec"] | 3600;

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

  configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) Serial.println("Failed to obtain time");

  mqttClient->setupMQTT();

  pinMode(sensorPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(sensorPin), blink, CHANGE);

  // Start timer with sampling interval from config
  timerTicker.attach_ms(sampling_interval_ms, onTimer);
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
  mqttClient->loop();

  if (newData) {
    newData = false;

    float rotations = (lastCount / 2.0) / (sampling_interval_ms / 1000.0) * 60;  // obrati/min
    float omega = 2.0 * PI * rotations; // rad/s

    Serial.print("The speed of the motor: ");
    Serial.print(rotations);
    Serial.print(" round/s, Omega: ");
    Serial.print(omega);
    Serial.println(" rad/s");

    // Build JSON object with ArduinoJson
    StaticJsonDocument<200> doc;
    doc["datetime"] = getPreciseDatetime();
    doc["sensor_id"] = sensor_id;
    doc["mqtt_topic"] = mqtt_topic;
    doc["rotations"] = rotations;
    //doc["omega"] = omega;

    String output;
    serializeJson(doc, output);

    // Add JSON string to MQTT buffer
    mqttClient->dodajVBuffer(output);
  }
}

