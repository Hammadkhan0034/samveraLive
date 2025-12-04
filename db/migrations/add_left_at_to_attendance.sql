-- Migration: Add left_at field to attendance table
-- Adds left_at timestamptz column to track when a student left
-- Migrates existing 'gone' status records to use left_at instead

-- Add left_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' 
    AND column_name = 'left_at'
  ) THEN
    ALTER TABLE attendance ADD COLUMN left_at timestamptz NULL;
  END IF;
END $$;

-- Migrate existing 'gone' status records
-- Set left_at = updated_at for records with status = 'gone'
-- Change status back to 'arrived' (default assumption)
UPDATE attendance
SET 
  left_at = updated_at,
  status = 'arrived'
WHERE status = 'gone' AND left_at IS NULL;

-- Create index on left_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_attendance_left_at ON attendance(left_at) WHERE left_at IS NOT NULL;
