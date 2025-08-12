// program files/mosquitto/mosquitto.conf odpremo z notebook - run as administrator in dodamo listener 1883 ter v drugo vrstico allow_anonymous true
// prvič ko zaženemo ?? v ozadju tečecmd, notri vpišemo "C:\Program Files\mosquitto\mosquitto.exe" -c "C:\Program Files\mosquitto\mosquitto.conf" -v
// config.json naložimo na esp: ArduinoIDE, Ctrl+Shift+P (search bar), Upload LittleFS to Pico/ESP8266/ESP32

#include <Wire.h>
#include <WiFi.h>
#include <ClassMQTT.h>
#include <PubSubClient.h> //na računalniku pod Arduino libraries v PubSubClient.h nastavimo: #define MQTT_MAX_PACKET_SIZE 5120
#include <LittleFS.h>  // install library: LittleFS_esp32
#include <ArduinoJson.h>  // install library: ArduinoJson


#define LIS2DW12_ADDR 0x19  // I2C naslov senzorja
#define OUT_X_L 0x28


// Variables loaded from config.json
String wifi_ssid;
String wifi_password;
String mqtt_server;
int mqtt_port;
String mqtt_topic;
String sensor_id;
float sensitivity;
int buffer_size;
int sampling_frequency;
unsigned long send_interval_ms;
int range_g;




// Dynamic sample buffer 
struct Sample {                //v sample shranjuje čas, x, y, z
  unsigned long timestamp;
  float x, y, z;
};

// Sample samples[BUFFER_SIZE];    //polje, buffer, veliko do buffer_size
Sample* samples = nullptr;
int sampleIndex = 0;           //v katero mesto v bufferju shranjuje, na začetku na prvem

ClassMQTT* mqtt = nullptr;

// Timers
unsigned long lastRead = 0;
unsigned long lastSend = 0;
unsigned long sampleIntervalMicros = 0;

float ax = 0, ay = 0, az = 0;



// -------- Load Config --------
bool loadConfig() {
  if (!LittleFS.begin()) {
    Serial.println("LittleFS mount failed");
    return false;
  }

  if (!LittleFS.exists("/config.json")) {
    Serial.println("Config file not found");
    return false;
  }

  File file = LittleFS.open("/config.json", "r");
  if (!file) {
    Serial.println("Failed to open config file");
    return false;
  }

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.f_str());
    return false;
  }

  wifi_ssid     = doc["wifi_ssid"].as<String>();
  wifi_password = doc["wifi_password"].as<String>();
  mqtt_server   = doc["mqtt_server"].as<String>();
  mqtt_port     = doc["mqtt_port"].as<int>();
  mqtt_topic    = doc["mqtt_topic"].as<String>();
  sensor_id     = doc["sensor_id"].as<String>();
  sensitivity       = doc["sensitivity"] | 0.000488;   // default if missing
  buffer_size       = doc["buffer_size"] | 10;
  sampling_frequency = doc["sampling_frequency"] | 200.0;
  send_interval_ms  = doc["send_interval_ms"] | 1000;
  range_g           = doc["range_g"] | 16;

  Serial.println("Config loaded:");
  Serial.println("WiFi SSID: " + wifi_ssid);
  Serial.println("MQTT Server: " + mqtt_server);
  Serial.println("MQTT Port: " + String(mqtt_port));
  Serial.println("MQTT Topic: " + mqtt_topic);
  Serial.println("Sensor ID: " + sensor_id);
  Serial.println("Sensitivity: " + String(sensitivity));
  Serial.println("Buffer size: " + String(buffer_size));
  Serial.println("Sampling frequency: " + String(sampling_frequency) + " Hz");
  Serial.println("Send interval: " + String(send_interval_ms) + " ms");
  Serial.println("Range: ±" + String(range_g) + "g");

  return true;
}


