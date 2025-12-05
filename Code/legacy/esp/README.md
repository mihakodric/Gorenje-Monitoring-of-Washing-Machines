# ESP32 Accelerometer MQTT Project

This project uses an **ESP32** with an **LIS2DW12 accelerometer** to collect motion data and send it via **MQTT**.  
It supports runtime configuration updates, buffering, and timestamped JSON messages.

---

## 1️⃣ Required Arduino Libraries

Install these libraries using **Arduino IDE → Tools → Manage Libraries…**:

| Library | Author | Notes |
|---------|--------|-------|
| **PubSubClient** | Nick O'Leary | Must increase MQTT buffer size (see Step 2) |
| **ArduinoJson** | Benoit Blanchon | Handles JSON for config & data |
| **LittleFS_esp32** | lorol | Stores configuration on ESP32 filesystem |
| **Time / NTP** | built-in | For timestamping samples |

---

## 2️⃣ Increase MQTT Packet Size

The default MQTT buffer is too small for large JSON payloads.  
Edit the file:

