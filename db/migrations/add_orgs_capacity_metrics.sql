-- Migration: Add capacity and metrics fields to orgs table
-- This migration adds:
-- 1. Organization type enum and field
-- 2. Area measurements: total_area, play_area, square_meters_per_student
-- 3. Capacity limits: maximum_allowed_students
-- 4. Calculated metrics: current_enrolled_students, total_teachers, total_guardians, total_images, total_classes
-- 5. Trigger functions and triggers to maintain calculated metrics
--
-- All new fields (except calculated metrics) are optional (nullable) to maintain backward compatibility
-- Calculated metrics are NOT NULL with DEFAULT 0

BEGIN;

-- Step 1: Create org_type enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_type') THEN
    CREATE TYPE org_type AS ENUM ('preschool', 'elementary', 'middle', 'high', 'private', 'public', 'charter', 'other');
  END IF;
END $$;

-- Step 2: Add Type and Area fields
DO $$
BEGIN
  -- Add type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE orgs ADD COLUMN type org_type;
  END IF;

  -- Add total_area
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'total_area'
  ) THEN
    ALTER TABLE orgs ADD COLUMN total_area numeric;
  END IF;

  -- Add play_area
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'play_area'
  ) THEN
    ALTER TABLE orgs ADD COLUMN play_area numeric;
  END IF;

  -- Add square_meters_per_student
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'square_meters_per_student'
  ) THEN
    ALTER TABLE orgs ADD COLUMN square_meters_per_student numeric;
  END IF;
END $$;

-- Step 3: Add Capacity Limits
DO $$
BEGIN
  -- Add maximum_allowed_students
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'maximum_allowed_students'
  ) THEN
    ALTER TABLE orgs ADD COLUMN maximum_allowed_students integer;
  END IF;
END $$;

-- Step 4: Add Calculated Metrics fields (NOT NULL with DEFAULT 0)
DO $$
BEGIN
  -- Add current_enrolled_students
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'current_enrolled_students'
  ) THEN
    ALTER TABLE orgs ADD COLUMN current_enrolled_students integer NOT NULL DEFAULT 0;
  END IF;

  -- Add total_teachers
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'total_teachers'
  ) THEN
    ALTER TABLE orgs ADD COLUMN total_teachers integer NOT NULL DEFAULT 0;
  END IF;

  -- Add total_guardians
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'total_guardians'
  ) THEN
    ALTER TABLE orgs ADD COLUMN total_guardians integer NOT NULL DEFAULT 0;
  END IF;

  -- Add total_images
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'total_images'
  ) THEN
    ALTER TABLE orgs ADD COLUMN total_images integer NOT NULL DEFAULT 0;
  END IF;

  -- Add total_classes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'total_classes'
  ) THEN
    ALTER TABLE orgs ADD COLUMN total_classes integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Step 5: Backfill calculated fields for existing orgs
DO $$
BEGIN
  -- Update current_enrolled_students (count active students)
  UPDATE orgs o
  SET current_enrolled_students = (
    SELECT COUNT(*)
    FROM students s
    WHERE s.org_id = o.id
    AND s.deleted_at IS NULL
  );

  -- Update total_teachers (count users with role = 'staff' who are active)
  UPDATE orgs o
  SET total_teachers = (
    SELECT COUNT(*)
    FROM users u
    WHERE u.org_id = o.id
    AND u.role = 'staff'
    AND u.deleted_at IS NULL
    AND u.is_active = true
  );

  -- Update total_guardians (count users with role = 'guardian' who are active)
  UPDATE orgs o
  SET total_guardians = (
    SELECT COUNT(*)
    FROM users u
    WHERE u.org_id = o.id
    AND u.role = 'guardian'
    AND u.deleted_at IS NULL
    AND u.is_active = true
  );

  -- Update total_images (count active photos)
  UPDATE orgs o
  SET total_images = (
    SELECT COUNT(*)
    FROM photos p
    WHERE p.org_id = o.id
    AND p.deleted_at IS NULL
  );

  -- Update total_classes (count active classes)
  UPDATE orgs o
  SET total_classes = (
    SELECT COUNT(*)
    FROM classes c
    WHERE c.org_id = o.id
    AND c.deleted_at IS NULL
  );
END $$;

-- Step 6: Create trigger function to update current_enrolled_students
CREATE OR REPLACE FUNCTION update_org_student_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NULL THEN
      UPDATE orgs
      SET current_enrolled_students = current_enrolled_students + 1
      WHERE id = NEW.org_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If deleted_at changed from NULL to NOT NULL (soft delete)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE orgs
      SET current_enrolled_students = current_enrolled_students - 1
      WHERE id = NEW.org_id;
    -- If deleted_at changed from NOT NULL to NULL (restore)
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE orgs
      SET current_enrolled_students = current_enrolled_students + 1
      WHERE id = NEW.org_id;
    -- If org_id changed
    ELSIF OLD.org_id != NEW.org_id THEN
      -- Decrement old org
      IF OLD.deleted_at IS NULL THEN
        UPDATE orgs
        SET current_enrolled_students = current_enrolled_students - 1
        WHERE id = OLD.org_id;
      END IF;
      -- Increment new org
      IF NEW.deleted_at IS NULL THEN
        UPDATE orgs
        SET current_enrolled_students = current_enrolled_students + 1
        WHERE id = NEW.org_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.deleted_at IS NULL THEN
      UPDATE orgs
      SET current_enrolled_students = current_enrolled_students - 1
      WHERE id = OLD.org_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger function to update total_teachers
