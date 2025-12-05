// ✅ ESP32 Version of Your Flow Sensor Test Code
// Signal wire connected to GPIO12

volatile double waterFlow = 0.0;

static const uint8_t FLOW_PIN = 22;   // D11 ✅ SAFE

void IRAM_ATTR pulse() {
  waterFlow += 1.0 / 75.0;   // ✅ 75 pulses = 1 liter
}

void setup() {
  Serial.begin(9600);

  waterFlow = 0.0;

  pinMode(FLOW_PIN, INPUT);  // ❗ NOT INPUT_PULLUP if you use a divider

  attachInterrupt(
    digitalPinToInterrupt(FLOW_PIN),
    pulse,
    RISING
  );
}

void loop() {
  Serial.print("waterFlow: ");
  Serial.print(waterFlow, 6);   // show more precision
  Serial.println(" L");

  delay(500);
}
