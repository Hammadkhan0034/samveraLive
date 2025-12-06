-- Migration: Update daily_logs table schema
-- This migration:
-- 1. Adds creator_name (NOT NULL) and image (optional) columns
-- 2. Adds note column if it doesn't exist
-- 3. Removes student_id column and related indexes/constraints
-- 4. Updates indexes to remove student_id references

BEGIN;

-- Step 1: Add note column if it doesn't exist (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'note'
  ) THEN
    ALTER TABLE daily_logs ADD COLUMN note text;
  END IF;
END $$;

-- Step 2: Add image column (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'image'
  ) THEN
    ALTER TABLE daily_logs ADD COLUMN image text;
  END IF;
END $$;

-- Step 3: Add creator_name column (temporarily nullable, will be populated then set to NOT NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'creator_name'
  ) THEN
    ALTER TABLE daily_logs ADD COLUMN creator_name text;
    
    -- Populate creator_name from users table for existing records
    UPDATE daily_logs dl
    SET creator_name = COALESCE(
      u.first_name || CASE WHEN u.last_name IS NOT NULL THEN ' ' || u.last_name ELSE '' END,
      'Unknown'
    )
    FROM users u
    WHERE dl.created_by = u.id
    AND dl.creator_name IS NULL;
    
    -- Set default for any remaining NULL values (shouldn't happen, but safety check)
    UPDATE daily_logs
    SET creator_name = 'Unknown'
    WHERE creator_name IS NULL;
    
    -- Now make it NOT NULL
    ALTER TABLE daily_logs ALTER COLUMN creator_name SET NOT NULL;
  END IF;
END $$;

-- Step 4: Drop indexes that reference student_id
DROP INDEX IF EXISTS idx_daily_logs_org_class_student;
DROP INDEX IF EXISTS idx_dailylogs_class_student_time;
DROP INDEX IF EXISTS idx_daily_logs_student_date;
DROP INDEX IF EXISTS idx_daily_logs_student_kind_date;
DROP INDEX IF EXISTS idx_daily_logs_student_cover;
DROP INDEX IF EXISTS idx_daily_logs_active_student;

-- Step 5: Create updated indexes without student_id
CREATE INDEX IF NOT EXISTS idx_daily_logs_org_class ON daily_logs(org_id, class_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_dailylogs_class_time ON daily_logs(class_id, recorded_at DESC);

-- Step 6: Drop foreign key constraint for student_id
ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_student_id_fkey;

-- Step 7: Drop student_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'student_id'
  ) THEN
    ALTER TABLE daily_logs DROP COLUMN student_id;
  END IF;
END $$;

-- Verification: Ensure all changes were applied
DO $$
BEGIN
  -- Check that creator_name exists and is NOT NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'creator_name'
    AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Migration failed: creator_name column not found or is nullable';
  END IF;
  
  -- Check that image column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'image'
  ) THEN
    RAISE EXCEPTION 'Migration failed: image column not found';
  END IF;
  
  -- Check that student_id column was removed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'student_id'
  ) THEN
    RAISE EXCEPTION 'Migration failed: student_id column still exists';
  END IF;
  
  -- Check that student_id foreign key constraint was removed
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'daily_logs' 
    AND constraint_name = 'daily_logs_student_id_fkey'
  ) THEN
    RAISE EXCEPTION 'Migration failed: student_id foreign key constraint still exists';
  END IF;
END $$;

COMMIT;

