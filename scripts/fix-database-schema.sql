-- Fix database schema to add missing columns
-- This script adds the missing columns that the application expects

-- Add deleted_at column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add deleted_at column to classes table  
ALTER TABLE classes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add deleted_at column to children table
ALTER TABLE children ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add deleted_at column to invitations table
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add created_by column to classes table (referenced in API)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_classes_deleted_at ON classes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_children_deleted_at ON children(deleted_at);
CREATE INDEX IF NOT EXISTS idx_invitations_deleted_at ON invitations(deleted_at);

-- Add some missing columns that might be needed
ALTER TABLE children ADD COLUMN IF NOT EXISTS medical_notes_encrypted text;
ALTER TABLE children ADD COLUMN IF NOT EXISTS allergies_encrypted text;
ALTER TABLE children ADD COLUMN IF NOT EXISTS emergency_contact_encrypted text;

-- Update the roles table to include principal role
INSERT INTO roles (id, name) VALUES
  (4, 'principal')
ON CONFLICT (id) DO NOTHING;

-- Add principal role if it doesn't exist
INSERT INTO roles (id, name) VALUES
  (5, 'teacher')
ON CONFLICT (id) DO NOTHING;

-- Create a profiles view for compatibility (if needed)
CREATE OR REPLACE VIEW profiles AS
SELECT 
  id,
  email,
  phone,
  full_name,
  org_id,
  role_id,
  metadata,
  is_active,
  created_at,
  updated_at,
  deleted_at
FROM users;

-- Grant permissions on the view
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;
