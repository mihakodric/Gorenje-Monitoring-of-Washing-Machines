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

#define BUFFER_SIZE 5

const char* wifi_ssid = "TP-Link_B0E0";
const char* wifi_password = "89846834";
const char* mqtt_server = "192.168.0.77"; //pravilni IP najdemo pod cmd, ipconfig, IPv4 Address
const int mqtt_port = 1883;                 //notebook odpremo z run as administrator in dodamo listener 1883 ter v drugo vrstico allow_anonymous true
const char* mqtt_topic = "temperature";
const char* sensor_id = "temp_1";

ClassMQTT mqttClient(wifi_ssid, wifi_password, mqtt_server, mqtt_port, mqtt_topic, BUFFER_SIZE);
DFRobot_MLX90614_I2C sensor;   // instantiate an object to drive our sensor

void setup()
{
  Serial.begin(115200);

  mqttClient.setupWiFi();
  mqttClient.setupMQTT();

  // initialize the sensor
  while( NO_ERR != sensor.begin() ){
    Serial.println("Communication with device failed, please check connection");
    delay(3000);
  }
  Serial.println("Sensor started!");

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
  unsigned long now = micros();
  if (now - lastRead < 1000000) return;  // 1 Hz
  lastRead = now;

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

  // Use ArduinoJson to create JSON
  StaticJsonDocument<200> doc; // adjust size as needed
  doc["timestamp_us"] = now;
  doc["mqtt_topic"] = mqtt_topic;
  doc["sensor_id"] = sensor_id;
  doc["ambient_temp_c"] = ambientTemp;
  doc["object_temp_c"] = objectTemp;

  String json;
  serializeJson(doc, json);

  // print measured data in Celsius
  Serial.print("Ambient celsius : "); Serial.print(ambientTemp); Serial.println(" °C");
  Serial.print("Object celsius : ");  Serial.print(objectTemp);  Serial.println(" °C");
  Serial.println();
  // print measured data in Fahrenheit
  // Serial.print("Ambient fahrenheit : "); Serial.print(ambientTemp*9/5 + 32); Serial.println(" F");
  // Serial.print("Object fahrenheit : ");  Serial.print(objectTemp*9/5 + 32);  Serial.println(" F");

  mqttClient.dodajVBuffer(json);
  mqttClient.loop();
}


