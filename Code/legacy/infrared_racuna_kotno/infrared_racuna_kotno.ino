volatile unsigned int counter = 0;  
const int sensorPin = 4;  // IR sensor output pin

// Timer pointer
hw_timer_t * timer = NULL;

void IRAM_ATTR blink() {
  counter++;
}

void IRAM_ATTR onTimer() {
  float revPerSec = (float)counter;
  float omega = 2 * PI * revPerSec;  // rad/s

  Serial.print("Revolutions per second: ");
  Serial.print(revPerSec);
  Serial.print("  |  Angular velocity (rad/s): ");
  Serial.println(omega);

  counter = 0;  // reset counter
}

void setup() {
  Serial.begin(115200);

  pinMode(sensorPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(sensorPin), blink, RISING);

  // Setup timer: timer 0, prescaler 80 -> 1 tick = 1us
  timer = timerBegin(1); // 1 Hz → ISR runs every second
  timerAttachInterrupt(timer, &onTimer);
  timerAlarm(timer, 1000000, true, 0); // 1,000,000 µs = 1 second, autoreload enabled
}

void loop() {
  // nothing here, all handled by interrupts
}
