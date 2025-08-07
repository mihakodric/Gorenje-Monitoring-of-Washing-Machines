#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h> //na računalniku pod Rduino libraries v PubSubCliebt.h nastavimo: #define MQTT_MAX_PACKET_SIZE 4096

#define LIS2DW12_ADDR 0x19  // I2C naslov senzorja
#define OUT_X_L 0x28

const char* ssid = "TP-Link_B0E0";
const char* password = "89846834";

const char* mqtt_server = "10.15.112.134";  //pravilni IP najdemo pod cmd, ipconfig, IPv4 Address
const int mqtt_port = 1883;                 //notebook odpremo z run as administrator in dodamo listener 1883 ter v drugo vrstico allow_anonymous true
const char* mqtt_tema = "pospesek";         //v ozadju tečecmd, notri vpišemo "C:\Program Files\mosquitto\mosquitto.exe" -c "C:\Program Files\mosquitto\mosquitto.conf" -v


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
  Serial.begin(230400);  // boud rate - kako hitro zajema
  Wire.begin(21, 22);   // SDA, SCL pin

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


  client.setServer(mqtt_server, mqtt_port);


 // Preverimo WHO_AM_I register za potrditev komunikacije
  Wire.beginTransmission(LIS2DW12_ADDR); //da začne komunikacijo z napravo s tem naslovom
  Wire.write(0x0F);  // WHO_AM_I register, register za prepoznavo
  Wire.endTransmission(); //zaključiš prenos podatkov
  Wire.requestFrom(LIS2DW12_ADDR, 1); //naj naprava pošlje eno vrednost- to bo who am i
  if (Wire.available()) { //če dobimo podatek
    uint8_t whoami = Wire.read(); //ga shrani v whoami, to je 8-bitni integer
    Serial.print("WHO_AM_I = 0x"); //0x da nam je jasno, da je hexa.
    Serial.println(whoami, HEX); //whoami vrednost v hexadecimalnem izpisu
  } else {
    Serial.println("Error reading WHO_AM_I");
  }

  // Nastavimo pospeškomer: ODR 100Hz, obseg ±2g
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x20); //register za ODR
  Wire.write(0x97);  // 0x50 = 0101 0000 (100Hz)
  Wire.endTransmission();

  // CTRL6 register (0x25) - nastavitev obsega ±16g
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x25);  //register za obseg
  Wire.write(0x30);  // ±16g (default je ±2g; 0x00)
  Wire.endTransmission();

  delay(100);
}

void loop() {

  static unsigned long lastRead = 0;  //static- da si zapomni tudi ob naslednjih loopih, da teče naprej
  unsigned long now = micros();  //šteje čas od prej do zdaj
  if (now - lastRead < 625) return; // 1600 Hz = vsakih 625 mikrosekund
  lastRead = now;
  
  uint8_t data[6]; //spremenljivka data, ki je polje, veliko 6

  // Branje 6 bajtov pospeška X, Y, Z, za vsakega 2 bajta podatkov, skupaj tvorita 16-bitno številko
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(OUT_X_L | 0x80);  // Postavi MSB za avtomatsko inkrementacijo registra, se pravi da sam bere več zaporednih registrov- brez bi prebral le x, ne pa še y in z
  Wire.endTransmission();
  Wire.requestFrom(LIS2DW12_ADDR, 6); //da pošlje podatke, prva dva sta za x high in low- za večjo natančnost,... in tako dalje

  for (int i = 0; i < 6; i++) { //kot v pythonu, i++ pristeje 1 po vsaki iteraciji
    if (Wire.available()) {
      data[i] = Wire.read(); //nalepi v seznam
    }
  }


  int16_t x = (int16_t)(data[1] << 8 | data[0]); //čisto desno- le formula dveh 8-bitnih števil nazaj v 16-bitno
  int16_t y = (int16_t)(data[3] << 8 | data[2]); // oklepaj pred formulo samo nastavi tip spremenljivke
  int16_t z = (int16_t)(data[5] << 8 | data[4]);

  float sensitivity = 0.488 / 1000.0;  // ?
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
