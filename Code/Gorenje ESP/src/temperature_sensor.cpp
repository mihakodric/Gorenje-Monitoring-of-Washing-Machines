// ======================= temperature_sensor.cpp =======================
#include "temperature_sensor.h"
#include <LittleFS.h>
#include <Wire.h>
#include <time.h>

// -------------------- Sensor Object --------------------
DFRobot_MLX90614_I2C sensor;

// -------------------- Runtime Config --------------------
static uint16_t buffer_size = 5;           // default fallback
static uint32_t sampling_interval_ms = 1000;   // default fallback

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
    if (buffer_size > 1000) buffer_size = 1000;

    samples = new Sample[buffer_size];
    sampleIndex = 0;
}

// -------------------- Setup Temperature Sensor --------------------
void setupTemperatureSensor(MQTTHandler* handler) {
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
    #define SDA_PIN 21
    #define SCL_PIN 22
    Wire.begin(SDA_PIN, SCL_PIN);

    while (sensor.begin() != NO_ERR) {
        Serial.println("Sensor init failed, retrying...");
        delay(1000);
    }

    Serial.printf("Temperature sensor started: interval=%lu ms, buffer=%u\n",
                  sampling_interval_ms, buffer_size);
}

// -------------------- Runtime Config Update --------------------
void updateTemperatureSensorConfig(const JsonDocument& cfg) {
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
static const char* channels[] = {"object_temperature_c", "ambient_temperature_c"};
static const uint8_t numChannels = 2;

// -------------------- Main Loop --------------------
void loopTemperatureSensor() {
    uint32_t now = millis();

    if (now - lastRead < sampling_interval_ms) return;
    lastRead = now;

    // -------- Read Measurement --------
    float object_temperature = sensor.getObjectTempCelsius();
    float ambient_temperature = sensor.getAmbientTempCelsius();

    // -------- Store Sample --------
    samples[sampleIndex].object_temperature_c = object_temperature;
    samples[sampleIndex].ambient_temperature_c = ambient_temperature;
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
                row.add(samples[i].object_temperature_c);
                row.add(samples[i].ambient_temperature_c);
            }

            JsonArray metaChannels = doc["channels"].to<JsonArray>();
            for (uint8_t c = 0; c < numChannels; c++) {
                metaChannels.add(channels[c]);
            }

            Serial.println("Publishing temperature data...\n");
            Serial.println(doc.as<String>());

            mqttClient->publishData(doc);
        }

        // ✅ Always reset deterministically
        sampleIndex = 0;
    }
}
