#include "ClassMQTT.h"
#include <ArduinoJson.h>

#define BUFFER_SIZE 50

int value;

const int sensorPin = 4;  //signal na pinu 4

const char* wifi_ssid = "TP-Link_B0E0";
const char* wifi_password = "89846834";
const char* mqtt_server = "192.168.0.77"; //pravilni IP najdemo pod cmd, ipconfig, IPv4 Address
const int mqtt_port = 1883;                 //notebook odpremo z run as administrator in dodamo listener 1883 ter v drugo vrstico allow_anonymous true
const char* mqtt_topic = "infrared";
const char* sensor_id = "infra_1";

ClassMQTT mqttClient(wifi_ssid, wifi_password, mqtt_server, mqtt_port, mqtt_topic, BUFFER_SIZE);


void setup() {
  Serial.begin(115200);  

  mqttClient.setupWiFi();
  mqttClient.setupMQTT();

  pinMode(sensorPin, INPUT); //signal je vhodni
}

void loop() {
  static unsigned long lastRead = 0;
  unsigned long now = millis();
  if (now - lastRead < 200) return;  // 0.2 sekunde
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
  doc["timestamp_us"] = now;
  doc["mqtt_topic"] = mqtt_topic;
  doc["sensor_id"] = sensor_id;
  doc["yes_no"] = value;

  String json;
  serializeJson(doc, json);

  mqttClient.dodajVBuffer(json);
  mqttClient.loop();
}