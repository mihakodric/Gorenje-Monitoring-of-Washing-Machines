// ======================= dist_sensor.cpp =======================
#include "dist_sensor.h"
#include <LittleFS.h>
#include <Wire.h>
#include <time.h>

// -------------------- Sensor Object --------------------
DFRobot_VL6180X VL6180X;

// -------------------- Runtime Config --------------------
static uint16_t buffer_size = 100;           // default fallback
static uint32_t sampling_interval_ms = 50;   // default fallback

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

// -------------------- Safe Buffer Allocation --------------------
static void allocateBuffer() {
    if (samples) {
        delete[] samples;
        samples = nullptr;
    }

    // Hard safety limit (prevents OOM from bad config)
    if (buffer_size < 1) buffer_size = 1;
    if (buffer_size > 2000) buffer_size = 2000;

    samples = new Sample[buffer_size];
    sampleIndex = 0;
}

// -------------------- Setup Distance Sensor --------------------
void setupDistanceSensor(MQTTHandler* handler) {
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
            }
        }
    }

    allocateBuffer();

    // -------- I2C + Sensor Init --------
    Wire.begin();

    if (!VL6180X.begin()) {
        Serial.println("VL6180X INIT FAILED!");
        while (true) delay(1000);  // fail fast, not silently
    }

    Serial.printf("Distance sensor started: interval=%lu ms, buffer=%u\n",
                  sampling_interval_ms, buffer_size);
}

// -------------------- Runtime Config Update --------------------
void updateDistanceSensorConfig(const JsonDocument& cfg) {
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
static const char* channels[] = {"distance_mm"};
static const uint8_t numChannels = 1;

// -------------------- Main Loop --------------------
void loopDistanceSensor() {
    uint32_t now = millis();

    if (now - lastRead < sampling_interval_ms) return;
    lastRead = now;

    // -------- Read Measurement --------
    uint16_t rawDistance = VL6180X.rangePollMeasurement();
    uint8_t status = VL6180X.getRangeResult();

    float distance;

    if (status == 0) {
    // ✅ Valid reading
        distance = static_cast<float>(rawDistance);
    } else {
        // ✅ Explicit invalid sample
        distance = NAN;
    }

    // -------- Store Sample --------
    samples[sampleIndex].distance_mm = distance;
    samples[sampleIndex].timestamp_ms = getPreciseTimestampMillis();
    sampleIndex++;

    // -------- Publish When Full --------
    if (sampleIndex >= buffer_size) {
        if (mqttClient && mqttClient->isTransmissionEnabled()) {
            JsonDocument doc;

            JsonArray tsArray = doc["timestamps"].to<JsonArray>();
            JsonArray valuesArray = doc["values"].to<JsonArray>();

            for (uint16_t i = 0; i < sampleIndex; i++) {
                tsArray.add(samples[i].timestamp_ms);

                JsonArray row = valuesArray.add<JsonArray>();
                row.add(samples[i].distance_mm);
            }

            JsonArray metaChannels = doc["channels"].to<JsonArray>();
            for (uint8_t c = 0; c < numChannels; c++) {
                metaChannels.add(channels[c]);
            }

            Serial.println("Publishing distance data...\n");
            Serial.println(doc.as<String>());

            mqttClient->publishData(doc);
        }

        // ✅ Always reset deterministically
        sampleIndex = 0;
    }
}
