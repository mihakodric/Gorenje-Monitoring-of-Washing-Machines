// ======================= LedController.cpp =======================
#include "LedController.h"

LedController::LedController(uint8_t p) : pin(p) {
    FastLED.addLeds<WS2812, 5, GRB>(&led, 1);  // pin is now hardcoded
    FastLED.setBrightness(50);
    FastLED.show();
}


void LedController::loop() {
    switch (mode) {
        case Mode::Identify: updateIdentify(); break;
        case Mode::Connect:  updateConnect();  break;
        case Mode::Send:     updateSend();     break;
        default: break;
    }
}

void LedController::blinkIdentify(uint8_t cycles) {
    mode = Mode::Identify;
    totalBlinks = cycles * 2; // ON + OFF counts as 2
    blinkCount = 0;
    lastUpdate = 0;
    ledState = false;
}

void LedController::blinkConnect() {
    if (mode != Mode::Connect) {
        mode = Mode::Connect;
        lastUpdate = 0;
        ledState = false;
    }
}

void LedController::blinkSend() {
    mode = Mode::Send;
    lastUpdate = 0;
    ledState = true;
    blinkCount = 0;
}

void LedController::stop() {
    mode = Mode::None;
    led = CRGB::Black;
    FastLED.show();
}

void LedController::updateIdentify() {
    unsigned long now = millis();
    if (now - lastUpdate < 200) return;
    lastUpdate = now;

    ledState = !ledState;
    led = ledState ? CRGB::Green : CRGB::Black;
    FastLED.show();

    blinkCount++;
    if (blinkCount >= totalBlinks) {
        stop();
    }
}

void LedController::updateConnect() {
    unsigned long now = millis();
    if (now - lastUpdate < 500) return;  // slower blink
    lastUpdate = now;

    ledState = !ledState;
    led = ledState ? CRGB::Blue : CRGB::Black;
    FastLED.show();
}

void LedController::updateSend() {
    unsigned long now = millis();
    if (blinkCount == 0) {
        led = CRGB::Blue;
        FastLED.show();
        lastUpdate = now;
        blinkCount = 1;
    } else if (now - lastUpdate > 100) { // 0.1 second flash
        stop();
    }
}
