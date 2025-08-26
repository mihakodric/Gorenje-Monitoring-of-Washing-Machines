#include <Arduino.h>
#include <Ticker.h>

volatile unsigned int counter = 0;
const int sensorPin = 4;

Ticker timerTicker;  // software timer

void IRAM_ATTR blink() {
  counter++;
}

void onTimer() {
  unsigned int count = counter;
  counter = 0;

  float omega = 2.0 * PI * count; // rad/s

  Serial.print("The speed of the motor: ");
  Serial.print(count);
  Serial.print(" round/s, Omega: ");
  Serial.print(omega);
  Serial.println(" rad/s");
}

void setup() {
  Serial.begin(115200);

  pinMode(sensorPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(sensorPin), blink, RISING);

  // timer vsakih 1 s
  timerTicker.attach(1.0, onTimer);  // 1.0 = interval v sekundah
}

void loop() {
  // vse se dogaja prek ISR
}

