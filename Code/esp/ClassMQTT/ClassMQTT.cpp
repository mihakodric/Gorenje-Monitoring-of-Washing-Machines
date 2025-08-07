#include "ClassMQTT.h"

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
