#include "ClassMQTT.h"
#include <ArduinoJson.h>
#include <LittleFS.h>


int value;
const int sensorPin = 4;  // signal na pinu 4


String wifi_ssid;
String wifi_password;
String mqtt_server;
int mqtt_port;
String mqtt_topic;
String sensor_id;
int buffer_size;
unsigned long sampling_interval_ms;

ClassMQTT* mqttClient;

// nove spremenljivke
volatile unsigned long pulseCount = 0;
volatile unsigned long lastPulseMicros = 0;
volatile unsigned long pulseIntervalMicros = 0;

unsigned long lastCalcTime = 0;
float rpm = 0;
float omega = 0; // rad/s

const int pulsesPerRevolution = 1; 

// zaznavanje pulzov
void IRAM_ATTR countPulse() {
  unsigned long now = micros();
  if (lastPulseMicros > 0) {
    pulseIntervalMicros = now - lastPulseMicros;  // čas med impulzi
  }
  lastPulseMicros = now;
  pulseCount++;
}

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

  pinMode(sensorPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(sensorPin), countPulse, RISING); // šteje impulze
}

void loop() {
  mqttClient->loop();  // MQTT loop

  unsigned long now = millis();
  if (now - lastCalcTime >= sampling_interval_ms) {
    lastCalcTime = now;

    float calcRpm = 0;
    float calcOmega = 0;

 
    if (pulseIntervalMicros > 0 && (pulseIntervalMicros > 50000)) {
      // počasni obrati, čas med impulzi (<20 Hz)
      float freq = 1000000.0 / pulseIntervalMicros;
      calcRpm = (freq * 60.0) / pulsesPerRevolution;
      calcOmega = 2.0 * PI * freq / pulsesPerRevolution;
    } else {
      // hitri obrati, štetje impulzov v intervalu
      noInterrupts();
      unsigned long count = pulseCount;
      pulseCount = 0;
      interrupts();

      float freq = (count * 1000.0) / sampling_interval_ms;
      calcRpm = (freq * 60.0) / pulsesPerRevolution;
      calcOmega = 2.0 * PI * freq / pulsesPerRevolution;
    }

    rpm = calcRpm;
    omega = calcOmega;

    Serial.print("RPM: ");
    Serial.print(rpm);
    Serial.print("  Omega (rad/s): ");
    Serial.println(omega);

  
    StaticJsonDocument<200> doc;
    doc["timestamp_ms"] = now;
    doc["mqtt_topic"] = mqtt_topic;
    doc["sensor_id"] = sensor_id;
    doc["rpm"] = rpm;
    doc["omega_rad_s"] = omega;

    String json;
    serializeJson(doc, json);

    mqttClient->dodajVBuffer(json);
  }
}
