volatile double waterFlow;  //volatile- da se lahko spremenljivka spremeni kadarkoli

void IRAM_ATTR pulse() {   //void- zato, da funkcija ne vrača ničesar, atribut- oznaka, ki da navodila, kako naj ravna s funkcijo-kam se shrani, IRAM_ATTR- naj shrani v notranji RAM v ESP32
  waterFlow += 1.0 / 75.0; //na vsak pulz doda vodi 1/75 litra
}

void setup() {
  Serial.begin(9600);
  waterFlow = 0;

  pinMode(27, INPUT_PULLUP);  //na pin 27 pride signal iz senzorja, privzeto HIGH, ne pa da plava, ko stikalo/senzor poveže pin na GND, ostane LOW
  attachInterrupt(digitalPinToInterrupt(27), pulse, RISING); //ko vidi, da signal raste, pokliče funkcijo pulse, prekine rast
}

void loop() {
  Serial.print("Pretok vode: ");
  Serial.print(waterFlow, 3);  // izpiše do 3 decimalna mesta
  Serial.println(" L");

  delay(500);
}
