#include "DFRobot_VL6180X.h"
#include <WiFi.h>
#include <PubSubClient.h> //na računalniku pod Rduino libraries v PubSubCliebt.h nastavimo: #define MQTT_MAX_PACKET_SIZE 4096

const char* ssid = "TP-Link_B0E0";
const char* password = "89846834";

const char* mqtt_server = "192.168.0.106";  //pravilni IP najdemo pod cmd, ipconfig, IPv4 Address
const int mqtt_port = 1883;                 //notebook odpremo z run as administrator in dodamo listener 1883 ter v drugo vrstico allow_anonymous true
const char* mqtt_tema = "razdalja";         //v ozadju tečecmd, notri vpišemo "C:\Program Files\mosquitto\mosquitto.exe" -c "C:\Program Files\mosquitto\mosquitto.conf" -v


const int BUFFER_SIZE = 5;
struct Sample {
  unsigned long timestamp;
  float range;
};

Sample buffer[BUFFER_SIZE];
int bufferIndex = 0;

WiFiClient espClient;
PubSubClient client(espClient);

DFRobot_VL6180X VL6180X;

void povezi_MQTT() {
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

void posljiBufferMQTT() {
  if (bufferIndex == 0) return;

  String json = "[";
  for (int i = 0; i < bufferIndex; i++) {
    json += "{";
    json += "\"timestamp_us\":" + String(buffer[i].timestamp) + ",";
    json += "\"range_mm\":" + String(buffer[i].range, 2);
    json += "}";
    if (i < bufferIndex - 1) json += ",";
  }
  json += "]";

  if (!client.connected()) {
    povezi_MQTT();
  }

  if (client.publish(mqtt_tema, json.c_str())) {
    Serial.println("Buffer poslan preko MQTT.");
    bufferIndex = 0;
  } else {
    Serial.println("Napaka pri pošiljanju preko MQTT.");
  }
}

void setup() {
  Serial.begin(9600);

  if (!VL6180X.begin()) { //inicializacija senzorja
    Serial.println("Napaka pri povezavi s senzorjem VL6180X!");
    while (1) delay(1000); 
  }

  WiFi.begin(ssid, password);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > 15000) {
      Serial.println("Neuspešna povezava na WiFi.");
      break;
    }
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi povezan.");
    Serial.print("ESP IP: ");
    Serial.println(WiFi.localIP());
  }

  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  static unsigned long lastRead = 0;
  unsigned long now = micros();
  if (now - lastRead < 1000000) return;  // 1 Hz branje 
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

    if (bufferIndex < BUFFER_SIZE) {
      buffer[bufferIndex].timestamp = now;
      buffer[bufferIndex].range = izmerjenaRazdalja;
      bufferIndex++;
    }

    if (bufferIndex >= BUFFER_SIZE) {
      posljiBufferMQTT();
    }
  } else {
    Serial.println("Napaka pri meritvi razdalje.");
  }

  client.loop(); 
}