void setupAccelerometer() {
  // Check WHO_AM_I register
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x0F); // WHO_AM_I register
  Wire.endTransmission();
  Wire.requestFrom(LIS2DW12_ADDR, 1);
  if (Wire.available()) {
    uint8_t whoami = Wire.read();
    Serial.print("WHO_AM_I = 0x");
    Serial.println(whoami, HEX);
  } else {
    Serial.println("Error reading WHO_AM_I");
  }

  // Set ODR (Output Data Rate) based on sampling_frequency
  uint8_t odr_reg_value = 0x60;
  if (sampling_frequency <= 1.6)        odr_reg_value = 0x10; // 1.6 Hz (low-power)
  else if (sampling_frequency <= 12.5)  odr_reg_value = 0x20; // 12.5 Hz
  else if (sampling_frequency <= 25)  odr_reg_value = 0x30; // 25 Hz
  else if (sampling_frequency <= 50)  odr_reg_value = 0x40; // 50 Hz
  else if (sampling_frequency <= 100) odr_reg_value = 0x50; // 100 Hz
  else if (sampling_frequency <= 200) odr_reg_value = 0x60; // 200 Hz
  else if (sampling_frequency <= 400) odr_reg_value = 0x70; // 400 Hz (high-performance only)
  else if (sampling_frequency <= 800) odr_reg_value = 0x80; // 800 Hz (high-performance only)
  else if (sampling_frequency <= 1600) odr_reg_value = 0x90; // 1.6 kHz (high-performance only)
  else {
      Serial.println("Invalid sampling frequency, defaulting to 200 Hz");
      odr_reg_value = 0x60;
  }

  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x20); // CTRL1 register
  Wire.write(odr_reg_value);
  Wire.endTransmission();

  // Set range
  uint8_t range_reg_value = 0x30;
  switch (range_g) {
    case 2:  range_reg_value = 0x00; break;
    case 4:  range_reg_value = 0x10; break;
    case 8:  range_reg_value = 0x20; break;
    case 16: range_reg_value = 0x30; break;
  }
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x25); // CTRL6 register
  Wire.write(range_reg_value);
  Wire.endTransmission();
}




void setup() {
  Serial.begin(230400);  // boud rate - kako hitro zajema
  Serial.println("Booting...");
  Wire.begin(21, 22);   // SDA, SCL pin

  if (!loadConfig()) {
    Serial.println("Failed to load config, stopping...");
    while (true) { delay(1000); }
  }

  samples = new Sample[buffer_size];

    // Calculate sample interval
  sampleIntervalMicros = 1000000UL / sampling_frequency;  // 1s/frekvenca

  // Configure MQTT with loaded values
  mqtt = new ClassMQTT(
    wifi_ssid.c_str(),
    wifi_password.c_str(),
    mqtt_server.c_str(),
    mqtt_port,
    mqtt_topic.c_str(),
    buffer_size
  );


  mqtt->setupWiFi();
  mqtt->setupMQTT();

  setupAccelerometer();

  lastRead = micros();
  lastSend = millis();

  delay(100);
}




void loop() {

  unsigned long nowMicros = micros();
  if (nowMicros - lastRead >= sampleIntervalMicros) {
    lastRead += sampleIntervalMicros;

    // static unsigned long lastRead = 0;  //static- da si zapomni tudi ob naslednjih loopih, da teče naprej
    // unsigned long now = micros();  //šteje čas od prej do zdaj
    // if (now - lastRead < 5000) return; // 1/1600 Hz = vsakih 625 mikrosekund, 1/200 Hz = 5000 mikrosekund
    // lastRead = now;
    
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

    ax = x * sensitivity;
    ay = y * sensitivity;
    az = z * sensitivity;

    if (sampleIndex < buffer_size) {
      samples[sampleIndex].timestamp = nowMicros;
      samples[sampleIndex].x = ax;
      samples[sampleIndex].y = ay;
      samples[sampleIndex].z = az;
      sampleIndex++;  //da bo naslednji vzorec shranjen na naslednje mesto v bufferju
    }
  }

  if (sampleIndex >= buffer_size || (millis() - lastSend >= send_interval_ms)) {
    for (int i = 0; i < sampleIndex; i++) {
      String jsonObj = "{";
      jsonObj += "\"timestamp_us\":" + String(samples[i].timestamp) + ",";
      jsonObj += "\"mqtt_topic\":\"" + String(mqtt_topic) + "\",";
      jsonObj += "\"sensor_id\":\"" + String(sensor_id) + "\",";
      jsonObj += "\"ax_g\":" + String(samples[i].x, 3) + ",";
      jsonObj += "\"ay_g\":" + String(samples[i].y, 3) + ",";
      jsonObj += "\"az_g\":" + String(samples[i].z, 3);
      jsonObj += "}";

      mqtt->dodajVBuffer(jsonObj);
    }
    sampleIndex = 0;
    lastSend = millis();
  }

  Serial.print("t = ");
  Serial.print(nowMicros);
  Serial.print(" us, X: "); 
  Serial.print(ax, 3);
  Serial.print(" g, Y: "); 
  Serial.print(ay, 3);
  Serial.print(" g, Z: "); 
  Serial.println(az, 3);

  mqtt->loop();
}
