#include "ClassMQTT.h"
#include <ArduinoJson.h>
#include <LittleFS.h>
#include "time.h"

// Config variables loaded from JSON
String wifi_ssid;
String wifi_password;
String mqtt_server;
int mqtt_port;
String mqtt_topic;
String sensor_id;
int buffer_size;
unsigned long sampling_interval_ms;
long gmt_offset_sec;       
int daylight_offset_sec;

ClassMQTT* mqttClient;

volatile double waterFlow;  //volatile- da se lahko spremenljivka spremeni kadarkoli

void IRAM_ATTR pulse() {   //void- zato, da funkcija ne vrača ničesar, atribut- oznaka, ki da navodila, kako naj ravna s funkcijo-kam se shrani, IRAM_ATTR- naj shrani v notranji RAM v ESP32
  waterFlow += 1.0 / 75.0; //na vsak pulz doda vodi 1/75 litra
}

String getPreciseDatetime() {
    struct timeval tv;
    gettimeofday(&tv, NULL); 

    time_t now = tv.tv_sec;
    struct tm timeinfo;
    localtime_r(&now, &timeinfo);

    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);

    char usec_buf[7];
    snprintf(usec_buf, sizeof(usec_buf), "%06ld", tv.tv_usec);

    return String(buf) + "." + String(usec_buf);
}

// Load config from LittleFS
bool loadConfig() {
  if (!LittleFS.begin()) {
    Serial.println("Failed to mount LittleFS!");
    return false;
  }

  File file = LittleFS.open("/config.json", "r");
  if (!file) {
    Serial.println("Failed to open config.json");
    return false;
  }

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error) {
    Serial.print("Failed to parse config.json: ");
    Serial.println(error.c_str());
    return false;
  }

  wifi_ssid            = doc["wifi_ssid"] | "TP-Link_B0E0";
  wifi_password        = doc["wifi_password"] | "89846834";
  mqtt_server          = doc["mqtt_server"] | "192.168.0.77";
  mqtt_port            = doc["mqtt_port"] | 1883;
  mqtt_topic           = doc["mqtt_topic"] | "water_flow";
  sensor_id            = doc["sensor_id"] | "flow_x";
  buffer_size          = doc["buffer_size"] | 10;
  sampling_interval_ms = doc["sampling_interval_ms"] | 500;
  gmt_offset_sec       = doc["gmt_offset_sec"] | 3600;  
  daylight_offset_sec  = doc["daylight_offset_sec"] | 3600;

  return true;
}

void setup() {
  Serial.begin(9600);

  if (!loadConfig()) {
    Serial.println("Config load failed! Stopping.");
    while (true) delay(1000);
  }

  // Create MQTT client with loaded values
  mqttClient = new ClassMQTT(
    wifi_ssid.c_str(),
    wifi_password.c_str(),
    mqtt_server.c_str(),
    mqtt_port,
    mqtt_topic.c_str(),
    buffer_size
  );

  mqttClient->setupWiFi();

  configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) Serial.println("Failed to obtain time");

  mqttClient->setupMQTT();

  waterFlow = 0;

  pinMode(27, INPUT_PULLUP);  //na pin 27 pride signal iz senzorja, privzeto HIGH, ne pa da plava, ko stikalo/senzor poveže pin na GND, ostane LOW
  attachInterrupt(digitalPinToInterrupt(27), pulse, RISING); //ko vidi, da signal raste, pokliče funkcijo pulse, prekine rast
}

void loop() {
  static unsigned long lastRead = 0;
  unsigned long now = millis();
  if (now - lastRead < sampling_interval_ms) return;  // 0.5 sekunde
  lastRead = now;

  String datetime = getPreciseDatetime();

  Serial.print(datetime);
  Serial.print(" Pretok vode: ");
  Serial.print(waterFlow, 3);  // izpiše do 3 decimalna mesta
  Serial.println(" L");

    // Use ArduinoJson to create JSON
  StaticJsonDocument<200> doc; // adjust size as needed
  doc["timestamp_ms"] = now;
  doc["datetime"] = datetime; 
  doc["mqtt_topic"] = mqtt_topic;
  doc["sensor_id"] = sensor_id;
  doc["flow"] = waterFlow;

  String json;
  serializeJson(doc, json);

  mqttClient->dodajVBuffer(json);
  mqttClient->loop();
}
