/*!
 * @file readACCurrent.
 * @n This example reads Analog AC Current Sensor.
 * @copyright   Copyright (c) 2010 DFRobot Co.Ltd
 * @licence     The MIT License (MIT)
 */

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

// Data buffer
struct Sample {
  String datetime;   
  float current_a;
};

Sample* samples = nullptr;
int sampleIndex = 0;

ClassMQTT* mqttClient;

const int ACPin = 34;           // vhodni signal bo na pinu GPIO2
#define ACTectionRange 20      // definiramo območje senzorja (v A)
#define VREF 3.7               // referenčna napetost na esp32

float readACCurrentValue()  //funkcija, ki bo brala tok
{
  float ACCurrentValue = 0; //tok (iz ef. napetosti)
  float peakVoltage = 0;   //trenutna vršna napetost
  float voltageVirtualValue = 0;  // efektivna napetost (prejšnja x 0,7)


  for (int i = 0; i < 5; i++)
  {
    peakVoltage += analogRead(ACPin);   //vsota 5 meritev
    delay(1);
  }
  
  peakVoltage = peakVoltage / 5;   //povprečje
  voltageVirtualValue = peakVoltage * 0.707;    //pretvori v efektivno
 
  voltageVirtualValue = (voltageVirtualValue / 4095.0 * VREF) / 2.0;  //pin da vrednost od 0 do 4095, zato jo tu pretvorimo v vrednost med 0 in 3.3 V, vezje je 2x ojačano, zato dleimo z 2
  ACCurrentValue = voltageVirtualValue * ACTectionRange; //največji tok je 20A, glede na to, kaksna je napetost glede na 3.3V, je tudi tok, tolikšen del od 20A

  return ACCurrentValue;
}


bool saveConfig() {
  StaticJsonDocument<512> doc;
  doc["wifi_ssid"] = wifi_ssid;
  doc["wifi_password"] = wifi_password;
  doc["mqtt_server"] = mqtt_server;
  doc["mqtt_port"] = mqtt_port;
  doc["mqtt_topic"] = mqtt_topic;
  doc["sensor_id"] = sensor_id;
  doc["buffer_size"] = buffer_size;
  doc["sampling_interval_ms"] = sampling_interval_ms;
  doc["gmt_offset_sec"] = gmt_offset_sec;
  doc["daylight_offset_sec"] = daylight_offset_sec;

  File file = LittleFS.open("/config.json", "w");
  if (!file) {
    Serial.println("Failed to open config file for writing");
    return false;
  }
  serializeJson(doc, file);
  file.close();
  Serial.println("Config saved to LittleFS.");
  return true;
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
  mqtt_topic           = doc["mqtt_topic"] | "current";
  sensor_id            = doc["sensor_id"] | "current_1";
  buffer_size          = doc["buffer_size"] | 10;
  sampling_interval_ms = doc["sampling_interval_ms"] | 500;
  gmt_offset_sec      = doc["gmt_offset_sec"] | 3600;
  daylight_offset_sec = doc["daylight_offset_sec"] | 3600;

  return true;
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  message.trim();

  Serial.print("Prejet ukaz na "); Serial.print(topic);
  Serial.print(": "); Serial.println(message);

  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.println("Invalid JSON in MQTT command");
    return;
  }

  String set = doc["set"] | "";
  if (set == "sampling_interval_ms") {
    sampling_interval_ms = doc["value"];
    saveConfig();
  } else if (set == "gmt_offset_sec") {
    gmt_offset_sec = doc["value"];
    saveConfig();
    configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  } else if (set == "daylight_offset_sec") {
    daylight_offset_sec = doc["value"];
    saveConfig();
    configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  } else if (set == "buffer_size") {
    buffer_size = doc["value"];
    saveConfig();
    mqttClient->setBufferSize(buffer_size);
  }
}


void setup() 
{
  Serial.begin(115200);

  if (!loadConfig()) {
    Serial.println("Config load failed! Stopping.");
    while (true) delay(1000);
  }

  samples = new Sample[buffer_size];

  // Create MQTT client with loaded values
  mqttClient = new ClassMQTT(
    wifi_ssid.c_str(),
    wifi_password.c_str(),
    mqtt_server.c_str(),
    mqtt_port,
    mqtt_topic.c_str(),
    1
  );

  mqttClient->setCallback(mqttCallback);
  mqttClient->setupWiFi();

  configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) Serial.println("Failed to obtain time");

  mqttClient->setupMQTT();
  mqttClient->subscribe("current/cmd");

  // pinMode(13, OUTPUT);  //izhodni signal bo na pinu 13, da se prižge npr. LED, ni nujno, je pa lahko za preverjanje, da vidiš, če teče skozi tok, ker sveti
}                        //če se zgodi, da hočemo imeti še LED, ga vežemo na 13, možno pa je, da je na našem esp-ju že avtomatsko vgrajen, možno, da na pin 2, v tem primeru samo zamenjamo 2 in 13 v kodi


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


void loop() {
  static unsigned long lastRead = 0;
  unsigned long now = millis();
  if (now - lastRead < sampling_interval_ms) return;
  lastRead = now;

  String datetime = getPreciseDatetime();
  float ACCurrentValue = readACCurrentValue(); //bere tok
  Serial.print(ACCurrentValue, 3);
  Serial.println(" A");

  // digitalWrite(13, HIGH); //vklaplja in izklaplja LED
  // delay(500);
  // digitalWrite(13, LOW);
  // delay(500);

  samples[sampleIndex].datetime = datetime;
  samples[sampleIndex].current_a = ACCurrentValue;
  sampleIndex++;

  // If buffer is full, send JSON
  if (sampleIndex >= buffer_size) {
    size_t capacity = JSON_OBJECT_SIZE(2) +                // root: meta + data
                      JSON_OBJECT_SIZE(2) +                // meta object
                      JSON_ARRAY_SIZE(buffer_size) +       // data array
                      buffer_size * JSON_OBJECT_SIZE(3) +  // each sample
                      200;                                 // margin for strings

    DynamicJsonDocument doc(capacity);

    JsonObject meta = doc.createNestedObject("meta");
    meta["mqtt_topic"] = mqtt_topic;
    meta["sensor_id"] = sensor_id;
    JsonArray data = doc.createNestedArray("data");
    for (int i = 0; i < sampleIndex; i++) {
      JsonObject sample = data.createNestedObject();
      sample["datetime"] = samples[i].datetime;
      sample["value"] = samples[i].current_a;
    }

  String json;
  serializeJson(doc, json);

  mqttClient->dodajVBuffer(json);
  sampleIndex = 0; // reset buffer
  }

  mqttClient->loop();
}
