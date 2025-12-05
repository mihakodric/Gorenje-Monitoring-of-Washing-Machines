// ======================= water_flow_sensor.cpp =======================
#include "water_flow_sensor.h"
#include <LittleFS.h>
#include <time.h>

// -------------------- Hardware Config --------------------
static const uint8_t FLOW_PIN = 22;   // SCL pin (safe ONLY if I2C is unused)
static const float LITERS_PER_PULSE = 1.0f / 75.0f;   // ✅ MUST match your legacy calibration

// -------------------- Pulse Tracking --------------------
static volatile uint32_t pulseCount = 0;

// -------------------- Runtime Config --------------------
static uint16_t buffer_size = 100;
static uint32_t sampling_interval_ms = 500;

// -------------------- Data Buffer --------------------
static Sample* samples = nullptr;
static uint16_t sampleIndex = 0;

// -------------------- Timing --------------------
static uint32_t lastRead = 0;

// -------------------- MQTT --------------------
static MQTTHandler* mqttClient = nullptr;

// -------------------- Timestamp Helper --------------------
static uint64_t getPreciseTimestampMillis() {
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    return (uint64_t)tv.tv_sec * 1000ULL + (uint64_t)(tv.tv_usec / 1000);
}

// -------------------- Interrupt Handler --------------------
void IRAM_ATTR flowPulseISR() {
    pulseCount++;
}

// -------------------- Safe Buffer Allocation --------------------
static void allocateBuffer() {
    if (samples) {
        delete[] samples;
        samples = nullptr;
    }

    if (buffer_size < 1) buffer_size = 1;
    if (buffer_size > 2000) buffer_size = 2000;

    samples = new Sample[buffer_size];
    sampleIndex = 0;
}

// -------------------- Setup --------------------
void setupWaterFlowSensor(MQTTHandler* handler) {
    mqttClient = handler;

    if (LittleFS.exists(CONFIG_PATH)) {
        File file = LittleFS.open(CONFIG_PATH, "r");
        if (file) {
            JsonDocument doc;
            if (!deserializeJson(doc, file)) {
                if (doc["buffer_size"].is<uint16_t>())
                    buffer_size = doc["buffer_size"];

                if (doc["sampling_interval_ms"].is<uint32_t>())
                    sampling_interval_ms = doc["sampling_interval_ms"];
            }
            file.close();
        }
    }

    pinMode(FLOW_PIN, INPUT); // Ensure pin is input. Can be also INPUT_PULLUP if needed, because the sensor output is open-drain
    attachInterrupt(
        digitalPinToInterrupt(FLOW_PIN), 
        flowPulseISR, 
        RISING);

    allocateBuffer();
}

// -------------------- Runtime Config Update --------------------
void updateWaterFlowSensorConfig(const JsonDocument& cfg) {
    if (!cfg.is<JsonObject>()) return;

    bool changed = false;

    if (cfg["buffer_size"].is<uint16_t>()) {
        buffer_size = cfg["buffer_size"];
        changed = true;
    }

    if (cfg["sampling_interval_ms"].is<uint32_t>()) {
        sampling_interval_ms = cfg["sampling_interval_ms"];
    }

    if (changed) allocateBuffer();
}

// -------------------- Channel Metadata --------------------
static const char* channels[] = {
    "flow_rate_lpm"
};
static const uint8_t numChannels = 1;

// -------------------- Main Loop --------------------
void loopWaterFlowSensor() {
    uint32_t now = millis();
    if (now - lastRead < sampling_interval_ms) return;
    lastRead = now;

    // ---- Atomic snapshot ----
    uint32_t pulses;

    noInterrupts();
    pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    // ---- Compute Flow Rate ----
    float interval_s = sampling_interval_ms / 1000.0f;
    float flow_lps = (pulses * LITERS_PER_PULSE) / interval_s;
    float flow_lpm = flow_lps * 60.0f;

    // ---- Store Sample ----
    samples[sampleIndex].flow_rate_lpm = flow_lpm;
    samples[sampleIndex].timestamp_ms   = getPreciseTimestampMillis();
    sampleIndex++;

    // ---- Publish When Full ----
    if (sampleIndex >= buffer_size) {
        if (mqttClient && mqttClient->isTransmissionEnabled()) {
            JsonDocument doc;

            JsonArray tsArray = doc["timestamps"].to<JsonArray>();
            JsonArray valuesArray = doc["values"].to<JsonArray>();

            for (uint16_t i = 0; i < sampleIndex; i++) {
                tsArray.add(samples[i].timestamp_ms);

                JsonArray row = valuesArray.add<JsonArray>();
                row.add(samples[i].flow_rate_lpm);
            }

            JsonArray metaChannels = doc["channels"].to<JsonArray>();
            for (uint8_t c = 0; c < numChannels; c++) {
                metaChannels.add(channels[c]);
            }

            Serial.println("Publishing water flow + volume data...\n");
            Serial.println(doc.as<String>());

            mqttClient->publishData(doc);
        }

        sampleIndex = 0;
    }
}
