#include <Arduino.h>
#include <Ticker.h>
#include <ArduinoJson.h>
#include "ClassMQTT.h"

volatile unsigned int counter = 0;
const int sensorPin = 4;
volatile unsigned long lastMicros = 0;

Ticker timerTicker;  // software timer

volatile bool newData = false;
unsigned int lastCount = 0;

ClassMQTT mqtt("TP-Link_B0E0", "89846834",
               "192.168.0.77", 1883,
               "infrared", 10);

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
}



void setup() {
  Serial.begin(115200);

  pinMode(sensorPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(sensorPin), blink, CHANGE);

  // timer vsakih 1 s
  timerTicker.attach(1.0, onTimer);  // 1.0 = interval v sekundah

  // Setup Wi-Fi and MQTT
  mqtt.setupWiFi();
  mqtt.setupMQTT();
}

void loop() {
  mqtt.loop();

  if (newData) {
    newData = false;

    float rotations = lastCount / 2.0;
    float omega = 2.0 * PI * rotations; // rad/s

    Serial.print("The speed of the motor: ");
    Serial.print(rotations);
    Serial.print(" round/s, Omega: ");
    Serial.print(omega);
    Serial.println(" rad/s");

    // Build JSON object with ArduinoJson
    StaticJsonDocument<200> doc;
    doc["rotations"] = rotations;
    doc["omega"] = omega;

    String output;
    serializeJson(doc, output);

    // Add JSON string to MQTT buffer
    mqtt.dodajVBuffer(output);
  }
}

