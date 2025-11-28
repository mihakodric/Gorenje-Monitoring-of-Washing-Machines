-- 02_continuous_agg.sql
COMMIT;  -- ensure hypertable changes are visible

CREATE MATERIALIZED VIEW IF NOT EXISTS timeseries.measurements_avg_10s
WITH (timescaledb.continuous) AS
SELECT
    time_bucket(INTERVAL '10 seconds', measurement_timestamp) AS bucket,
    test_relation_id,
    measurement_channel,
    AVG(measurement_value) AS avg_value,
    MIN(measurement_value) AS min_value,
    MAX(measurement_value) AS max_value,
    AVG(ABS(measurement_value)) AS avg_abs_value,
    MIN(ABS(measurement_value)) AS min_abs_value,
    MAX(ABS(measurement_value)) AS max_abs_value,
    COUNT(*) AS num_samples
FROM timeseries.measurements
GROUP BY bucket, test_relation_id, measurement_channel
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_measurements_avg_10s_time
  ON timeseries.measurements_avg_10s (test_relation_id, bucket DESC);

CREATE INDEX IF NOT EXISTS idx_measurements_avg_10s_channel_relation
  ON timeseries.measurements_avg_10s (measurement_channel, test_relation_id, bucket DESC);

SELECT add_continuous_aggregate_policy(
    'timeseries.measurements_avg_10s',
    start_offset => INTERVAL '2 minutes',
    end_offset => INTERVAL '10 seconds',
    schedule_interval => INTERVAL '10 seconds'
);
