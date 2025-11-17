"""
Test Worker System

This module manages background workers that collect and store sensor data for running tests.
Each worker:
- Monitors MQTT topics for sensors associated with a specific test
- Collects data continuously
- Saves data to database every 10 seconds (batched)
- Runs until the test is stopped
"""

import asyncio
import logging
import random
from datetime import datetime
from typing import Dict, List, Set, Optional
from collections import defaultdict

from database import test_relations, sensors, measurements

# Configure logging
logger = logging.getLogger(__name__)

# Global registry of active workers
_active_workers: Dict[int, 'TestWorker'] = {}
_worker_lock = asyncio.Lock()


class TestWorker:
    """
    Worker for a single test that collects sensor data.
    """
    
    def __init__(self, test_id: int):
        self.test_id = test_id
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        self.sensor_topics: Dict[int, str] = {}  # relation_id -> mqtt_topic
        self.data_buffer: Dict[int, List[Dict]] = defaultdict(list)  # relation_id -> [data_points]
        self.last_save_time = datetime.now()
        self.save_interval = 10  # seconds
        
    async def initialize(self) -> bool:
        """
        Initialize the worker by loading test relations and sensor topics.
        Returns True if initialization successful, False otherwise.
        """
        try:
            # Get all test relations for this test
            relations = await test_relations.get_test_relations(self.test_id)
            
            if not relations:
                logger.warning(f"No sensors found for test {self.test_id}")
                return False
            
            logger.info(f"Test {self.test_id}: Found {len(relations)} sensor relations")
            
            # Get MQTT topics for each sensor
            for relation in relations:
                sensor_id = relation['sensor_id']
                relation_id = relation['id']
                
                # Get sensor details including MQTT topic
                sensor_data = await sensors.get_sensor_by_id(sensor_id)
                
                if sensor_data:
                    # The sensor_id field contains the MQTT topic (sensor_mqtt_topic in database)
                    mqtt_topic = sensor_data.get('sensor_mqtt_topic')
                    
                    if mqtt_topic:
                        self.sensor_topics[relation_id] = mqtt_topic
                        logger.info(f"Test {self.test_id}: Relation ID {relation_id} -> Topic: {mqtt_topic}")
                    else:
                        logger.warning(f"Test {self.test_id}: Sensor {sensor_id} (Relation {relation_id}) has no MQTT topic configured")
                else:
                    logger.warning(f"Test {self.test_id}: Could not find sensor {sensor_id}")
            
            if len(self.sensor_topics) == 0:
                logger.error(f"Test {self.test_id}: No valid MQTT topics found for any sensors")
                return False
                
            return True
            
        except Exception as e:
            logger.error(f"Error initializing worker for test {self.test_id}: {e}")
            return False
    
    async def start(self):
        """Start the worker task."""
        if self.is_running:
            logger.warning(f"Worker for test {self.test_id} is already running")
            return
        
        # Initialize and load sensor topics
        if not await self.initialize():
            logger.error(f"Failed to initialize worker for test {self.test_id}")
            return
        
        self.is_running = True
        self.task = asyncio.create_task(self._run())
        logger.info(f"✅ Started worker for test {self.test_id}")
    
    async def stop(self):
        """Stop the worker task."""
        if not self.is_running:
            return
        
        self.is_running = False
        
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        
        # Final save of any remaining buffered data
        await self._save_buffered_data()
        
        logger.info(f"🛑 Stopped worker for test {self.test_id}")
    
    async def _run(self):
        """Main worker loop."""
        logger.info(f"🚀 Worker running for test {self.test_id}")
        logger.info(f"Monitoring {len(self.sensor_topics)} topics")
        
        try:
            while self.is_running:
                # Generate mock data for all sensors
                await self._generate_mock_data()
                
                # Print status every iteration
                await self._print_status()
                
                # Check if it's time to save data
                current_time = datetime.now()
                elapsed = (current_time - self.last_save_time).total_seconds()
                
                if elapsed >= self.save_interval:
                    await self._save_buffered_data()
                    self.last_save_time = current_time
                
                # Wait 1 second before next iteration
                await asyncio.sleep(1)
                
        except asyncio.CancelledError:
            logger.info(f"Worker for test {self.test_id} cancelled")
            raise
        except Exception as e:
            logger.error(f"Error in worker for test {self.test_id}: {e}")
            self.is_running = False
    
    async def _print_status(self):
        """Print current worker status (for debugging)."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n{'='*60}")
        print(f"[{timestamp}] Worker Status - Test ID: {self.test_id}")
        print(f"{'='*60}")
        print(f"Status: {'🟢 RUNNING' if self.is_running else '🔴 STOPPED'}")
        print(f"Monitored Topics ({len(self.sensor_topics)}):")
        
        for relation_id, topic in self.sensor_topics.items():
            buffer_size = len(self.data_buffer.get(relation_id, []))
            # Handle None topic gracefully
            topic_str = str(topic) if topic is not None else "NO_TOPIC"
            print(f"  - Relation ID: {relation_id:3d} | Topic: {topic_str:30s} | Buffer: {buffer_size:3d} points")
        
        elapsed = (datetime.now() - self.last_save_time).total_seconds()
        time_until_save = max(0, self.save_interval - elapsed)
        print(f"\nNext save in: {time_until_save:.1f}s")
        print(f"{'='*60}\n")
    
    async def _generate_mock_data(self):
        """
        Generate random mock data for all sensors.
        Creates data points with:
        - measurement_timestamp: current time
        - measurement_channel: random choice (can be None, 'x', 'y', or 'z')
        - measurement_value: random float value
        """
        current_time = datetime.now()
        
        for relation_id, topic in self.sensor_topics.items():
            # Randomly decide if this sensor sends data this iteration (80% chance)
            if random.random() < 0.8:
                # Generate 1-3 data points per sensor per second
                num_points = random.randint(1, 3)
                
                for _ in range(num_points):
                    # Channel can be None or one of x, y, z (for accelerometer-like sensors)
                    # 40% chance of no channel, 60% chance of having a channel
                    if random.random() < 0.4:
                        channel = None
                    else:
                        channel = random.choice(['x', 'y', 'z'])
                    
                    # Generate realistic sensor values based on topic type
                    if 'acc' in topic.lower() or 'accel' in topic.lower():
                        # Accelerometer: -2g to +2g
                        value = random.uniform(-2.0, 2.0)
                    elif 'temp' in topic.lower():
                        # Temperature: 20-80°C
                        value = random.uniform(20.0, 80.0)
                    elif 'current' in topic.lower():
                        # Current: 0-10A
                        value = random.uniform(0.0, 10.0)
                    elif 'flow' in topic.lower():
                        # Flow: 0-15 L/min
                        value = random.uniform(0.0, 15.0)
                    elif 'dist' in topic.lower():
                        # Distance: 0-100 cm
                        value = random.uniform(0.0, 100.0)
                    else:
                        # Generic: 0-100
                        value = random.uniform(0.0, 100.0)
                    
                    data_point = {
                        'test_relation_id': relation_id,
                        'measurement_timestamp': current_time,
                        'measurement_channel': channel,
                        'measurement_value': round(value, 3)
                    }
                    
                    self.data_buffer[relation_id].append(data_point)
    
    async def _save_buffered_data(self):
        """
        Save buffered data to database.
        """
        if not any(self.data_buffer.values()):
            logger.info(f"Test {self.test_id}: No data to save")
            return
        
        total_points = sum(len(buffer) for buffer in self.data_buffer.values())
        logger.info(f"💾 Test {self.test_id}: Saving {total_points} data points to database")
        
        try:
            # Prepare measurements for database insert
            all_measurements = []
            
            for relation_id, data_points in self.data_buffer.items():
                if data_points:
                    topic = self.sensor_topics.get(relation_id, 'Unknown')
                    logger.info(f"  - Relation {relation_id} ({topic}): {len(data_points)} points")
                    
                    for point in data_points:
                        measurement = {
                            'measurement_timestamp': point['measurement_timestamp'],
                            'test_relation_id': point['test_relation_id'],
                            'measurement_channel': point['measurement_channel'],
                            'measurement_value': point['measurement_value']
                        }
                        all_measurements.append(measurement)
            
            # Save to database
            if all_measurements:
                success = await measurements.insert_measurements(all_measurements)
                
                if success:
                    logger.info(f"✅ Test {self.test_id}: Successfully saved {len(all_measurements)} measurements")
                else:
                    logger.error(f"❌ Test {self.test_id}: Failed to save measurements")
            
        except Exception as e:
            logger.error(f"❌ Test {self.test_id}: Error saving data: {e}")
        finally:
            # Clear buffer after saving (or attempting to save)
            self.data_buffer.clear()
    
    def collect_data_point(self, relation_id: int, value: float, channel: str = None, timestamp: datetime = None):
        """
        Collect a data point for buffering.
        This can be called by MQTT message handler when real MQTT data arrives.
        
        Args:
            relation_id: The test_relation_id
            value: The measurement value
            channel: Optional channel (e.g., 'x', 'y', 'z' for accelerometer)
            timestamp: Optional timestamp (defaults to current time)
        """
        if timestamp is None:
            timestamp = datetime.now()
        
        data_point = {
            'test_relation_id': relation_id,
            'measurement_timestamp': timestamp,
            'measurement_channel': channel,
            'measurement_value': value
        }
        
        self.data_buffer[relation_id].append(data_point)


# ================================
# Worker Management Functions
# ================================

async def start_worker_for_test(test_id: int) -> bool:
    """
    Start a new worker for the given test ID.
    Returns True if started successfully, False if already running or error.
    """
    async with _worker_lock:
        # Check if worker already exists
        if test_id in _active_workers:
            logger.warning(f"Worker for test {test_id} already exists")
            return False
        
        # Create and start new worker
        worker = TestWorker(test_id)
        await worker.start()
        
        if worker.is_running:
            _active_workers[test_id] = worker
            logger.info(f"✅ Worker for test {test_id} registered")
            return True
        else:
            logger.error(f"❌ Failed to start worker for test {test_id}")
            return False


async def stop_worker_for_test(test_id: int) -> bool:
    """
    Stop the worker for the given test ID.
    Returns True if stopped successfully, False if not found.
    """
    async with _worker_lock:
        worker = _active_workers.get(test_id)
        
        if not worker:
            logger.warning(f"No worker found for test {test_id}")
            return False
        
        await worker.stop()
        del _active_workers[test_id]
        logger.info(f"✅ Worker for test {test_id} removed from registry")
        return True


async def get_active_workers() -> List[int]:
    """Get list of test IDs with active workers."""
    async with _worker_lock:
        return list(_active_workers.keys())


async def is_worker_running(test_id: int) -> bool:
    """Check if a worker is running for the given test ID."""
    async with _worker_lock:
        worker = _active_workers.get(test_id)
        return worker is not None and worker.is_running


async def stop_all_workers():
    """Stop all active workers. Called on application shutdown."""
    async with _worker_lock:
        test_ids = list(_active_workers.keys())
        
        logger.info(f"Stopping {len(test_ids)} active workers...")
        
        for test_id in test_ids:
            worker = _active_workers[test_id]
            await worker.stop()
        
        _active_workers.clear()
        logger.info("All workers stopped")


async def get_worker_status(test_id: int) -> Optional[Dict]:
    """
    Get detailed status of a worker.
    Returns None if worker not found.
    """
    async with _worker_lock:
        worker = _active_workers.get(test_id)
        
        if not worker:
            return None
        
        return {
            'test_id': test_id,
            'is_running': worker.is_running,
            'sensor_count': len(worker.sensor_topics),
            'topics': worker.sensor_topics,
            'buffer_sizes': {
                relation_id: len(buffer) 
                for relation_id, buffer in worker.data_buffer.items()
            },
            'last_save_time': worker.last_save_time.isoformat(),
            'save_interval': worker.save_interval
        }
