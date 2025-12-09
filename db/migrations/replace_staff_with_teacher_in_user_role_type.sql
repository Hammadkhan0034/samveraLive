-- ======================
-- Migration: Replace 'staff' with 'teacher' in user_role_type enum
-- ======================
-- This migration:
-- 1. Adds 'teacher' to the user_role_type enum if it doesn't exist
-- 2. Updates all users with role='staff' to role='teacher'
-- 3. Updates trigger functions to use 'teacher' instead of 'staff'
-- 4. Note: 'staff' is left in the enum for backward compatibility (PostgreSQL doesn't allow easy removal)

-- Step 1: Add 'teacher' to the enum if it doesn't exist
DO $$
BEGIN
  -- Check if 'teacher' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'teacher' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role_type')
  ) THEN
    -- Add 'teacher' to the enum
    ALTER TYPE user_role_type ADD VALUE 'teacher';
  END IF;
END $$;

-- Step 2: Update all users with role='staff' to role='teacher'
UPDATE users
SET role = 'teacher'::user_role_type
WHERE role = 'staff'::user_role_type;

-- Step 3: Update the trigger function to use 'teacher' instead of 'staff'
CREATE OR REPLACE FUNCTION update_org_teacher_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'teacher' AND NEW.deleted_at IS NULL AND NEW.is_active = true THEN
      UPDATE orgs
      SET total_teachers = total_teachers + 1
      WHERE id = NEW.org_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle role changes, active status changes, and soft deletes
    IF OLD.org_id = NEW.org_id THEN
      -- If was a teacher and now isn't (role changed, or deleted, or inactive)
      IF OLD.role = 'teacher' AND OLD.deleted_at IS NULL AND OLD.is_active = true
         AND (NEW.role != 'teacher' OR NEW.deleted_at IS NOT NULL OR NEW.is_active = false) THEN
        UPDATE orgs
        SET total_teachers = total_teachers - 1
        WHERE id = NEW.org_id;
      END IF;
      -- If wasn't a teacher and now is (role changed, or restored, or activated)
      IF (OLD.role != 'teacher' OR OLD.deleted_at IS NOT NULL OR OLD.is_active = false)
         AND NEW.role = 'teacher' AND NEW.deleted_at IS NULL AND NEW.is_active = true THEN
        UPDATE orgs
        SET total_teachers = total_teachers + 1
        WHERE id = NEW.org_id;
      END IF;
    ELSE
      -- Org changed
      IF OLD.role = 'teacher' AND OLD.deleted_at IS NULL AND OLD.is_active = true THEN
        UPDATE orgs SET total_teachers = total_teachers - 1 WHERE id = OLD.org_id;
      END IF;
      IF NEW.role = 'teacher' AND NEW.deleted_at IS NULL AND NEW.is_active = true THEN
        UPDATE orgs SET total_teachers = total_teachers + 1 WHERE id = NEW.org_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.role = 'teacher' AND OLD.deleted_at IS NULL AND OLD.is_active = true THEN
      UPDATE orgs
      SET total_teachers = total_teachers - 1
      WHERE id = OLD.org_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Update the function that calculates total_teachers (if it exists)
-- This function is used in the migration add_orgs_capacity_metrics.sql
CREATE OR REPLACE FUNCTION calculate_total_teachers(p_org_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM users u
    WHERE u.org_id = p_org_id
      AND u.role = 'teacher'
      AND u.deleted_at IS NULL
      AND u.is_active = true
  );
END;
$$ LANGUAGE plpgsql;
