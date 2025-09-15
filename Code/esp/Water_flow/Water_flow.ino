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
  float flow;
};
Sample* samples = nullptr;
int sampleIndex = 0;

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

//za sprejem ukazov prek mqtt
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String message;
    for (unsigned int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    message.trim();

    Serial.print("Received command on ");
    Serial.print(topic);
    Serial.print(": ");
    Serial.println(message);

    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (error) {
        Serial.println("Invalid JSON command");
        return;
    }

    bool configChanged = false;

    // Loop over all keys in the JSON
    for (JsonPair kv : doc.as<JsonObject>()) {
        const char* key = kv.key().c_str();

        if (strcmp(key, "reset") == 0) {
            bool doReset = kv.value().as<bool>();
            if (doReset) {
                waterFlow = 0;
                Serial.println("Water meter reset!");
                configChanged = true;
            }
        } 
        else if (strcmp(key, "sampling_interval_ms") == 0) {
            unsigned long newInterval = kv.value().as<unsigned long>();
            if (newInterval > 0) {
                sampling_interval_ms = newInterval;
                Serial.print("Sampling interval set to: ");
                Serial.println(sampling_interval_ms);
                configChanged = true;
            } else {
                Serial.println("Invalid sampling_interval_ms received, ignoring.");
            }
        } 
        else if (strcmp(key, "buffer_size") == 0) {
            int newBuffer = kv.value().as<int>();
            if (newBuffer > 0) {
                buffer_size = newBuffer;
                Serial.print("Buffer size set to: ");
                Serial.println(buffer_size);
                configChanged = true;
            } else {
                Serial.println("Invalid buffer_size received, ignoring.");
            }
        } 
        else if (strcmp(key, "gmt_offset_sec") == 0) {
            gmt_offset_sec = kv.value().as<long>();
            configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
            configChanged = true;
        } 
        else if (strcmp(key, "daylight_offset_sec") == 0) {
            daylight_offset_sec = kv.value().as<long>();
            configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
            configChanged = true;
        } 
        else {
            Serial.print("Unknown key received: ");
            Serial.println(key);
        }
    }

    if (configChanged) {
        if (saveConfig()) {
            Serial.println("Configuration updated and saved.");
        } else {
            Serial.println("Failed to save configuration.");
        }
    }

    // String set = doc["set"] | "";

    // if (set == "reset") {
    //     bool doReset = doc["value"] | false;  // privzeto false
    //     if (doReset) {
    //         waterFlow = 0;
    //         Serial.println("Vodomer resetiran!");
    //     } else {
    //         Serial.println("Reset ukaz prejet, a value=false, reset ni izveden.");
    //     }
    // } 
    // else if (set == "sampling_interval_ms") {
    //     sampling_interval_ms = doc["value"].as<unsigned long>();
    //     saveConfig();
    //     Serial.print("Sampling interval nastavljen na: ");
    //     Serial.println(sampling_interval_ms);
    // } else if (set == "gmt_offset_sec") {
    // gmt_offset_sec = doc["value"];
    // saveConfig();
    // configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
    // } else if (set == "daylight_offset_sec") {
    //   daylight_offset_sec = doc["value"];
    //   saveConfig();
    //   configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
    // } else if (set == "buffer_size") {
    // buffer_size = doc["value"];
    // saveConfig();
    // mqttClient->setBufferSize(buffer_size);
  // }
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
  mqtt_topic           = doc["mqtt_topic"] | "water_flow";
  sensor_id            = doc["sensor_id"] | "flow_x";
  buffer_size          = doc["buffer_size"] | 10;
  sampling_interval_ms = doc["sampling_interval_ms"] | 500;
  gmt_offset_sec       = doc["gmt_offset_sec"] | 3600;  
  daylight_offset_sec  = doc["daylight_offset_sec"] | 3600;

  return true;
}


void publishConfig() {
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

  String json;
  serializeJson(doc, json);

  String configTopic = mqtt_topic + "/config";
  mqttClient->publish(configTopic.c_str(), json.c_str());
}


void setup() {
  Serial.begin(9600);

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

  String cmd_topic = sensor_id + "/cmd";

  mqttClient->setupMQTT();
  mqttClient->subscribe(cmd_topic.c_str());

  publishConfig();

  waterFlow = 0;

  pinMode(27, INPUT_PULLUP);  //na pin 27 pride signal iz senzorja, privzeto HIGH, ne pa da plava, ko stikalo/senzor poveže pin na GND, ostane LOW
  attachInterrupt(digitalPinToInterrupt(27), pulse, RISING); //ko vidi, da signal raste, pokliče funkcijo pulse, prekine rast
}

void loop() {  

  mqttClient->loop();

  static unsigned long lastRead = 0;
  unsigned long now = millis();
  if (now - lastRead < sampling_interval_ms) return;  // 0.5 sekunde
  lastRead = now;

  String datetime = getPreciseDatetime();

  Serial.print(datetime);
  Serial.print(" Pretok vode: ");
  Serial.print(waterFlow, 3);  // izpiše do 3 decimalna mesta
  Serial.println(" L");

  samples[sampleIndex].datetime = datetime;
  samples[sampleIndex].flow = waterFlow;
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
      sample["value"] = samples[i].flow;
    }

  String json;
  serializeJson(doc, json);

  mqttClient->dodajVBuffer(json);
  sampleIndex = 0; // reset buffer
  }
}
