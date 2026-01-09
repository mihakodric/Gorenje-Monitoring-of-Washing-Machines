-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
LOAD 'timescaledb';
SET search_path TO public, timescaledb, metadata, timeseries;

-- =====================================================
--  SCHEMAS
-- =====================================================
CREATE SCHEMA IF NOT EXISTS metadata;
CREATE SCHEMA IF NOT EXISTS timeseries;

-- =====================================================
--  METADATA TABLES
-- =====================================================

CREATE TABLE metadata.machine_types (
    id SERIAL PRIMARY KEY,
    machine_type_name TEXT UNIQUE NOT NULL,
    machine_type_description TEXT,
    machine_type_created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE metadata.machines (
    id SERIAL PRIMARY KEY,
    machine_name TEXT UNIQUE NOT NULL,
    machine_description TEXT,
    machine_type_id INT REFERENCES metadata.machine_types(id) ON DELETE SET NULL,
    machine_created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE metadata.sensor_types (
    id SERIAL PRIMARY KEY,
    sensor_type_name TEXT UNIQUE NOT NULL,
    sensor_type_unit TEXT,
    sensor_type_description TEXT,
    sensor_type_created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE metadata.sensors (
    id SERIAL PRIMARY KEY,
    sensor_type_id INT REFERENCES metadata.sensor_types(id) ON DELETE SET NULL,
    sensor_mqtt_topic TEXT UNIQUE NOT NULL,
    sensor_name TEXT UNIQUE NOT NULL,
    sensor_description TEXT,
    sensor_is_online BOOLEAN DEFAULT FALSE,
    sensor_created_at TIMESTAMPTZ DEFAULT now(),
    sensor_last_seen TIMESTAMPTZ DEFAULT NULL,
    sensor_settings JSONB DEFAULT '{}'
);

CREATE TABLE metadata.tests (
    id SERIAL PRIMARY KEY,
    test_name TEXT UNIQUE NOT NULL,
    machine_id INT REFERENCES metadata.machines(id) ON DELETE CASCADE,
    test_description TEXT,
    test_notes TEXT,
    test_status TEXT DEFAULT 'idle',
    test_created_at TIMESTAMPTZ DEFAULT now(),
    test_last_modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE metadata.test_relations (
    id SERIAL PRIMARY KEY,
    test_id INT REFERENCES metadata.tests(id) ON DELETE CASCADE,
    sensor_id INT REFERENCES metadata.sensors(id) ON DELETE CASCADE,
    sensor_location TEXT,
    active BOOLEAN NOT NULL DEFAULT false,
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMP,
    UNIQUE (test_id, sensor_id)
);

CREATE TABLE metadata.test_runs (
    id SERIAL PRIMARY KEY,
    test_id INT REFERENCES metadata.tests(id) ON DELETE CASCADE,
    run_started_at TIMESTAMPTZ DEFAULT now(),
    run_ended_at TIMESTAMPTZ,
    UNIQUE(test_id, run_started_at)
);


CREATE TABLE metadata.mqtt_configs (
    id SERIAL PRIMARY KEY,
    mqtt_broker_host TEXT NOT NULL,
    mqtt_broker_port INT DEFAULT 1883,
    mqtt_username TEXT,
    mqtt_password TEXT,
    mqtt_is_active BOOLEAN DEFAULT FALSE
);

-- =====================================================
--  TIMESERIES TABLE
-- =====================================================

CREATE TABLE timeseries.measurements (
    measurement_timestamp TIMESTAMPTZ NOT NULL,
    test_relation_id INT NOT NULL REFERENCES metadata.test_relations(id) ON DELETE CASCADE,
    measurement_channel TEXT,
    measurement_value DOUBLE PRECISION NOT NULL
);

-- Turn into hypertable
-- Turn into hypertable
SELECT create_hypertable('timeseries.measurements', 'measurement_timestamp');

-- Indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_measurements_measurement_timestamp ON timeseries.measurements(measurement_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_test_relation ON timeseries.measurements(test_relation_id, measurement_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_measurement_channel ON timeseries.measurements(measurement_channel);

