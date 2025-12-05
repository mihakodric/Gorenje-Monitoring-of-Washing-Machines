#ifndef CLASS_MQTT_H
#define CLASS_MQTT_H

#include <WiFi.h>
#include <PubSubClient.h> //na računalniku pod Rduino libraries v PubSubCliebt.h nastavimo: #define MQTT_MAX_PACKET_SIZE 5120

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
  bool publish(const char* topic, const char* payload);

  void setCallback(MQTT_CALLBACK_SIGNATURE);  // nastavi callback funkcijo
  void subscribe(const char* topic); 

  void setBufferSize(int newSize);

private:
  void poveziMQTT();

  const char* ssid;
  const char* password;
  const char* mqttServer;
  const int mqttPort;
  const char* topic;
  int bufferSize;

  WiFiClient espClient;
  PubSubClient client;

  String* buffer; // Shranjuje JSON objekte
  int bufferIndex;
};

#endif
