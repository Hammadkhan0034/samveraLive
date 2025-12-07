-- Migration: Add extended fields to orgs table
-- This migration adds:
-- 1. Contact Details: email, phone, website
-- 2. Location: address, city, state, postal_code
-- 3. Auditing: created_by, updated_by (with foreign key constraints)
--
-- All new fields are optional (nullable) to maintain backward compatibility

BEGIN;

-- Step 1: Add Contact Details fields
DO $$
BEGIN
  -- Add email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE orgs ADD COLUMN email text;
  END IF;

  -- Add phone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE orgs ADD COLUMN phone text;
  END IF;

  -- Add website
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'website'
  ) THEN
    ALTER TABLE orgs ADD COLUMN website text;
  END IF;
END $$;

-- Step 2: Add Location fields
DO $$
BEGIN
  -- Add address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'address'
  ) THEN
    ALTER TABLE orgs ADD COLUMN address text;
  END IF;

  -- Add city
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'city'
  ) THEN
    ALTER TABLE orgs ADD COLUMN city text;
  END IF;

  -- Add state
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'state'
  ) THEN
    ALTER TABLE orgs ADD COLUMN state text;
  END IF;

  -- Add postal_code
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE orgs ADD COLUMN postal_code text;
  END IF;
END $$;

-- Step 3: Add Auditing fields
DO $$
BEGIN
  -- Add created_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE orgs ADD COLUMN created_by uuid;
  END IF;

  -- Add updated_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE orgs ADD COLUMN updated_by uuid;
  END IF;
END $$;

-- Step 4: Add foreign key constraints for auditing fields
-- Note: These reference auth.users(id) which is Supabase's authentication table
DO $$
BEGIN
  -- Add foreign key constraint for created_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'orgs' 
    AND constraint_name = 'orgs_created_by_fkey'
  ) THEN
    ALTER TABLE orgs 
    ADD CONSTRAINT orgs_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- Add foreign key constraint for updated_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'orgs' 
    AND constraint_name = 'orgs_updated_by_fkey'
  ) THEN
    ALTER TABLE orgs 
    ADD CONSTRAINT orgs_updated_by_fkey 
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 5: Verification - Ensure all columns were added
DO $$
BEGIN
  -- Check Contact Details
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'email'
  ) THEN
    RAISE EXCEPTION 'Migration failed: email column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'phone'
  ) THEN
    RAISE EXCEPTION 'Migration failed: phone column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'website'
  ) THEN
    RAISE EXCEPTION 'Migration failed: website column not found';
  END IF;

  -- Check Location
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'address'
  ) THEN
    RAISE EXCEPTION 'Migration failed: address column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'city'
  ) THEN
    RAISE EXCEPTION 'Migration failed: city column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'state'
  ) THEN
    RAISE EXCEPTION 'Migration failed: state column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'postal_code'
  ) THEN
    RAISE EXCEPTION 'Migration failed: postal_code column not found';
  END IF;

  -- Check Auditing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'created_by'
  ) THEN
    RAISE EXCEPTION 'Migration failed: created_by column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' 
    AND column_name = 'updated_by'
  ) THEN
    RAISE EXCEPTION 'Migration failed: updated_by column not found';
  END IF;

  -- Check Foreign Key Constraints
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'orgs' 
    AND constraint_name = 'orgs_created_by_fkey'
  ) THEN
    RAISE EXCEPTION 'Migration failed: orgs_created_by_fkey constraint not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'orgs' 
    AND constraint_name = 'orgs_updated_by_fkey'
  ) THEN
    RAISE EXCEPTION 'Migration failed: orgs_updated_by_fkey constraint not found';
  END IF;
END $$;

COMMIT;

-- Migration complete
-- All new fields have been added to the orgs table
-- The migration is idempotent and can be run multiple times safely
