#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>

#define LIS2DW12_ADDR 0x19
#define OUT_X_L 0x28

const char* ssid = "Agata";
const char* password = "e310756d9056";

WebServer server(80); //privzeta povezava na port 80 v brskalniku

float ax = 0, ay = 0, az = 0;

const int BUFFER_SIZE = 400;  
struct Sample {                //v sample shranjuje čas, x, y, z
  unsigned long timestamp;
  float x, y, z;
};

Sample buffer[BUFFER_SIZE];    //polje, buffer, veliko do buffer_size
int bufferIndex = 0;           //v katero mesto v bufferju shranjuje, na začetku na prvem


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
  Wire.write(0x97);  // 1600 Hz, vsi osi enable
  Wire.endTransmission();

  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x25);
  Wire.write(0x00);  // ±2g občutljivost
  Wire.endTransmission();

  delay(100);
}

void loop() {
  server.handleClient();

  static unsigned long lastRead = 0;  //static- da si zapomni tudi ob naslednjih loopih, da teče naprej
  unsigned long now = micros();  //šteje čas od prej do zdaj
  if (now - lastRead < 625) return; // 1600 Hz = vsakih 625 mikrosekund
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

  float sensitivity = 0.061 / 1000.0;
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

  Serial.print("t = ");
  Serial.print(now);
  Serial.print(" us, X: "); 
  Serial.print(ax, 3);
  Serial.print(" g, Y: "); 
  Serial.print(ay, 3);
  Serial.print(" g, Z: "); 
  Serial.println(az, 3);

}
