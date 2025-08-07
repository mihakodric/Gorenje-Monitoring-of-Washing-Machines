/*!
 * @file readACCurrent.
 * @n This example reads Analog AC Current Sensor.
 * @copyright   Copyright (c) 2010 DFRobot Co.Ltd
 * @licence     The MIT License (MIT)
 */

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
  pinMode(13, OUTPUT);  //izhodni signal bo na pinu 13, da se prižge npr. LED, ni nujno, je pa lahko za preverjanje, da vidiš, če teče skozi tok, ker sveti
}                        //če se zgodi, da hočemo imeti še LED, ga vežemo na 13, možno pa je, da je na našem esp-ju že avtomatsko vgrajen, možno, da na pin 2, v tem primeru samo zamenjamo 2 in 13 v kodi

void loop() 
{
  float ACCurrentValue = readACCurrentValue(); //bere tok
  Serial.print(ACCurrentValue, 3);
  Serial.println(" A");

  digitalWrite(13, HIGH); //vklaplja in izklaplja LED
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
