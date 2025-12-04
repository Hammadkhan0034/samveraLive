-- Migration: Add new attendance status values
-- Adds 'arrived', 'away_holiday', 'away_sick', and 'gone' to attendance_status enum
-- This extends the existing enum without breaking existing data

-- Add 'arrived' status (child has arrived)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'arrived' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'attendance_status')
  ) THEN
    ALTER TYPE attendance_status ADD VALUE 'arrived';
  END IF;
END $$;

-- Add 'away_holiday' status (child is away due to holiday)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'away_holiday' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'attendance_status')
  ) THEN
    ALTER TYPE attendance_status ADD VALUE 'away_holiday';
  END IF;
END $$;

-- Add 'away_sick' status (child is away due to illness)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'away_sick' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'attendance_status')
  ) THEN
    ALTER TYPE attendance_status ADD VALUE 'away_sick';
  END IF;
END $$;

-- Add 'gone' status (child was marked as arrived but has now left)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'gone' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'attendance_status')
  ) THEN
    ALTER TYPE attendance_status ADD VALUE 'gone';
  END IF;
END $$;
