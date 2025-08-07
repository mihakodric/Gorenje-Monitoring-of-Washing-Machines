#ifndef CLASS_MQTT_H
#define CLASS_MQTT_H

#include <WiFi.h>
#include <PubSubClient.h>

class ClassMQTT {
public:
  ClassMQTT(const char* ssid, const char* password,
            const char* mqttServer, int mqttPort,
            const char* topic, int bufferSize);

  void setupWiFi();
  void setupMQTT();
  void loop();

  void dodajVBuffer(String jsonObject);  // Dodamo JSON kot string
  void posljiBuffer();                  // Pošlje celoten array JSON-ov

private:
  void poveziMQTT();

  const char* ssid;
  const char* password;
  const char* mqttServer;
  const int mqttPort;
  const char* topic;
  const int bufferSize;

  WiFiClient espClient;
  PubSubClient client;

  String* buffer; // Shranjuje JSON objekte
  int bufferIndex;
};

#endif
