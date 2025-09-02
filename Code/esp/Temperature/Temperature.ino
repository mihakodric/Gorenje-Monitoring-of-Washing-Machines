/*!
 * @file        getData.ino
 * @brief       this demo demonstrates how to put the sensor enter/exit sleep mode and get temperature data measured by sensor
 * @copyright   Copyright (c) 2010 DFRobot Co.Ltd (http://www.dfrobot.com)
 * @license     The MIT License (MIT)
 * @author      [qsjhyy](yihuan.huang@dfrobot.com)
 * @version     V1.0
 * @date        2021-08-09
 * @url         https://github.com/DFRobot/DFRobot_MLX90614
 */
#include <DFRobot_MLX90614.h>
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
DFRobot_MLX90614_I2C sensor;   // instantiate an object to drive our sensor


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
  mqtt_topic           = doc["mqtt_topic"] | "temperature";
  sensor_id            = doc["sensor_id"] | "temp_1";
  buffer_size          = doc["buffer_size"] | 5;
  sampling_interval_ms = doc["sampling_interval_ms"] | 1000;
  gmt_offset_sec       = doc["gmt_offset_sec"] | 3600;      
  daylight_offset_sec  = doc["daylight_offset_sec"] | 3600;

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
  } 
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

void setup()
{
  Serial.begin(115200);

  if (!loadConfig()) {
  Serial.println("Config load failed! Stopping.");
  while (true) delay(1000);
  }

  // initialize the sensor
  while( NO_ERR != sensor.begin() ){
    Serial.println("Communication with device failed, please check connection");
    delay(3000);
  }
  Serial.println("Sensor started!");

  // Create MQTT client with loaded values
  mqttClient = new ClassMQTT(
    wifi_ssid.c_str(),
    wifi_password.c_str(),
    mqtt_server.c_str(),
    mqtt_port,
    mqtt_topic.c_str(),
    buffer_size
  );

  mqttClient->setCallback(mqttCallback);
  mqttClient->setupWiFi();

  configTime(gmt_offset_sec, daylight_offset_sec, "pool.ntp.org");
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) Serial.println("Failed to obtain time");

  mqttClient->setupMQTT();
  mqttClient->subscribe("temperature/cmd");

    /**
   * adjust sensor sleep mode
   * mode select to enter or exit sleep mode, it's enter sleep mode by default
   *      true is to enter sleep mode
   *      false is to exit sleep mode (automatically exit sleep mode after power down and restart)
   */
  sensor.enterSleepMode();   //samo da preverimo, če gre lahko v sleepmode- če pravilno deluje
  delay(50);
  sensor.enterSleepMode(false);
  delay(200);
}

void loop() {
  static unsigned long lastRead = 0;
  unsigned long now = millis();
  if (now - lastRead < sampling_interval_ms) return;  // 1 Hz
  lastRead = now;

  String datetime = getPreciseDatetime();

  /**
   * get ambient temperature, unit is Celsius
   * return value range： -40.01 °C ~ 85 °C
   */
  float ambientTemp = sensor.getAmbientTempCelsius();

  /**
   * get temperature of object 1, unit is Celsius
   * return value range： 
   * @n  -70.01 °C ~ 270 °C(MLX90614ESF-DCI)
   * @n  -70.01 °C ~ 380 °C(MLX90614ESF-DCC)
   */
  float objectTemp = sensor.getObjectTempCelsius();

    // print measured data in Celsius
  Serial.print(datetime);
  Serial.print(" Ambient celsius : "); Serial.print(ambientTemp); Serial.println(" °C");
  Serial.print("Object celsius : ");  Serial.print(objectTemp);  Serial.println(" °C");
  Serial.println();
  // print measured data in Fahrenheit
  // Serial.print("Ambient fahrenheit : "); Serial.print(ambientTemp*9/5 + 32); Serial.println(" F");
  // Serial.print("Object fahrenheit : ");  Serial.print(objectTemp*9/5 + 32);  Serial.println(" F");


  // Use ArduinoJson to create JSON
  StaticJsonDocument<200> doc; // adjust size as needed
  doc["timestamp_ms"] = now;
  doc["datetime"] = datetime; 
  doc["mqtt_topic"] = mqtt_topic;
  doc["sensor_id"] = sensor_id;
  doc["ambient_temp_c"] = ambientTemp;
  doc["object_temp_c"] = objectTemp;

  String json;
  serializeJson(doc, json);
  
  mqttClient->dodajVBuffer(json);
  mqttClient->loop();
}


