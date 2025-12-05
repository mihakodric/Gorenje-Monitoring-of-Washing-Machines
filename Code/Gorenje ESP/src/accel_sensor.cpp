// ======================= accel_sensor.cpp =======================
#include "accel_sensor.h"
#include <LittleFS.h>
#include <Wire.h>
#include <time.h>

static int buffer_size = 10;
static int sampling_frequency = 200;
static int range_g = 16;
static float sensitivity = 0.000488f;

static Sample* samples = nullptr;
static int sampleIndex = 0;
static unsigned long lastRead = 0;
static unsigned long sampleIntervalMillis = 0;

static MQTTHandler* mqttClient = nullptr;

// -------------------- Timestamp helper --------------------
static uint64_t getPreciseTimestampMillis() {
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    return (uint64_t)tv.tv_sec * 1000ULL + (uint64_t)(tv.tv_usec / 1000);
}

// -------------------- Setup accelerometer --------------------
void setupAccelerometer(MQTTHandler* handler) {
    mqttClient = handler;

    // Load LittleFS config if exists
    if (LittleFS.exists(CONFIG_PATH)) {
        File file = LittleFS.open(CONFIG_PATH, "r");
        if (file) {
            JsonDocument doc;
            deserializeJson(doc, file);
            file.close();

            buffer_size = doc["buffer_size"] | buffer_size;
            sampling_frequency = doc["sampling_frequency_Hz"] | sampling_frequency;
            range_g = doc["range_g"] | range_g;
            sensitivity = doc["sensitivity"] | sensitivity;
        }
    }

    samples = new Sample[buffer_size];
    sampleIntervalMillis = 1000UL / sampling_frequency;

    Wire.begin(21, 22);

    // Configure ODR
    Wire.beginTransmission(LIS2DW12_ADDR);
    Wire.write(0x20);
    Wire.write(0x60);
    Wire.endTransmission();

    // Configure range
    uint8_t range_reg = 0x30;
    switch (range_g) {
        case 2:  range_reg = 0x00; break;
        case 4:  range_reg = 0x10; break;
        case 8:  range_reg = 0x20; break;
        case 16: range_reg = 0x30; break;
    }
    Wire.beginTransmission(LIS2DW12_ADDR);
    Wire.write(0x25);
    Wire.write(range_reg);
    Wire.endTransmission();
}

// -------------------- Runtime config update --------------------
void updateAccelerometerConfig(const JsonDocument& cfg) {
    if (!cfg.is<JsonObject>()) return;

    if (cfg["buffer_size"].is<int>()) buffer_size = cfg["buffer_size"];
    if (cfg["sampling_frequency_Hz"].is<int>()) sampling_frequency = cfg["sampling_frequency_Hz"];
    if (cfg["range_g"].is<int>()) range_g = cfg["range_g"];
    if (cfg["sensitivity"].is<float>()) sensitivity = cfg["sensitivity"];

    sampleIntervalMillis = 1000UL / sampling_frequency;

    if (samples) delete[] samples;
    samples = new Sample[buffer_size];
    sampleIndex = 0;
}

// Define channels once (metadata)
static const char* channels[] = {"x", "y", "z"};
static const uint8_t numChannels = 3;

// -------------------- Main loop --------------------
void loopAccelerometer() {
    unsigned long now = millis();
    if (now - lastRead < sampleIntervalMillis) return;
    lastRead = now;

    // Read raw accelerometer data
    uint8_t data[6] = {0};
    Wire.beginTransmission(LIS2DW12_ADDR);
    Wire.write(OUT_X_L | 0x80);
    Wire.endTransmission();
    Wire.requestFrom(LIS2DW12_ADDR, 6);

    for (int i = 0; i < 6 && Wire.available(); i++)
        data[i] = Wire.read();

    float x = (int16_t)(data[1] << 8 | data[0]) * sensitivity;
    float y = (int16_t)(data[3] << 8 | data[2]) * sensitivity;
    float z = (int16_t)(data[5] << 8 | data[4]) * sensitivity;

    samples[sampleIndex] = {x, y, z, getPreciseTimestampMillis()};
    sampleIndex++;

    // Publish when buffer full
    if (sampleIndex >= buffer_size && mqttClient && mqttClient->isTransmissionEnabled()) {
        JsonDocument doc;

        // Single timestamp array
        JsonArray tsArray = doc.createNestedArray("timestamps");
        // 2D array: values[sampleIndex][channelIndex]
        JsonArray valuesArray = doc.createNestedArray("values");

        for (int i = 0; i < sampleIndex; i++) {
            tsArray.add(samples[i].datetime);

            JsonArray sampleValues = valuesArray.createNestedArray();
            sampleValues.add(samples[i].x);
            sampleValues.add(samples[i].y);
            sampleValues.add(samples[i].z);
        }

        // Include channel metadata (optional, only once)
        JsonArray metaChannels = doc.createNestedArray("channels");
        for (uint8_t c = 0; c < numChannels; c++) {
            metaChannels.add(channels[c]);
        }

        mqttClient->publishData(doc);
        sampleIndex = 0;
    }

    if (sampleIndex >= buffer_size) sampleIndex = 0;
}
