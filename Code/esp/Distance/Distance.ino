#include "DFRobot_VL6180X.h"
#include <ArduinoJson.h>
#include "ClassMQTT.h"

#define BUFFER_SIZE 5

const char* wifi_ssid = "TP-Link_B0E0";
const char* wifi_password = "89846834";
const char* mqtt_server = "192.168.0.77"; //pravilni IP najdemo pod cmd, ipconfig, IPv4 Address
const int mqtt_port = 1883;                 //notebook odpremo z run as administrator in dodamo listener 1883 ter v drugo vrstico allow_anonymous true
const char* mqtt_topic = "distance";
const char* sensor_id = "dist_1";

DFRobot_VL6180X VL6180X;
ClassMQTT mqttHandler(ssid, password, mqtt_server, mqtt_port, mqtt_topic, BUFFER_SIZE);

void setup() {
  Serial.begin(9600);

  if (!VL6180X.begin()) {
    Serial.println("Napaka pri povezavi s senzorjem VL6180X!");
    while (1) delay(1000);
  }

  mqttHandler.setupWiFi();
  mqttHandler.setupMQTT();
}

void loop() {
  static unsigned long lastRead = 0;
  unsigned long now = micros();
  if (now - lastRead < 1000000) return;  // 1 Hz
  lastRead = now;

  Serial.print("t = ");
  Serial.print(now);
  Serial.print(" us, ");

  uint8_t izmerjenaRazdalja = VL6180X.rangePollMeasurement();
  uint8_t status = VL6180X.getRangeResult();

  if (status == VL6180X_NO_ERR) {
    Serial.print("Range: ");
    Serial.print(izmerjenaRazdalja);
    Serial.println(" mm");

    // Using ArduinoJson to format JSON objekt:
    StaticJsonDocument<200> doc;  // adjust size if needed

    doc["timestamp_us"] = now;
    doc["mqtt_topic"] = mqtt_topic;
    doc["sensor_id"] = sensor_id;
    doc["range_mm"] = izmerjenaRazdalja;

    String json;
    serializeJson(doc, json);
    mqttHandler.dodajVBuffer(json);

  } else {
    Serial.println("Napaka pri meritvi razdalje.");
  }

  mqttHandler.loop();
}

