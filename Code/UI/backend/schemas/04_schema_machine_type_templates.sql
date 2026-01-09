-- =====================================================
--  Machine Type Sensor Templates Schema
-- =====================================================
-- This file adds the machine_type_sensor_templates table
-- to define which sensor types should be used with each machine type,
-- including their locations and whether they are required.

CREATE TABLE IF NOT EXISTS metadata.machine_type_sensor_templates (
    id SERIAL PRIMARY KEY,
    machine_type_id INT NOT NULL REFERENCES metadata.machine_types(id) ON DELETE CASCADE,
    sensor_type_id INT NOT NULL REFERENCES metadata.sensor_types(id) ON DELETE CASCADE,
    location TEXT NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Ensure unique combination of machine_type, sensor_type, and location
    UNIQUE (machine_type_id, sensor_type_id, location)
);

-- Index for efficient queries by machine type
CREATE INDEX IF NOT EXISTS idx_machine_type_sensor_templates_machine_type_id 
    ON metadata.machine_type_sensor_templates(machine_type_id);

-- Index for efficient queries by sensor type
CREATE INDEX IF NOT EXISTS idx_machine_type_sensor_templates_sensor_type_id 
    ON metadata.machine_type_sensor_templates(sensor_type_id);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_machine_type_sensor_templates_display_order 
    ON metadata.machine_type_sensor_templates(machine_type_id, display_order);
