#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <ArduinoOTA.h> 

#define LIS2DW12_ADDR 0x19
#define OUT_X_L 0x28

const char* ssid = "TP-Link_B0E0";
const char* password = "89846834";

const char* mqtt_server = "192.168.0.106";
const int mqtt_port = 1883;
const char* mqtt_tema = "pospesek";

WebServer server(80); //privzeta povezava na port 80 v brskalniku

float ax = 0, ay = 0, az = 0;

const int BUFFER_SIZE = 50;  
struct Sample {                //v sample shranjuje čas, x, y, z
  unsigned long timestamp;
  float x, y, z;
};

Sample buffer[BUFFER_SIZE];    //polje, buffer, veliko do buffer_size
int bufferIndex = 0;           //v katero mesto v bufferju shranjuje, na začetku na prvem

WiFiClient espClient;
PubSubClient client(espClient);

void povezi_MQTT() {
  while (!client.connected()) {
    Serial.print("Povezujem na MQTT...");
    if (client.connect("ESP32Client")) {
      Serial.println("Povezano!");
    } else {
      Serial.print("Ni povezano, rc =");
      Serial.print(client.state());
      Serial.println("Poskusam znova v 5s");
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
    json += "\"ax_g\":" + String(buffer[i].x, 3) + ",";
    json += "\"ay_g\":" + String(buffer[i].y, 3) + ",";
    json += "\"az_g\":" + String(buffer[i].z, 3);
    json += "}";
    if (i < bufferIndex - 1) json += ",";
  }
  json += "]";

  if (!client.connected()) {
    povezi_MQTT();
  }

  boolean uspeh = client.publish(mqtt_tema, json.c_str());
  if (uspeh) {
    Serial.println("Buffer poslan preko MQTT.");
    bufferIndex = 0;
  } else {
    Serial.println("Napaka pri posiljanju preko MQTT.");
  }
}

void setup() {
  Serial.begin(230400);
  Wire.begin(21, 22);

  delay(1000);

  Serial.print("Povezujem na WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  unsigned long startAttemptTime = millis(); //čas od zagona esp32, shrani v spremenljivko, unsigned long pa zato, ker je lahko zelo dolgo število
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startAttemptTime > 30000) {  //če se po tolikem času ne odzove
      Serial.println("\nNeuspešna povezava na WiFi.");
      break;
    }
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nPovezan na WiFi!");
    Serial.print("IP naslov ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi ni povezan.");
  }

    ArduinoOTA.setHostname("esp32-pospesek");
  ArduinoOTA.onStart([]() {
    Serial.println("Zagon OTA posodobitve...");
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("\nPosodobitev končana.");
  });
  ArduinoOTA.onProgress([](unsigned int napredek, unsigned int total) {
    Serial.printf("Napredek: %u%%\r", (napredek / (total / 100)));
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("Napaka OTA [%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("Avtentikacija neuspešna");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Napaka na začetku");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Napaka pri povezavi");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Napaka pri prejemu");
    else if (error == OTA_END_ERROR) Serial.println("Napaka pri zaključku");
  });
  ArduinoOTA.begin();
  Serial.println("OTA pripravljeno.");

  client.setServer(mqtt_server, mqtt_port);

  server.on("/", []() {  //namesto v html pošiljanje v json formatu
    String json = "{";
    json += "\"timestamp_us\":" + String(micros()) + ",";
    json += "\"ax_g\":" + String(ax, 3) + ",";
    json += "\"ay_g\":" + String(ay, 3) + ",";
    json += "\"az_g\":" + String(az, 3);
    json += "}";
    server.send(200, "application/json", json);
  });

  server.on("/buffer", []() {  //ob dostopu na buffer se izvede naslednja funkcija
    String json = "[";
    for (int i = 0; i < bufferIndex; i++) {
      json += "{";
      json += "\"timestamp_us\":" + String(buffer[i].timestamp) + ",";
      json += "\"ax_g\":" + String(buffer[i].x, 3) + ",";
      json += "\"ay_g\":" + String(buffer[i].y, 3) + ",";
      json += "\"az_g\":" + String(buffer[i].z, 3);
      json += "}";
      if (i < bufferIndex - 1) json += ",";
    }
    json += "]";
    server.send(200, "application/json", json); //tip vsebine je application/json
    bufferIndex = 0;
  });

  server.begin();
  Serial.println("Web strežnik zagnan.");

  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x0F);
  Wire.endTransmission();
  Wire.requestFrom(LIS2DW12_ADDR, 1);
  if (Wire.available()) {
    uint8_t whoami = Wire.read();
    Serial.print("WHO_AM_I = 0x");
    Serial.println(whoami, HEX);
  } else {
    Serial.println("Napaka pri branju WHO_AM_I");
  }

  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x20);
  Wire.write(0x83);  // 200 Hz, vsi osi enable
  Wire.endTransmission();

  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x25);
  Wire.write(0x30);  // ±16g občutljivost ( default je ±2g občutljivost, 0x00)
  Wire.endTransmission();

  delay(100);
}

void loop() {
  server.handleClient();  // WiFi strežnik obravnava klice

  //preverjanje ukaza preko serije
  if (Serial.available() > 0) {
    String ukaz = Serial.readStringUntil('\n');
    ukaz.trim();
    if (ukaz == "preberi_iz_bufferja") {
      String json = "[";
      for (int i = 0; i < bufferIndex; i++) {
        json += "{";
        json += "\"timestamp_us\":" + String(buffer[i].timestamp) + ",";
        json += "\"ax_g\":" + String(buffer[i].x, 3) + ",";
        json += "\"ay_g\":" + String(buffer[i].y, 3) + ",";
        json += "\"az_g\":" + String(buffer[i].z, 3);
        json += "}";
        if (i < bufferIndex - 1) json += ",";
      }
      json += "]";
      Serial.println(json);  // Pošlji JSON na serijo
      bufferIndex = 0;       // Po pošiljanju resetiraj buffer
    }
  }

  static unsigned long lastRead = 0;  //static- da si zapomni tudi ob naslednjih loopih, da teče naprej
  unsigned long now = micros();  //šteje čas od prej do zdaj
  if (now - lastRead < 5000) return; // 1600 Hz = vsakih 625 mikrosekund
  lastRead = now;

  uint8_t data[6];
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(OUT_X_L | 0x80);
  Wire.endTransmission();

  Wire.requestFrom(LIS2DW12_ADDR, 6);

  for (int i = 0; i < 6; i++) {
    data[i] = Wire.read();
  }

  int16_t x = (int16_t)(data[1] << 8 | data[0]);
  int16_t y = (int16_t)(data[3] << 8 | data[2]);
  int16_t z = (int16_t)(data[5] << 8 | data[4]);

  float sensitivity = 0.488 / 1000.0;
  ax = x * sensitivity;
  ay = y * sensitivity;
  az = z * sensitivity;

  if (bufferIndex < BUFFER_SIZE) {
    buffer[bufferIndex].timestamp = now;
    buffer[bufferIndex].x = ax;
    buffer[bufferIndex].y = ay;
    buffer[bufferIndex].z = az;
    bufferIndex++;  //da bo naslednji vzorec shranjen na naslednje mesto v bufferju
  }

  if (bufferIndex >= BUFFER_SIZE) {
    posljiBufferMQTT();
  }

  Serial.print("t = ");
  Serial.print(now);
  Serial.print(" us, X: "); 
  Serial.print(ax, 3);
  Serial.print(" g, Y: "); 
  Serial.print(ay, 3);
  Serial.print(" g, Z: "); 
  Serial.println(az, 3);

  client.loop();
}
