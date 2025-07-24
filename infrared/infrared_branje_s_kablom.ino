const int sensorPin = 4;  //signal na pinu 4

void setup() {
  Serial.begin(115200);   
  pinMode(sensorPin, INPUT); //signal je vhodni
}

void loop() {
  int sensorValue = digitalRead(sensorPin); //bere stanje senzorja

  if (sensorValue == LOW) {
    Serial.println("Objekt zaznan!");  // IR svetloba se odbija nazaj, predmet je blizu, bela barva
  } else {
    Serial.println("Ni objekta.");      // ni odboja, ni predmeta pred senzorjem, črna barva
  }

  delay(200);
}