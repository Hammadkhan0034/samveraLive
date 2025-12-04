-- Migration: Remove 'present' from attendance_status enum
-- This migration removes 'present' from the attendance_status enum while keeping 'absent'
-- Existing 'present' records will be converted to 'arrived'

BEGIN;

-- Step 1: Update existing records - convert 'present' to 'arrived'
UPDATE attendance
SET status = 'arrived'
WHERE status = 'present';

-- Step 2: Create a new enum type without 'present'
CREATE TYPE attendance_status_new AS ENUM ('absent', 'late', 'excused', 'arrived', 'away_holiday', 'away_sick', 'gone');

-- Step 3: Alter the attendance table to use the new enum type
-- First, we need to change the column type temporarily to text
ALTER TABLE attendance
  ALTER COLUMN status TYPE text USING status::text;

-- Step 4: Drop the old enum type (this will fail if it's still referenced, so we change to text first)
DROP TYPE IF EXISTS attendance_status;

-- Step 5: Rename the new enum to the original name
ALTER TYPE attendance_status_new RENAME TO attendance_status;

-- Step 6: Change the column back to use the enum type
ALTER TABLE attendance
  ALTER COLUMN status TYPE attendance_status USING status::attendance_status;

-- Step 7: Update the default constraint from 'present' to 'arrived'
ALTER TABLE attendance
  ALTER COLUMN status SET DEFAULT 'arrived';

-- Verify the change
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'attendance_status'
    AND EXISTS (
      SELECT 1 FROM unnest(enum_range(NULL::attendance_status)) AS enum_value
      WHERE enum_value::text = 'present'
    )
  ) THEN
    RAISE EXCEPTION 'Migration failed: ''present'' still exists in attendance_status enum';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'attendance_status'
    AND EXISTS (
      SELECT 1 FROM unnest(enum_range(NULL::attendance_status)) AS enum_value
      WHERE enum_value::text = 'absent'
    )
  ) THEN
    RAISE EXCEPTION 'Migration failed: ''absent'' missing from attendance_status enum';
  END IF;
END $$;

COMMIT;
