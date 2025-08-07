#include "DFRobot_VL6180X.h"
#include "ClassMQTT.h"

#define BUFFER_SIZE 5

const char* ssid = "TP-Link_B0E0";
const char* password = "89846834";
const char* mqtt_server = "192.168.0.106";
const int mqtt_port = 1883;
const char* mqtt_tema = "razdalja";

DFRobot_VL6180X VL6180X;
ClassMQTT mqttHandler(ssid, password, mqtt_server, mqtt_port, mqtt_tema, BUFFER_SIZE);

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

    // Tukaj sama definiraš format JSON objekta:
    String json = "{";
    json += "\"timestamp_us\":" + String(now) + ",";
    json += "\"range_mm\":" + String(izmerjenaRazdalja);
    json += "}";

    mqttHandler.dodajVBuffer(json);

  } else {
    Serial.println("Napaka pri meritvi razdalje.");
  }

  mqttHandler.loop();
}

