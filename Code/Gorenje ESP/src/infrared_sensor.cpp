// ======================= infrared_sensor.cpp =======================
#include "infrared_sensor.h"
#include <LittleFS.h>
#include <Wire.h>
#include <time.h>

// -------------------- Sensor Config --------------------
#define IR_PIN 22               // Using SCL as a normal GPIO

// -------------------- Runtime Config --------------------
static uint16_t buffer_size = 5;           // default fallback
static uint32_t sampling_interval_ms = 1000;   // default fallback
static uint8_t pulses_per_rev = 1;        // default fallback

// -------------------- Data Buffer --------------------
static Sample* samples = nullptr;
static uint16_t sampleIndex = 0;

// -------------------- Timing --------------------
volatile uint32_t pulseCount = 0;
uint32_t lastSampleTime = 0;
float currentRPM = 0;

// -------------------- MQTT --------------------
static MQTTHandler* mqttClient = nullptr;

// -------------------- Timestamp Helper --------------------
static uint64_t getPreciseTimestampMillis() {
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    return (uint64_t)tv.tv_sec * 1000ULL + (uint64_t)(tv.tv_usec / 1000);
}

// -------------------- Pulse Interrupt Handler --------------------
void IRAM_ATTR onIRPulse() {
    pulseCount++;
}

// -------------------- Safe Buffer Allocation --------------------
static void allocateBuffer() {
    if (samples) {
        delete[] samples;
        samples = nullptr;
    }

    // Hard safety limit (prevents OOM from bad config)
    if (buffer_size < 1) buffer_size = 1;
    if (buffer_size > 1000) buffer_size = 1000;

    samples = new Sample[buffer_size];
    sampleIndex = 0;
}

// -------------------- Setup Infrared Sensor --------------------
void setupInfraredSensor(MQTTHandler* handler) {
    mqttClient = handler;

    // -------- Load Config from LittleFS --------
    if (LittleFS.exists(CONFIG_PATH)) {
        File file = LittleFS.open(CONFIG_PATH, "r");
        if (file) {
            JsonDocument doc;
            DeserializationError err = deserializeJson(doc, file);
            file.close();

            if (!err) {
                if (doc["buffer_size"].is<uint16_t>())
                    buffer_size = doc["buffer_size"];

                if (doc["sampling_interval_ms"].is<uint32_t>())
                    sampling_interval_ms = doc["sampling_interval_ms"];

                if (doc["pulses_per_rev"].is<uint8_t>())
                    pulses_per_rev = doc["pulses_per_rev"];
            }
        }
    }

    allocateBuffer();

    // -------- Sensor Init --------
    pinMode(IR_PIN, INPUT);   // Grove module actively drives HIGH/LOW
    attachInterrupt(digitalPinToInterrupt(IR_PIN), onIRPulse, FALLING);

    Serial.println("IR RPM sensor initialized on GPIO22 (SCL as GPIO)");
}

// -------------------- Runtime Config Update --------------------
void updateInfraredSensorConfig(const JsonDocument& cfg) {
    if (!cfg.is<JsonObject>()) return;

    bool changed = false;

    if (cfg["buffer_size"].is<uint16_t>()) {
        buffer_size = cfg["buffer_size"];
        changed = true;
    }

    if (cfg["sampling_interval_ms"].is<uint32_t>()) {
        sampling_interval_ms = cfg["sampling_interval_ms"];
    }

    if (cfg["pulses_per_rev"].is<uint8_t>()) {
        pulses_per_rev = cfg["pulses_per_rev"];
    }

    if (changed) allocateBuffer();
}

// -------------------- Channel Metadata --------------------
static const char* channels[] = {"RPM"};
static const uint8_t numChannels = 1;

// -------------------- Main Loop --------------------
void loopInfraredSensor() {
    uint32_t now = millis();
    if (now - lastSampleTime < sampling_interval_ms) return;
    lastSampleTime = now;

    noInterrupts();
    uint32_t pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    float windowSeconds = sampling_interval_ms / 1000.0f;
    currentRPM = (pulses * 60.0f) / (windowSeconds * pulses_per_rev);

    samples[sampleIndex].rpm = currentRPM;
    samples[sampleIndex].timestamp_ms = getPreciseTimestampMillis();
    sampleIndex++;

    if (sampleIndex >= buffer_size) {
        if (mqttClient && mqttClient->isTransmissionEnabled()) {
            JsonDocument doc;

            JsonArray tsArray = doc["timestamps"].to<JsonArray>();
            JsonArray valuesArray = doc["values"].to<JsonArray>();

            for (uint16_t i = 0; i < sampleIndex; i++) {
                tsArray.add(samples[i].timestamp_ms);
                JsonArray row = valuesArray.add<JsonArray>();
                row.add(samples[i].rpm);
            }

            JsonArray metaChannels = doc["channels"].to<JsonArray>();
            metaChannels.add("RPM");

            mqttClient->publishData(doc);

            Serial.printf("Published %d IR RPM samples via MQTT.\n", sampleIndex);
            Serial.println(doc.as<String>());
        }

        sampleIndex = 0;
    }
}

