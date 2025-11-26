import asyncio
import json
import os
import time
from typing import Dict, Optional, List, Tuple

import asyncpg
import paho.mqtt.client as mqtt


# =========================
# ENV CONFIG
# =========================

DB_URL = os.environ["DATABASE_URL"]
MQTT_BROKER = os.environ.get("MQTT_BROKER", "mosquitto")
MQTT_PORT = int(os.environ.get("MQTT_PORT", 1883))

TOPIC_FILTER = "sensors/+/data"

BINDING_REFRESH_SEC = int(os.environ.get("BINDING_REFRESH_SEC", 5))
FLUSH_INTERVAL_SEC = int(os.environ.get("FLUSH_INTERVAL_SEC", 10))
MAX_BUFFER_SIZE = int(os.environ.get("MAX_BUFFER_SIZE", 5000))

DEAD_LETTER_FILE = "/app/dead_letters.log"


# =========================
# WORKER
# =========================

class MQTTWorker:
    def __init__(self):
        self.db_pool: Optional[asyncpg.pool.Pool] = None

        # sensor_id -> test_relation_id
        self.bindings: Dict[int, int] = {}

        # sensor_name -> sensor_id cache
        self.sensor_cache: Dict[str, int] = {}

        # buffering
        self.buffer: List[Tuple[float, int, str, float]] = []

        # asyncio loop reference
        self.loop: Optional[asyncio.AbstractEventLoop] = None

        # MQTT client
        self.mqtt = mqtt.Client()
        self.mqtt.on_connect = self.on_connect
        self.mqtt.on_message = self.on_message

        # async queue
        self.queue = asyncio.Queue()

    # =========================
    # MQTT
    # =========================

    def on_connect(self, client, userdata, flags, rc):
        print(f"[MQTT] Connected rc={rc}")
        client.subscribe(TOPIC_FILTER)
        print(f"[MQTT] Subscribed to {TOPIC_FILTER}")

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
        except Exception:
            self.dead_letter(msg.topic, msg.payload)
            return

        parts = msg.topic.split("/")
        sensor_name = parts[1]

        asyncio.run_coroutine_threadsafe(
            self.queue.put((sensor_name, payload)),
            self.loop,
        )

    # =========================
    # DATABASE
    # =========================

    async def init_db(self):
        print("[DB] Connecting...")
        self.db_pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=10)
        print("[DB] Connected")

    async def resolve_sensor_id(self, sensor_name: str) -> Optional[int]:
        sql = "SELECT id FROM metadata.sensors WHERE device_name=$1;"
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(sql, sensor_name)
        return row["id"] if row else None

    async def refresh_bindings(self):
        """
        ✅ CORRECT ACTIVE BINDING QUERY
        """
        sql = """
        SELECT id, sensor_id
        FROM metadata.test_relations
        WHERE active = TRUE;
        """

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(sql)

        new_map = {row["sensor_id"]: row["id"] for row in rows}

        if new_map != self.bindings:
            print("[DB] Active bindings updated:", new_map)

        self.bindings = new_map

    # =========================
    # BULK INSERT
    # =========================

    async def flush_buffer(self):
        if not self.buffer:
            return

        records = self.buffer
        self.buffer = []

        sql = """
        INSERT INTO timeseries.measurements (
            measurement_timestamp,
            test_relation_id,
            measurement_channel,
            measurement_value
        )
        VALUES ($1, $2, $3, $4)
        """

        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(sql, records)

        print(f"[DB] Flushed {len(records)} measurements")

    # =========================
    # DEAD LETTER
    # =========================

    def dead_letter(self, topic, payload):
        with open(DEAD_LETTER_FILE, "a") as f:
            f.write(f"{time.time()} {topic} {payload}\n")

    # =========================
    # WORKERS
    # =========================

    async def message_worker(self):
        print("[Worker] Message processor started")

        while True:
            sensor_name, payload = await self.queue.get()

            # timestamp
            ts = payload.get("timestamp", time.time())

            # resolve sensor id
            if sensor_name not in self.sensor_cache:
                sensor_id = await self.resolve_sensor_id(sensor_name)
                if not sensor_id:
                    self.dead_letter(sensor_name, payload)
                    continue
                self.sensor_cache[sensor_name] = sensor_id

            sensor_id = self.sensor_cache[sensor_name]

            # active test lookup
            if sensor_id not in self.bindings:
                self.dead_letter(sensor_name, payload)
                continue

            test_relation_id = self.bindings[sensor_id]

            data_list = payload.get("data")
            if not isinstance(data_list, list):
                self.dead_letter(sensor_name, payload)
                continue

            for item in data_list:
                try:
                    ts = item["datetime"]
                    channel = item["channel"]
                    value = float(item["value"])
                except (KeyError, TypeError, ValueError):
                    self.dead_letter(sensor_name, item)
                    continue

                self.buffer.append((ts, test_relation_id, channel, value))

            if len(self.buffer) >= MAX_BUFFER_SIZE:
                await self.flush_buffer()

    async def binding_refresher(self):
        while True:
            try:
                await self.refresh_bindings()
            except Exception as e:
                print("[ERROR] Binding refresh:", e)

            await asyncio.sleep(BINDING_REFRESH_SEC)

    async def periodic_flusher(self):
        while True:
            try:
                await self.flush_buffer()
            except Exception as e:
                print("[ERROR] Flush failed:", e)

            await asyncio.sleep(FLUSH_INTERVAL_SEC)


    async def debug_active_sensors(self):
        while True:
            if self.bindings:
                active_sensors = []
                for sensor_id in self.bindings.keys():
                    name = next((n for n, sid in self.sensor_cache.items() if sid == sensor_id), sensor_id)
                    active_sensors.append(name)
                print("[DEBUG] Currently active sensors:", active_sensors)
            else:
                print("[DEBUG] No active sensors yet")
            await asyncio.sleep(10)  # every 10s


    # =========================
    # MAIN
    # =========================

    async def run(self):
        self.loop = asyncio.get_running_loop()

        await self.init_db()

        def start_mqtt():
            self.mqtt.connect(MQTT_BROKER, MQTT_PORT, keepalive=30)
            self.mqtt.loop_forever()

        self.loop.run_in_executor(None, start_mqtt)

        await asyncio.gather(
            self.message_worker(),
            self.binding_refresher(),
            self.periodic_flusher(),
            self.debug_active_sensors(),
        )


if __name__ == "__main__":
    print("🚀 Starting MQTT Worker...")
    worker = MQTTWorker()
    asyncio.run(worker.run())
