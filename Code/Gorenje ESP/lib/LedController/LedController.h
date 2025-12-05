// ======================= LedController.h =======================
#pragma once
#include <FastLED.h>

class LedController {
public:
    LedController(uint8_t pin);

    // Call this in your main loop to update timed blinks
    void loop();

    // Blink types
    void blinkIdentify(uint8_t cycles = 10);    // green, finite cycles
    void blinkConnect();                        // blue, continuous while connecting
    void blinkSend();                           // blue, short flash on send
    void stop();                                // stop any blinking, turn off LED

private:
    CRGB led;
    uint8_t pin;

    // Internal state
    unsigned long lastUpdate = 0;
    unsigned int blinkCount = 0;
    unsigned int totalBlinks = 0;
    bool ledState = false;

    enum class Mode { None, Identify, Connect, Send } mode = Mode::None;

    void updateIdentify();
    void updateConnect();
    void updateSend();
};