CREATE OR REPLACE FUNCTION update_org_teacher_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'staff' AND NEW.deleted_at IS NULL AND NEW.is_active = true THEN
      UPDATE orgs
      SET total_teachers = total_teachers + 1
      WHERE id = NEW.org_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle role changes, active status changes, and soft deletes
    IF OLD.org_id = NEW.org_id THEN
      -- If was a teacher and now isn't (role changed, or deleted, or inactive)
      IF OLD.role = 'staff' AND OLD.deleted_at IS NULL AND OLD.is_active = true
         AND (NEW.role != 'staff' OR NEW.deleted_at IS NOT NULL OR NEW.is_active = false) THEN
        UPDATE orgs
        SET total_teachers = total_teachers - 1
        WHERE id = NEW.org_id;
      END IF;
      -- If wasn't a teacher and now is (role changed, or restored, or activated)
      IF (OLD.role != 'staff' OR OLD.deleted_at IS NOT NULL OR OLD.is_active = false)
         AND NEW.role = 'staff' AND NEW.deleted_at IS NULL AND NEW.is_active = true THEN
        UPDATE orgs
        SET total_teachers = total_teachers + 1
        WHERE id = NEW.org_id;
      END IF;
    ELSE
      -- Org changed
      IF OLD.role = 'staff' AND OLD.deleted_at IS NULL AND OLD.is_active = true THEN
        UPDATE orgs SET total_teachers = total_teachers - 1 WHERE id = OLD.org_id;
      END IF;
      IF NEW.role = 'staff' AND NEW.deleted_at IS NULL AND NEW.is_active = true THEN
        UPDATE orgs SET total_teachers = total_teachers + 1 WHERE id = NEW.org_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.role = 'staff' AND OLD.deleted_at IS NULL AND OLD.is_active = true THEN
      UPDATE orgs
      SET total_teachers = total_teachers - 1
      WHERE id = OLD.org_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger function to update total_guardians
CREATE OR REPLACE FUNCTION update_org_guardian_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'guardian' AND NEW.deleted_at IS NULL AND NEW.is_active = true THEN
      UPDATE orgs
      SET total_guardians = total_guardians + 1
      WHERE id = NEW.org_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle role changes, active status changes, and soft deletes
    IF OLD.org_id = NEW.org_id THEN
      -- If was a guardian and now isn't
      IF OLD.role = 'guardian' AND OLD.deleted_at IS NULL AND OLD.is_active = true
         AND (NEW.role != 'guardian' OR NEW.deleted_at IS NOT NULL OR NEW.is_active = false) THEN
        UPDATE orgs
        SET total_guardians = total_guardians - 1
        WHERE id = NEW.org_id;
      END IF;
      -- If wasn't a guardian and now is
      IF (OLD.role != 'guardian' OR OLD.deleted_at IS NOT NULL OR OLD.is_active = false)
         AND NEW.role = 'guardian' AND NEW.deleted_at IS NULL AND NEW.is_active = true THEN
        UPDATE orgs
        SET total_guardians = total_guardians + 1
        WHERE id = NEW.org_id;
      END IF;
    ELSE
      -- Org changed
      IF OLD.role = 'guardian' AND OLD.deleted_at IS NULL AND OLD.is_active = true THEN
        UPDATE orgs SET total_guardians = total_guardians - 1 WHERE id = OLD.org_id;
      END IF;
      IF NEW.role = 'guardian' AND NEW.deleted_at IS NULL AND NEW.is_active = true THEN
        UPDATE orgs SET total_guardians = total_guardians + 1 WHERE id = NEW.org_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.role = 'guardian' AND OLD.deleted_at IS NULL AND OLD.is_active = true THEN
      UPDATE orgs
      SET total_guardians = total_guardians - 1
      WHERE id = OLD.org_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create trigger function to update total_images
CREATE OR REPLACE FUNCTION update_org_image_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NULL THEN
      UPDATE orgs
      SET total_images = total_images + 1
      WHERE id = NEW.org_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If deleted_at changed from NULL to NOT NULL (soft delete)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE orgs
      SET total_images = total_images - 1
      WHERE id = NEW.org_id;
    -- If deleted_at changed from NOT NULL to NULL (restore)
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE orgs
      SET total_images = total_images + 1
      WHERE id = NEW.org_id;
    -- If org_id changed
    ELSIF OLD.org_id != NEW.org_id THEN
      -- Decrement old org
      IF OLD.deleted_at IS NULL THEN
        UPDATE orgs
        SET total_images = total_images - 1
        WHERE id = OLD.org_id;
      END IF;
      -- Increment new org
      IF NEW.deleted_at IS NULL THEN
        UPDATE orgs
        SET total_images = total_images + 1
        WHERE id = NEW.org_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.deleted_at IS NULL THEN
      UPDATE orgs
      SET total_images = total_images - 1
      WHERE id = OLD.org_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create trigger function to update total_classes
