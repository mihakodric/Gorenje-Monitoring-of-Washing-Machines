#include "ClassMQTT.h"
#include <Arduino.h>

ClassMQTT::ClassMQTT(const char* ssid, const char* password,
                     const char* mqttServer, int mqttPort,
                     const char* topic, int bufferSize)
  : ssid(ssid), password(password), mqttServer(mqttServer),
    mqttPort(mqttPort), topic(topic), bufferSize(bufferSize),
    client(espClient), bufferIndex(0) {
  buffer = new String[bufferSize];
}

void ClassMQTT::setupWiFi() {
  WiFi.begin(ssid, password);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > 15000) {
      Serial.println("Neuspešna povezava na WiFi.");
      return;
    }
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi povezan.");
  Serial.print("ESP IP: ");
  Serial.println(WiFi.localIP());
}

void ClassMQTT::setupMQTT() {
  client.setServer(mqttServer, mqttPort);


  while (!client.connected()) {
    if (client.connect("ESP32Client")) {
      Serial.println("Povezan na MQTT.");
    } else {
      Serial.print("Ni povezano, rc = ");
      Serial.println(client.state());
      delay(2000);
    }
  }
}


void ClassMQTT::setCallback(MQTT_CALLBACK_SIGNATURE) {
    client.setCallback(callback);
}

void ClassMQTT::subscribe(const char* topic) {
    client.subscribe(topic);
}


void ClassMQTT::poveziMQTT() {
  while (!client.connected()) {
    if (client.connect("ESP32Client")) {
      Serial.println("Povezan na MQTT.");
    } else {
      Serial.print("Ni povezano, rc = ");
      Serial.println(client.state());
      delay(5000);
    }
  }
}

bool ClassMQTT::publish(const char* topic, const char* payload) {
    if (!client.connected()) {
        poveziMQTT();
    }
    return client.publish(topic, payload);
}

void ClassMQTT::dodajVBuffer(String jsonObject) {
  if (bufferIndex < bufferSize) {
    buffer[bufferIndex] = jsonObject;
    bufferIndex++;
  }

  if (bufferIndex >= bufferSize) {
    posljiBuffer();
  }
}

void ClassMQTT::posljiBuffer() {
  if (bufferIndex == 0) return;

  String jsonArray = "[";
  for (int i = 0; i < bufferIndex; i++) {
    jsonArray += buffer[i];
    if (i < bufferIndex - 1) jsonArray += ",";
  }
  jsonArray += "]";

  if (!client.connected()) {
    poveziMQTT();
  }

  if (client.publish(topic, jsonArray.c_str())) {
    Serial.println("Buffer poslan preko MQTT.");
    bufferIndex = 0;
  } else {
    Serial.println("Napaka pri pošiljanju preko MQTT.");
  }
}

void ClassMQTT::loop() {
  client.loop();
}

void ClassMQTT::setBufferSize(int newSize) {
    if (newSize <= 0 || newSize == bufferSize) return;

    String* newBuffer = new String[newSize];
    int copyCount = (bufferIndex < newSize) ? bufferIndex : newSize;
    for (int i = 0; i < copyCount; i++) {
        newBuffer[i] = buffer[i];
    }
    delete[] buffer;
    buffer = newBuffer;
    bufferSize = newSize;
    if (bufferIndex > bufferSize) bufferIndex = bufferSize;

    Serial.print("Buffer size posodobljen: "); Serial.println(bufferSize);
}