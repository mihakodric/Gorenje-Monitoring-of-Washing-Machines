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

TOPIC_FILTER = ["sensors/+/data", "sensors/+/heartbeat"]

BINDING_REFRESH_SEC = int(os.environ.get("BINDING_REFRESH_SEC", 5))
FLUSH_INTERVAL_SEC = int(os.environ.get("FLUSH_INTERVAL_SEC", 10))
MAX_BUFFER_SIZE = int(os.environ.get("MAX_BUFFER_SIZE", 5000))

HEARTBEAT_OFFLINE_SEC = int(os.environ.get("HEARTBEAT_OFFLINE_SEC", 30))


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

        # buffering: list of tuples (timestamp_ms, test_relation_id, channel, value)
        self.buffer: List[Tuple[float, int, str, float]] = []

        # asyncio loop reference
        self.loop: Optional[asyncio.AbstractEventLoop] = None

        # MQTT client
        self.mqtt = mqtt.Client()
        self.mqtt.on_connect = self.on_connect
        self.mqtt.on_message = self.on_message

        # async queue for messages
        self.queue = asyncio.Queue()

    # =========================
    # MQTT
    # =========================

    def on_connect(self, client, userdata, flags, rc):
        print(f"[MQTT] Connected rc={rc}")
        
        for topic in TOPIC_FILTER:
            client.subscribe(topic)
            print(f"[MQTT] Subscribed to {topic}")

    def on_message(self, client, userdata, msg):
        print(f"🔥 ON_MESSAGE FIRED! Topic: {msg.topic}, Payload size: {len(msg.payload)}")

        parts = msg.topic.split("/")
        if len(parts) != 3:
            return

        _, sensor_name, msg_type = parts

        try:
            payload = json.loads(msg.payload.decode())
        except Exception:
            self.dead_letter(msg.topic, msg.payload)
            return

        # ✅ HEARTBEAT HANDLING (DO NOT BUFFER)
        if msg_type == "heartbeat":
            asyncio.run_coroutine_threadsafe(
                self.process_heartbeat(sensor_name),
                self.loop,
            )
            return

        # ✅ DATA HANDLING
        if msg_type == "data":
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
        sql = "SELECT id FROM metadata.sensors WHERE sensor_mqtt_topic=$1;"
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(sql, sensor_name)
        return row["id"] if row else None

    async def refresh_bindings(self):
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

        records_to_insert = self.buffer
        self.buffer = []
        BATCH_SIZE = 1000

        sql = """
        INSERT INTO timeseries.measurements (
            measurement_timestamp,
            test_relation_id,
            measurement_channel,
            measurement_value
        )
        VALUES (to_timestamp($1::double precision / 1000), $2, $3, $4)
        """

        total_inserted = 0
        try:
            async with self.db_pool.acquire() as conn:
                async with conn.transaction():
                    for i in range(0, len(records_to_insert), BATCH_SIZE):
                        batch = records_to_insert[i:i + BATCH_SIZE]
                        await conn.executemany(sql, batch)
                        total_inserted += len(batch)

            print(f"[DB] Flushed {total_inserted} measurements in {len(records_to_insert) // BATCH_SIZE + 1} batches")

        except Exception as e:
            print(f"[ERROR] Flush failed: {e}, sending {len(records_to_insert)} records to dead-letter")
            for rec in records_to_insert:
                self.dead_letter("flush_buffer", rec)

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

            if sensor_name not in self.sensor_cache:
                sensor_id = await self.resolve_sensor_id(sensor_name)
                if not sensor_id:
                    self.dead_letter(sensor_name, payload)
                    continue
                self.sensor_cache[sensor_name] = sensor_id

            sensor_id = self.sensor_cache[sensor_name]

            if sensor_id not in self.bindings:
                self.dead_letter(sensor_name, payload)
                continue

            test_relation_id = self.bindings[sensor_id]

            timestamps = payload.get("timestamps")
            values = payload.get("values")
            channels = payload.get("channels")

            if not (isinstance(timestamps, list) and isinstance(values, list) and isinstance(channels, list)):
                self.dead_letter(sensor_name, payload)
                continue

            # Flatten arrays into (timestamp, channel, value) tuples
            for i, ts in enumerate(timestamps):
                try:
                    sample_values = values[i]
                except IndexError:
                    continue

                for ch_idx, ch in enumerate(channels):
                    try:
                        val = float(sample_values[ch_idx])
                    except (IndexError, ValueError, TypeError):
                        continue
                    self.buffer.append((ts, test_relation_id, ch, val))

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


    async def process_heartbeat(self, sensor_name: str):
        if sensor_name not in self.sensor_cache:
            sensor_id = await self.resolve_sensor_id(sensor_name)
            if not sensor_id:
                return
            self.sensor_cache[sensor_name] = sensor_id

        sensor_id = self.sensor_cache[sensor_name]

        sql = """
        UPDATE metadata.sensors
        SET sensor_is_online = TRUE,
            sensor_last_seen = now()
        WHERE id = $1
        """

        async with self.db_pool.acquire() as conn:
            await conn.execute(sql, sensor_id)

        print(f"[HB] Sensor {sensor_name} marked ONLINE")

    async def offline_watcher(self):
        while True:
            try:
                sql = """
                UPDATE metadata.sensors
                SET sensor_is_online = FALSE
                WHERE sensor_last_seen IS NOT NULL
                AND now() - sensor_last_seen > make_interval(secs => $1)
                """

                async with self.db_pool.acquire() as conn:
                    result = await conn.execute(sql, HEARTBEAT_OFFLINE_SEC)

                print("[HB] Offline scan executed")

            except Exception as e:
                print("[ERROR] Offline watcher:", e)

            await asyncio.sleep(HEARTBEAT_OFFLINE_SEC // 2)



    # =========================
    # MAIN
    # =========================

    async def run(self):
        self.loop = asyncio.get_running_loop()

        await self.init_db()

        self.mqtt.connect(MQTT_BROKER, MQTT_PORT, keepalive=30)
        self.mqtt.loop_start()  # non-blocking

        print("[MQTT] Loop started, worker running...")

        await asyncio.gather(
            self.message_worker(),
            self.binding_refresher(),
            self.periodic_flusher(),
            self.offline_watcher(), 
        )


if __name__ == "__main__":
    print("🚀 Starting MQTT Worker...")
    worker = MQTTWorker()
    asyncio.run(worker.run())