CREATE OR REPLACE FUNCTION update_org_class_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NULL THEN
      UPDATE orgs
      SET total_classes = total_classes + 1
      WHERE id = NEW.org_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If deleted_at changed from NULL to NOT NULL (soft delete)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE orgs
      SET total_classes = total_classes - 1
      WHERE id = NEW.org_id;
    -- If deleted_at changed from NOT NULL to NULL (restore)
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE orgs
      SET total_classes = total_classes + 1
      WHERE id = NEW.org_id;
    -- If org_id changed
    ELSIF OLD.org_id != NEW.org_id THEN
      -- Decrement old org
      IF OLD.deleted_at IS NULL THEN
        UPDATE orgs
        SET total_classes = total_classes - 1
        WHERE id = OLD.org_id;
      END IF;
      -- Increment new org
      IF NEW.deleted_at IS NULL THEN
        UPDATE orgs
        SET total_classes = total_classes + 1
        WHERE id = NEW.org_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.deleted_at IS NULL THEN
      UPDATE orgs
      SET total_classes = total_classes - 1
      WHERE id = OLD.org_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create triggers for students table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_update_org_student_count' AND c.relname = 'students'
  ) THEN
    CREATE TRIGGER trg_update_org_student_count
    AFTER INSERT OR UPDATE OR DELETE ON students
    FOR EACH ROW EXECUTE FUNCTION update_org_student_count();
  END IF;
END $$;

-- Step 12: Create triggers for users table (teachers and guardians)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_update_org_teacher_count' AND c.relname = 'users'
  ) THEN
    CREATE TRIGGER trg_update_org_teacher_count
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION update_org_teacher_count();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_update_org_guardian_count' AND c.relname = 'users'
  ) THEN
    CREATE TRIGGER trg_update_org_guardian_count
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION update_org_guardian_count();
  END IF;
END $$;

-- Step 13: Create triggers for photos table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_update_org_image_count' AND c.relname = 'photos'
  ) THEN
    CREATE TRIGGER trg_update_org_image_count
    AFTER INSERT OR UPDATE OR DELETE ON photos
    FOR EACH ROW EXECUTE FUNCTION update_org_image_count();
  END IF;
END $$;

-- Step 14: Create triggers for classes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_update_org_class_count' AND c.relname = 'classes'
  ) THEN
    CREATE TRIGGER trg_update_org_class_count
    AFTER INSERT OR UPDATE OR DELETE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_org_class_count();
  END IF;
END $$;

-- Step 15: Verification - Ensure all columns were added
DO $$
BEGIN
  -- Check enum type
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_type') THEN
    RAISE EXCEPTION 'Migration failed: org_type enum not found';
  END IF;

  -- Check Type and Area fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'type'
  ) THEN
    RAISE EXCEPTION 'Migration failed: type column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'total_area'
  ) THEN
    RAISE EXCEPTION 'Migration failed: total_area column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'play_area'
  ) THEN
    RAISE EXCEPTION 'Migration failed: play_area column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'square_meters_per_student'
  ) THEN
    RAISE EXCEPTION 'Migration failed: square_meters_per_student column not found';
  END IF;

  -- Check Capacity Limits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'maximum_allowed_students'
  ) THEN
    RAISE EXCEPTION 'Migration failed: maximum_allowed_students column not found';
  END IF;

  -- Check Calculated Metrics
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'current_enrolled_students'
  ) THEN
    RAISE EXCEPTION 'Migration failed: current_enrolled_students column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'total_teachers'
  ) THEN
    RAISE EXCEPTION 'Migration failed: total_teachers column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'total_guardians'
  ) THEN
    RAISE EXCEPTION 'Migration failed: total_guardians column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'total_images'
  ) THEN
    RAISE EXCEPTION 'Migration failed: total_images column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'total_classes'
  ) THEN
    RAISE EXCEPTION 'Migration failed: total_classes column not found';
  END IF;

  -- Check trigger functions exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_org_student_count'
  ) THEN
    RAISE EXCEPTION 'Migration failed: update_org_student_count function not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_org_teacher_count'
  ) THEN
    RAISE EXCEPTION 'Migration failed: update_org_teacher_count function not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_org_guardian_count'
  ) THEN
    RAISE EXCEPTION 'Migration failed: update_org_guardian_count function not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_org_image_count'
  ) THEN
    RAISE EXCEPTION 'Migration failed: update_org_image_count function not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_org_class_count'
  ) THEN
    RAISE EXCEPTION 'Migration failed: update_org_class_count function not found';
  END IF;
END $$;

COMMIT;

-- Migration complete
-- All new fields have been added to the orgs table
-- Trigger functions and triggers have been created to maintain calculated metrics
-- The migration is idempotent and can be run multiple times safely
