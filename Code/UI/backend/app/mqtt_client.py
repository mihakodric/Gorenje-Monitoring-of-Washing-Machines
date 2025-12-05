import json
import logging
import threading
import time
import paho.mqtt.client as mqtt

logger = logging.getLogger(__name__)

# =========================
# GLOBAL CLIENT STATE
# =========================

mqtt_client: mqtt.Client | None = None
mqtt_ready = False
mqtt_lock = threading.Lock()   # ✅ protects publish calls


# =========================
# MQTT CALLBACKS
# =========================

def _on_connect(client, userdata, flags, rc):
    global mqtt_ready

    if rc == 0:
        mqtt_ready = True
        logger.info("✅ MQTT connected")
    else:
        mqtt_ready = False
        logger.error(f"❌ MQTT failed to connect: {rc}")


def _on_disconnect(client, userdata, rc):
    global mqtt_ready
    mqtt_ready = False
    logger.warning("⚠️ MQTT disconnected")


# =========================
# PUBLIC API
# =========================

def connect_mqtt(
    host: str = "mosquitto",
    port: int = 1883,
    keepalive: int = 60,
):
    """
    Connect exactly ONCE at application startup (lifespan).
    Safe against duplicate calls.
    """
    global mqtt_client

    if mqtt_client is not None:
        logger.warning("⚠️ MQTT already initialized")
        return

    logger.info("🔌 Initializing MQTT client...")

    client = mqtt.Client(client_id="Backend_API", clean_session=True)

    client.on_connect = _on_connect
    client.on_disconnect = _on_disconnect

    client.connect(host, port, keepalive)
    client.loop_start()

    mqtt_client = client

    # 🔒 Wait briefly for connection (prevents race on first publish)
    for _ in range(20):
        if mqtt_ready:
            break
        time.sleep(0.1)

    if not mqtt_ready:
        logger.error("❌ MQTT failed to become ready after startup")


def publish_cmd(topic: str, payload: dict):
    """
    Thread-safe publish with strict readiness enforcement.
    """
    if mqtt_client is None:
        raise RuntimeError("MQTT client not initialized")

    if not mqtt_ready:
        raise RuntimeError("MQTT broker not connected yet")

    print("📤 Publishing MQTT command...")
    print(f"Topic: {topic}")
    print(f"Payload: {payload}")

    message = json.dumps(payload)

    with mqtt_lock:   # ✅ prevents races under load
        result = mqtt_client.publish(
            topic,
            message,
            qos=1,
            retain=False
        )

    if result.rc != mqtt.MQTT_ERR_SUCCESS:
        logger.error(f"❌ MQTT publish failed: {result.rc}")
    else:
        logger.info(f"📤 MQTT published → {topic} : {payload}")


def disconnect_mqtt():
    """
    Clean shutdown called from FastAPI lifespan.
    """
    global mqtt_client, mqtt_ready

    if mqtt_client is None:
        return

    try:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        mqtt_ready = False
        logger.info("✅ MQTT disconnected cleanly")
    except Exception as e:
        logger.exception(f"❌ MQTT shutdown failed: {e}")

    mqtt_client = None
