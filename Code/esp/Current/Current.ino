/*!
 * @file readACCurrent.
 * @n This example reads Analog AC Current Sensor.
 * @copyright   Copyright (c) 2010 DFRobot Co.Ltd
 * @licence     The MIT License (MIT)
 */

#include "ClassMQTT.h"
#include <ArduinoJson.h>

#define BUFFER_SIZE 10

const char* wifi_ssid = "TP-Link_B0E0";
const char* wifi_password = "89846834";
const char* mqtt_server = "192.168.0.77"; //pravilni IP najdemo pod cmd, ipconfig, IPv4 Address
const int mqtt_port = 1883;                 //notebook odpremo z run as administrator in dodamo listener 1883 ter v drugo vrstico allow_anonymous true
const char* mqtt_topic = "current";
const char* sensor_id = "current_1";

ClassMQTT mqttClient(wifi_ssid, wifi_password, mqtt_server, mqtt_port, mqtt_topic, BUFFER_SIZE);

const int ACPin = 2;           // vhodni signal bo na pinu GPIO2
#define ACTectionRange 20      // definiramo območje senzorja (v A)
#define VREF 3.3               // referenčna napetost na esp32

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

void setup() 
{
  Serial.begin(115200);
  mqttClient.setupWiFi();
  mqttClient.setupMQTT();
  pinMode(13, OUTPUT);  //izhodni signal bo na pinu 13, da se prižge npr. LED, ni nujno, je pa lahko za preverjanje, da vidiš, če teče skozi tok, ker sveti
}                        //če se zgodi, da hočemo imeti še LED, ga vežemo na 13, možno pa je, da je na našem esp-ju že avtomatsko vgrajen, možno, da na pin 2, v tem primeru samo zamenjamo 2 in 13 v kodi

void loop() 
{
  static unsigned long lastRead = 0;
  unsigned long now = millis();
  if (now - lastRead < 500) return;  // 0.5 sekunde
  lastRead = now;

  float ACCurrentValue = readACCurrentValue(); //bere tok
  Serial.print(ACCurrentValue, 3);
  Serial.println(" A");

  // digitalWrite(13, HIGH); //vklaplja in izklaplja LED
  // delay(500);
  // digitalWrite(13, LOW);
  // delay(500);

  // Use ArduinoJson to create JSON file
  StaticJsonDocument<200> doc; // adjust size as needed
  doc["timestamp_ms"] = now;
  doc["mqtt_topic"] = mqtt_topic;
  doc["sensor_id"] = sensor_id;
  doc["current_a"] = ACCurrentValue;

  String json;
  serializeJson(doc, json);

  mqttClient.dodajVBuffer(json);
  mqttClient.loop();
}
