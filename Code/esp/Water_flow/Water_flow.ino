#include "ClassMQTT.h"
#include <ArduinoJson.h>

#define BUFFER_SIZE 10

const char* wifi_ssid = "TP-Link_B0E0";
const char* wifi_password = "89846834";
const char* mqtt_server = "192.168.0.77"; //pravilni IP najdemo pod cmd, ipconfig, IPv4 Address
const int mqtt_port = 1883;
const char* mqtt_topic = "water_flow";
const char* sensor_id = "flow_1";

ClassMQTT mqttClient(wifi_ssid, wifi_password, mqtt_server, mqtt_port, mqtt_topic, BUFFER_SIZE);

volatile double waterFlow;  //volatile- da se lahko spremenljivka spremeni kadarkoli

void IRAM_ATTR pulse() {   //void- zato, da funkcija ne vrača ničesar, atribut- oznaka, ki da navodila, kako naj ravna s funkcijo-kam se shrani, IRAM_ATTR- naj shrani v notranji RAM v ESP32
  waterFlow += 1.0 / 75.0; //na vsak pulz doda vodi 1/75 litra
}

void setup() {
  Serial.begin(9600);
  mqttClient.setupWiFi();
  mqttClient.setupMQTT();

  waterFlow = 0;

  pinMode(27, INPUT_PULLUP);  //na pin 27 pride signal iz senzorja, privzeto HIGH, ne pa da plava, ko stikalo/senzor poveže pin na GND, ostane LOW
  attachInterrupt(digitalPinToInterrupt(27), pulse, RISING); //ko vidi, da signal raste, pokliče funkcijo pulse, prekine rast
}

void loop() {
  static unsigned long lastRead = 0;
  unsigned long now = millis();
  if (now - lastRead < 500) return;  // 0.5 sekunde
  lastRead = now;

  Serial.print("Pretok vode: ");
  Serial.print(waterFlow, 3);  // izpiše do 3 decimalna mesta
  Serial.println(" L");

    // Use ArduinoJson to create JSON
  StaticJsonDocument<200> doc; // adjust size as needed
  doc["timestamp_us"] = now;
  doc["mqtt_topic"] = mqtt_topic;
  doc["sensor_id"] = sensor_id;
  doc["flow"] = waterFlow;

  String json;
  serializeJson(doc, json);

  mqttClient.dodajVBuffer(json);
  mqttClient.loop();
}
