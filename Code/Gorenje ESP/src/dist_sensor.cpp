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
static bool oversampling_enabled = true;     // default fallback
static uint8_t calculated_oversampling_factor = 1;  // calculated at runtime

// -------------------- Data Buffer --------------------
static Sample* samples = nullptr;
static uint16_t sampleIndex = 0;

// -------------------- Timing --------------------
static uint32_t lastRead = 0;

// -------------------- MQTT --------------------
static MQTTHandler* mqttClient = nullptr;

// -------------------- Oversampling Buffer --------------------
static uint16_t* oversamplingBuffer = nullptr;

// -------------------- Timestamp Helper --------------------
static uint64_t getPreciseTimestampMillis() {
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    return (uint64_t)tv.tv_sec * 1000ULL + (uint64_t)(tv.tv_usec / 1000);
}

// -------------------- Median Calculation --------------------
static uint16_t calculateMedian(uint16_t* values, uint8_t count) {
    // Simple bubble sort for small arrays
    for (uint8_t i = 0; i < count - 1; i++) {
        for (uint8_t j = 0; j < count - i - 1; j++) {
            if (values[j] > values[j + 1]) {
                uint16_t temp = values[j];
                values[j] = values[j + 1];
                values[j + 1] = temp;
            }
        }
    }
    
    // Return median
    if (count % 2 == 0) {
        return (values[count / 2 - 1] + values[count / 2]) / 2;
    } else {
        return values[count / 2];
    }
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
    
    // Calculate optimal oversampling factor if enabled
    if (oversampling_enabled) {
        // Each reading takes ~30ms + 15ms delay = ~45ms total per reading
        // Conservative estimate: 40ms per reading
        calculated_oversampling_factor = sampling_interval_ms / 40;
        
        // Cap between 1 and 10
        if (calculated_oversampling_factor < 1) calculated_oversampling_factor = 1;
        if (calculated_oversampling_factor > 10) calculated_oversampling_factor = 10;
    } else {
        calculated_oversampling_factor = 1;  // No oversampling
    }
    
    // Allocate oversampling buffer
    if (oversamplingBuffer) {
        delete[] oversamplingBuffer;
    }
    oversamplingBuffer = new uint16_t[calculated_oversampling_factor];
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
                    
                if (doc["oversampling_enabled"].is<bool>())
                    oversampling_enabled = doc["oversampling_enabled"];
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

    Serial.printf("Distance sensor started: interval=%lu ms, buffer=%u, oversampling=%s (factor=%u)\n",
                  sampling_interval_ms, buffer_size, 
                  oversampling_enabled ? "ON" : "OFF", calculated_oversampling_factor);
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
        changed = true;  // Recalculate oversampling factor
    }
    
    if (cfg["oversampling_enabled"].is<bool>()) {
        oversampling_enabled = cfg["oversampling_enabled"];
        changed = true;
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

    // -------- Oversample and Calculate Median --------
    uint8_t validReadings = 0;
    
    for (uint8_t i = 0; i < calculated_oversampling_factor; i++) {
        uint16_t rawDistance = VL6180X.rangePollMeasurement();
        uint8_t status = VL6180X.getRangeResult();
        
        if (status == 0) {
            oversamplingBuffer[validReadings] = rawDistance;
            validReadings++;
        }
        
        // Delay between readings to ensure sensor completes new measurement
        // VL6180X needs ~10-30ms per measurement
        if (i < calculated_oversampling_factor - 1) {
            delay(15);
        }
    }
    
    float distance;
    
    if (validReadings > 0) {
        // ✅ Calculate median and round to integer
        uint16_t medianValue = calculateMedian(oversamplingBuffer, validReadings);
        distance = static_cast<float>(medianValue);
    } else {
        // ✅ No valid readings
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
