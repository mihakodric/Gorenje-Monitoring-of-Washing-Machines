-- Add test_segments table for storing analysis segments
CREATE TABLE IF NOT EXISTS metadata.test_segments (
    id SERIAL PRIMARY KEY,
    test_id INT NOT NULL REFERENCES metadata.tests(id) ON DELETE CASCADE,
    segment_name TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_modified_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_test_segments_test_id ON metadata.test_segments(test_id);
CREATE INDEX IF NOT EXISTS idx_test_segments_time_range ON metadata.test_segments(start_time, end_time);

-- Add comment
COMMENT ON TABLE metadata.test_segments IS 'Stores user-defined time segments for test analysis';
