    -- do $$ declare r record;begin for r in (select tablename from pg_tables where schemaname = 'public') loop execute 'drop table if exists ' || quote_ident(r.tablename) || ' cascade'; end loop;end $$;




-- ======================
-- EXTENSIONS
-- ======================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "citext";



-- ======================
-- ENUMS / TYPES
-- ======================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_thread_type') THEN
    CREATE TYPE message_thread_type AS ENUM ('dm','class','announcement');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_visibility') THEN
    CREATE TYPE upload_visibility AS ENUM ('private','public','preview');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_role_type') THEN
    CREATE TYPE membership_role_type AS ENUM ('teacher','teacher_assistant','observer','student_helper');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'daily_log_kind') THEN
    CREATE TYPE daily_log_kind AS ENUM ('arrival','meal','sleep','activity','note');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
    CREATE TYPE gender_type AS ENUM ('male','female','other','unknown');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grade_scale') THEN
    CREATE TYPE grade_scale AS ENUM ('A','B','C','D','F','P','NP');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM ('absent','late','excused','arrived','away_holiday','away_sick','gone');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_type') THEN
    CREATE TYPE user_role_type AS ENUM ('principal','staff','guardian','student');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role_type') THEN
    CREATE TYPE staff_role_type AS ENUM (
      'principal',
      'assistant_principal',
      'teacher',
      'school_secretary',
      'finance_officer',
      'hr_officer',
      'it_coordinator',
      'maintenance_staff',
      'cafeteria_staff',
      'school_counselor',
      'school_psychologist',
      'school_nurse',
      'after_school_coordinator',
      'school_board_representative'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_request_status') THEN
    CREATE TYPE student_request_status AS ENUM ('pending','approved','rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_status_type') THEN
    CREATE TYPE staff_status_type AS ENUM ('active', 'inactive', 'holiday', 'sick_leave', 'maternity_leave', 'casual_leave');
  END IF;
END $$;

-- ======================
-- CORE TABLES
-- ======================

-- ROLES (global) removed in favor of enum user_role_type

-- ORGS
CREATE TABLE IF NOT EXISTS orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true
);

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  email citext, -- Case-insensitive email storage
  phone text, -- Phone numbers should be unique per org
  ssn text,
  address text,
  canLogin boolean NOT NULL DEFAULT true,
  first_name text NOT NULL,
  last_name text,  
  role user_role_type,
  bio text,
  avatar_url text,
  gender gender_type DEFAULT 'unknown',
  last_login_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  is_staff boolean NOT NULL DEFAULT true,
  status staff_status_type DEFAULT 'active',
  dob date,
  theme text DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  language text DEFAULT 'is' CHECK (language IN ('en','is')),
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);




-- STAFF
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  education_level text,
  union_name text,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- STAFF STATUS HISTORY
CREATE TABLE IF NOT EXISTS staff_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  status staff_status_type NOT NULL ,
  reason text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  changed_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS idx_staff_status_history_staff_id ON staff_status_history(staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_status_history_org_id ON staff_status_history(org_id);

-- Email format validation (works with citext)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_email_format') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_email_format 
    CHECK (email IS NULL OR email ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$');
  END IF;
END $$;

-- Phone number format validation (supports international formats)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_phone_format') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_phone_format 
    CHECK (phone IS NULL OR (phone ~* '^\+?[1-9]\d{1,14}$' AND LENGTH(phone) BETWEEN 7 AND 15));
  END IF;
END $$;

-- CHANGE: Broaden email domain constraint to accept any valid TLD (case-insensitive)
DO $$
BEGIN
  -- Drop old constraint if it exists (to replace with broadened regex)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_email_domain') THEN
    ALTER TABLE users DROP CONSTRAINT chk_users_email_domain;
  END IF;
  -- Recreate with case-insensitive match and general TLD
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_email_domain') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_email_domain 
    CHECK (email IS NULL OR email ~* '@[a-z0-9.-]+\.[a-z]{2,}$');
  END IF;
END $$;

-- CHANGE: Business rule moved to application layer; drop legacy constraint if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_guardian_not_student') THEN
    ALTER TABLE users DROP CONSTRAINT chk_guardian_not_student;
  END IF;
END $$;
-- TODO: Enforce guardian/student role rules in application logic instead of DB constraint

-- CLASSES
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text, -- Class codes should be unique per org
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CLASS_MEMBERSHIPS
CREATE TABLE IF NOT EXISTS class_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_role membership_role_type NOT NULL DEFAULT 'teacher',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);

-- STUDENTS
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL, -- Link to student user account
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL, -- Allow reassignment
 
  
  registration_time timestamptz,
  start_date date,
  student_language text,
  barngildi numeric NOT NULL DEFAULT 1.0,
  -- Encrypted sensitive fields
  medical_notes_encrypted text, -- Encrypted medical information
  allergies_encrypted text, -- Encrypted allergy information
  emergency_contact_encrypted text, -- Encrypted emergency contact info
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id) -- One student record per user
);

-- STUDENT_RELATIVES: Contact-only relatives for a student
CREATE TABLE IF NOT EXISTS student_relatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relation text, -- e.g., aunt, uncle, neighbor
  phone text,
  email citext,
  notes text,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);



-- STUDENT_REQUESTS
CREATE TABLE IF NOT EXISTS student_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  dob date,
  gender gender_type NOT NULL DEFAULT 'unknown',
  medical_notes text,
  allergies text,
  emergency_contact text,
  status student_request_status NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  rejected_by uuid REFERENCES users(id),
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_requests_org ON student_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_student_requests_org_status ON student_requests(org_id, status);

-- CHANGE: Replace static age CHECK with trigger-based validation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_students_age_range') THEN
    ALTER TABLE students DROP CONSTRAINT chk_students_age_range;
  END IF;
END $$;

-- CHANGE: Trigger function to validate student DOB within 18 years on insert/update
CREATE OR REPLACE FUNCTION validate_student_age()
RETURNS TRIGGER AS $$
DECLARE
  user_dob date;
BEGIN
  -- Validate age using DOB stored on the linked user, if present
  IF NEW.user_id IS NOT NULL THEN
    SELECT dob INTO user_dob FROM users WHERE id = NEW.user_id;
    IF user_dob IS NOT NULL THEN
      IF user_dob > CURRENT_DATE OR user_dob < (CURRENT_DATE - INTERVAL '18 years') OR user_dob > (CURRENT_DATE - INTERVAL '3 years') THEN
        RAISE EXCEPTION 'Invalid DOB on linked user: must be between 3 and 18 years old and not in the future';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Validate DOB on users directly (DOB moved to users)
CREATE OR REPLACE FUNCTION validate_user_dob()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.dob IS NOT NULL THEN
    IF NEW.dob > CURRENT_DATE OR NEW.dob < (CURRENT_DATE - INTERVAL '18 years') OR NEW.dob > (CURRENT_DATE - INTERVAL '3 years') THEN
      RAISE EXCEPTION 'Invalid DOB: must be between 3 and 18 years old and not in the future';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_validate_student_age' AND c.relname = 'students'
  ) THEN
    CREATE TRIGGER trg_validate_student_age
    BEFORE INSERT OR UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION validate_student_age();
  END IF;
  
  -- Also validate DOB directly on users when it changes
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_validate_user_dob' AND c.relname = 'users'
  ) THEN
    CREATE TRIGGER trg_validate_user_dob
    BEFORE INSERT OR UPDATE OF dob ON users
    FOR EACH ROW EXECUTE FUNCTION validate_user_dob();
  END IF;
END $$;

-- Ensure only student users can be linked to student records
DO $$
BEGIN
  -- Note: Role validation for students is handled at the application level
  -- since PostgreSQL doesn't allow subqueries in CHECK constraints
END $$;

-- GUARDIAN_STUDENTS
CREATE TABLE IF NOT EXISTS guardian_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guardian_id, student_id)
);

-- UPLOADS
CREATE TABLE IF NOT EXISTS uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  path text NOT NULL,
  filename text,
  mime_type text,
  size_bytes bigint,
  width int,
  height int,
  checksum text,
  visibility upload_visibility NOT NULL DEFAULT 'private',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uploads_visibility ON uploads(visibility);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_uploads_size_nonnegative') THEN
    ALTER TABLE uploads ADD CONSTRAINT chk_uploads_size_nonnegative CHECK (size_bytes IS NULL OR size_bytes >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_uploads_dims_nonnegative') THEN
    ALTER TABLE uploads ADD CONSTRAINT chk_uploads_dims_nonnegative CHECK ((width IS NULL OR width >= 0) AND (height IS NULL OR height >= 0));
  END IF;
END $$;


-- STORIES
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text,
  caption text,
  is_public boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stories_class_expires ON stories(class_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_created ON stories(created_at DESC);

-- STORY_ITEMS
CREATE TABLE IF NOT EXISTS story_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  upload_id uuid REFERENCES uploads(id) ON DELETE SET NULL,
  order_index int NOT NULL DEFAULT 0,
  duration_ms int,
  caption text,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  url text,
  UNIQUE (story_id, order_index)
);
CREATE INDEX IF NOT EXISTS idx_story_items_story_order ON story_items(story_id, order_index);

-- PHOTOS
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  caption text,
  is_public boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- MENUS
CREATE TABLE IF NOT EXISTS menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  day date NOT NULL,
  breakfast text,
  lunch text,
  snack text,
  notes text,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_menus_created_by ON menus(created_by);
CREATE INDEX IF NOT EXISTS idx_menus_day ON menus(day);
CREATE UNIQUE INDEX IF NOT EXISTS uq_menus_org_day_null_class ON menus(org_id, day) WHERE class_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_menus_org_class_day ON menus(org_id, class_id, day) WHERE class_id IS NOT NULL;

-- DAILY_LOGS
CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  kind daily_log_kind NOT NULL DEFAULT 'note',
  value text,
  rating smallint,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  creator_name text NOT NULL,
  image text,
  public boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  note text
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_daily_logs_rating_range') THEN
    ALTER TABLE daily_logs ADD CONSTRAINT chk_daily_logs_rating_range CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));
  END IF;
END $$;

-- HEALTH_LOGS
CREATE TABLE IF NOT EXISTS health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  temperature_celsius numeric,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  severity smallint,
  recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CHECK (temperature_celsius IS NULL OR (temperature_celsius >= 30 AND temperature_celsius <= 45)),
  CHECK (severity IS NULL OR (severity BETWEEN 1 AND 5))
);

-- ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  week_start date,
  is_public boolean NOT NULL DEFAULT true,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_week ON announcements(week_start DESC);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  thread_type message_thread_type NOT NULL DEFAULT 'dm',
  subject text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- MESSAGE_PARTICIPANTS
CREATE TABLE IF NOT EXISTS message_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text,
  unread boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

-- MESSAGE_ITEMS
CREATE TABLE IF NOT EXISTS message_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  edit_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_items_message_time ON message_items(message_id, created_at DESC);

-- EVENTS
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  location text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_time_range') THEN
    ALTER TABLE events ADD CONSTRAINT chk_events_time_range CHECK (end_at IS NULL OR end_at >= start_at);
  END IF;
END $$;

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz NULL,
  priority text NOT NULL DEFAULT 'normal',
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
-- Removed - covered by idx_notifications_user_type_created
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- DEVICE_TOKENS
CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  UNIQUE (user_id, provider, token)
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

-- INVITATIONS
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email citext NOT NULL, -- Case-insensitive email storage
  role user_role_type,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  date date NOT NULL,
  status attendance_status NOT NULL DEFAULT 'arrived',
  notes text,
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  left_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_left_at ON attendance(left_at) WHERE left_at IS NOT NULL;

-- ASSESSMENTS/GRADES
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  subject text,
  grade grade_scale,
  score numeric(5,2),
  max_score numeric(5,2),
  assessed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assessments_class ON assessments(class_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_subject ON assessments(subject);

-- Score validation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assessments_score_range') THEN
    ALTER TABLE assessments ADD CONSTRAINT chk_assessments_score_range 
    CHECK (score IS NULL OR (score >= 0 AND score <= max_score));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assessments_max_score_positive') THEN
    ALTER TABLE assessments ADD CONSTRAINT chk_assessments_max_score_positive 
    CHECK (max_score IS NULL OR max_score > 0);
  END IF;
END $$;

-- AUDIT_LOG
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  object_type text,
  object_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at DESC);

-- ======================
-- ENHANCED AUDIT TRAIL
-- ======================

-- Change tracking table for detailed audit trail
CREATE TABLE IF NOT EXISTS audit_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  operation text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  session_id text
);

-- Indexes for audit_changes
CREATE INDEX IF NOT EXISTS idx_audit_changes_table_record ON audit_changes(table_name, record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_changes_user ON audit_changes(changed_by, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_changes_operation ON audit_changes(operation, changed_at DESC);

-- CHANGE: Add legacy-style monthly partitioning via inheritance and routing trigger
-- NOTE: For existing deployments, this approach avoids a hard conversion to declarative partitioning.
-- Partitions are created on demand using helper function below.

-- CHANGE: Helper to create the next N months of partitions for audit_changes
CREATE OR REPLACE FUNCTION create_audit_changes_partitions(months_ahead integer)
RETURNS void AS $$
DECLARE
  i integer := 0;
  start_month date;
  part_name text;
  start_ts timestamptz;
  end_ts timestamptz;
BEGIN
  IF months_ahead IS NULL OR months_ahead < 0 THEN
    RAISE EXCEPTION 'months_ahead must be non-negative';
  END IF;
  WHILE i <= months_ahead LOOP
    start_month := date_trunc('month', CURRENT_DATE) + (i || ' months')::interval;
    part_name := format('audit_changes_%s', to_char(start_month, 'YYYY_MM'));
    start_ts := start_month::timestamptz;
    end_ts := (start_month + interval '1 month')::timestamptz;
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I (
         CHECK (changed_at >= %L AND changed_at < %L)
       ) INHERITS (audit_changes);',
      part_name, start_ts, end_ts
    );
    -- Ensure common indexes exist on each partition
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(table_name, record_id, changed_at DESC);',
                   'idx_'||part_name||'_table_record', part_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(changed_by, changed_at DESC);',
                   'idx_'||part_name||'_user', part_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(operation, changed_at DESC);',
                   'idx_'||part_name||'_operation', part_name);
    i := i + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- CHANGE: Routing trigger to insert rows into the correct monthly partition
CREATE OR REPLACE FUNCTION route_audit_changes_insert()
RETURNS TRIGGER AS $$
DECLARE
  part_name text;
  start_month date;
BEGIN
  start_month := date_trunc('month', COALESCE(NEW.changed_at, now()))::date;
  part_name := format('audit_changes_%s', to_char(start_month, 'YYYY_MM'));
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I (
                    CHECK (changed_at >= %L AND changed_at < %L)
                  ) INHERITS (audit_changes);',
                  part_name,
                  start_month::timestamptz,
                  (start_month + interval '1 month')::timestamptz);
  EXECUTE format('INSERT INTO %I (id, org_id, table_name, record_id, operation, old_values, new_values, changed_by, changed_at, ip_address, user_agent, session_id)
                  VALUES ($1.id, $1.org_id, $1.table_name, $1.record_id, $1.operation, $1.old_values, $1.new_values, $1.changed_by, $1.changed_at, $1.ip_address, $1.user_agent, $1.session_id);', part_name)
  USING NEW;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_route_audit_changes_insert' AND c.relname = 'audit_changes'
  ) THEN
    CREATE TRIGGER trg_route_audit_changes_insert
    BEFORE INSERT ON audit_changes
    FOR EACH ROW EXECUTE FUNCTION route_audit_changes_insert();
  END IF;
END $$;

-- TODO: For housekeeping, create scheduled jobs to call create_audit_changes_partitions(N)
-- and optionally drop old partitions beyond retention.

-- ======================
-- AUDIT TRACKING REMOVED
-- ======================
-- Audit tracking function has been removed.

-- Schema versioning table
CREATE TABLE IF NOT EXISTS schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  description text,
  checksum text,
  rollback_sql text
);

-- Insert current schema version
INSERT INTO schema_versions (version, description) 
VALUES ('1.0.0', 'Initial schema with enhanced security and performance optimizations')
ON CONFLICT (version) DO NOTHING;



-- ======================
-- INDEXES / PERFORMANCE HELPERS
-- ======================

-- Multi-tenant unique constraints (org-scoped)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_email ON users(org_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_phone ON users(org_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_ssn ON users(org_id, ssn) WHERE ssn IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_classes_org_name ON classes(org_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_classes_org_code ON classes(org_id, code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_uploads_org_bucket_path ON uploads(org_id, bucket, path);


-- ======================
-- MULTI-TENANT INDEXES (org_id)
-- ======================
-- Core org_id indexes for tenant isolation
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);

CREATE INDEX IF NOT EXISTS idx_classes_org_id ON classes(org_id);
CREATE INDEX IF NOT EXISTS idx_class_memberships_org_id ON class_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_students_org_id ON students(org_id);
CREATE INDEX IF NOT EXISTS idx_guardian_students_org_id ON guardian_students(org_id);
CREATE INDEX IF NOT EXISTS idx_uploads_org_id ON uploads(org_id);
CREATE INDEX IF NOT EXISTS idx_stories_org_id ON stories(org_id);
CREATE INDEX IF NOT EXISTS idx_story_items_org_id ON story_items(org_id);
CREATE INDEX IF NOT EXISTS idx_photos_org_id ON photos(org_id);
CREATE INDEX IF NOT EXISTS idx_menus_org_id ON menus(org_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_org_id ON daily_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_org_id ON health_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_announcements_org_id ON announcements(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_id ON messages(org_id);
CREATE INDEX IF NOT EXISTS idx_message_participants_org_id ON message_participants(org_id);
CREATE INDEX IF NOT EXISTS idx_message_items_org_id ON message_items(org_id);
CREATE INDEX IF NOT EXISTS idx_events_org_id ON events(org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_org_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org_id ON attendance(org_id);
CREATE INDEX IF NOT EXISTS idx_assessments_org_id ON assessments(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_changes_org_id ON audit_changes(org_id);

-- Composite indexes with org_id for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_users_org_active ON users(org_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_org_role ON users(org_id, role);
CREATE INDEX IF NOT EXISTS idx_classes_org_created ON classes(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_org_class ON students(org_id, class_id);
CREATE INDEX IF NOT EXISTS idx_students_org_user ON students(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_photos_org_class_student ON photos(org_id, class_id, student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_org_class ON daily_logs(org_id, class_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_org_class_date ON attendance(org_id, class_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_org_class ON assessments(org_id, class_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_org_class_expires ON stories(org_id, class_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_org_class ON announcements(org_id, class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_org_class_start ON events(org_id, class_id, start_at);
CREATE INDEX IF NOT EXISTS idx_notifications_org_user ON notifications(org_id, user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org_thread ON messages(org_id, thread_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_memberships_org_class ON class_memberships(org_id, class_id);
CREATE INDEX IF NOT EXISTS idx_class_memberships_org_user ON class_memberships(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_guardian_students_org_guardian ON guardian_students(org_id, guardian_id);
CREATE INDEX IF NOT EXISTS idx_guardian_students_org_student ON guardian_students(org_id, student_id);

CREATE INDEX IF NOT EXISTS idx_photos_class_student_created ON photos(class_id, student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dailylogs_class_time ON daily_logs(class_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_photos_public_created ON photos(is_public, created_at DESC) WHERE is_public = true;
-- Removed - covered by idx_messages_thread_created
CREATE INDEX IF NOT EXISTS idx_events_class_start ON events(class_id, start_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON notifications(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_class_public ON stories(class_id, is_public, created_at DESC) WHERE is_public = true;
-- CHANGE: Redundant with active-only index; prefer idx_announcements_active_public
-- CREATE INDEX IF NOT EXISTS idx_announcements_class_public ON announcements(class_id, is_public, created_at DESC) WHERE is_public = true;

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance(date, status);
CREATE INDEX IF NOT EXISTS idx_assessments_grade ON assessments(grade) WHERE grade IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessments_score_range ON assessments(score, max_score) WHERE score IS NOT NULL;

-- Additional performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_active_role ON users(is_active, role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_classes_code ON classes(code) WHERE code IS NOT NULL;
-- Full-text search index (commented out due to immutable function requirement)
-- CREATE INDEX IF NOT EXISTS idx_students_name_search ON students USING gin(to_tsvector('english', first_name || ' ' || COALESCE(last_name, '')));
CREATE INDEX IF NOT EXISTS idx_uploads_created_by ON uploads(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_author ON announcements(author_id, created_at DESC);
-- CHANGE: Redundant with active-only index; prefer idx_messages_active_thread
-- CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON messages(thread_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location) WHERE location IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_expires ON invitations(expires_at) WHERE expires_at IS NOT NULL;
-- Removed - covered by idx_audit_changes_user and idx_audit_changes_table_record

-- Indexes for staff
CREATE INDEX IF NOT EXISTS idx_staff_org_id ON staff(org_id);
-- Indexes for student_relatives
CREATE INDEX IF NOT EXISTS idx_student_relatives_org_id ON student_relatives(org_id);
CREATE INDEX IF NOT EXISTS idx_student_relatives_student_id ON student_relatives(student_id);
CREATE INDEX IF NOT EXISTS idx_student_relatives_created ON student_relatives(created_at DESC);

-- ======================
-- CRITICAL PERFORMANCE INDEXES
-- ======================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_students_class_user ON students(class_id, user_id);
CREATE INDEX IF NOT EXISTS idx_photos_student_public ON photos(student_id, is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_student_status ON attendance(student_id, status, date);
CREATE INDEX IF NOT EXISTS idx_assessments_student_subject ON assessments(student_id, subject, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_participant_created ON message_participants(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created ON notifications(user_id, type, created_at DESC);

-- Partial indexes for active records only
CREATE INDEX IF NOT EXISTS idx_users_active ON users(id) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_active ON students(id) WHERE deleted_at IS NULL;
-- Removed - covered by idx_photos_student_public
CREATE INDEX IF NOT EXISTS idx_stories_active ON stories(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_classes_active ON classes(id) WHERE deleted_at IS NULL;

-- Covering indexes for common SELECT patterns
CREATE INDEX IF NOT EXISTS idx_photos_student_cover ON photos(student_id, created_at DESC) INCLUDE (caption, is_public);
CREATE INDEX IF NOT EXISTS idx_attendance_student_cover ON attendance(student_id, date DESC) INCLUDE (status, notes);

-- Additional performance indexes for analytics

-- Email-specific indexes for case-insensitive lookups (org-scoped)
CREATE INDEX IF NOT EXISTS idx_users_org_email_lookup ON users(org_id, email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_org_email_lookup ON invitations(org_id, email) WHERE email IS NOT NULL AND deleted_at IS NULL;

-- ======================
-- PARTIAL INDEXES FOR SOFT DELETES
-- ======================

-- Users partial indexes (active records only)
CREATE INDEX IF NOT EXISTS idx_users_active_org_email ON users(org_id, email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_active_created ON users(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_active_org_phone ON users(org_id, phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;

-- Classes partial indexes (active records only)
-- Removed - rarely used for lookups
CREATE INDEX IF NOT EXISTS idx_classes_active_org_code ON classes(org_id, code) WHERE code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_classes_active_created ON classes(created_at DESC) WHERE deleted_at IS NULL;


CREATE INDEX IF NOT EXISTS idx_photos_active_public ON photos(is_public, created_at DESC) WHERE deleted_at IS NULL AND is_public = true;
CREATE INDEX IF NOT EXISTS idx_photos_active_created ON photos(created_at DESC) WHERE deleted_at IS NULL;

-- Stories partial indexes (active records only)
CREATE INDEX IF NOT EXISTS idx_stories_active_class ON stories(class_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stories_active_public ON stories(is_public, created_at DESC) WHERE deleted_at IS NULL AND is_public = true;
CREATE INDEX IF NOT EXISTS idx_stories_active_expires ON stories(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stories_active_created ON stories(created_at DESC) WHERE deleted_at IS NULL;

-- Menus partial indexes (active records only)
CREATE INDEX IF NOT EXISTS idx_menus_active_day ON menus(day) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menus_active_class ON menus(class_id, day) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menus_active_public ON menus(is_public, day) WHERE deleted_at IS NULL AND is_public = true;

-- Daily logs partial indexes (active records only)
CREATE INDEX IF NOT EXISTS idx_daily_logs_active_class ON daily_logs(class_id, recorded_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_logs_active_kind ON daily_logs(kind, recorded_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_logs_active_public ON daily_logs(public, recorded_at DESC) WHERE deleted_at IS NULL AND public = true;

-- Announcements partial indexes (active records only)
CREATE INDEX IF NOT EXISTS idx_announcements_active_class ON announcements(class_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_active_public ON announcements(is_public, created_at DESC) WHERE deleted_at IS NULL AND is_public = true;
-- Removed - covered by idx_announcements_week and idx_announcements_author
-- CHANGE: Monitor unused indexes with pg_stat_user_indexes
-- SELECT schemaname, relname, indexrelname, idx_scan FROM pg_stat_user_indexes ORDER BY idx_scan ASC;

-- Messages partial indexes (active records only)
CREATE INDEX IF NOT EXISTS idx_messages_active_thread ON messages(thread_type, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_active_created ON messages(created_at DESC) WHERE deleted_at IS NULL;

-- Events partial indexes (active records only)
CREATE INDEX IF NOT EXISTS idx_events_active_class ON events(class_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_active_start ON events(start_at) WHERE deleted_at IS NULL;
-- Removed - covered by idx_events_location and general indexes

-- Uploads partial indexes (active records only)
CREATE INDEX IF NOT EXISTS idx_uploads_active_visibility ON uploads(visibility) WHERE deleted_at IS NULL;

-- ======================
-- MULTI-TENANT VALIDATION CONSTRAINTS
-- ======================
-- Note: Cross-org validation should be enforced at the application level.
-- The following constraints ensure referential integrity within org boundaries:
--
-- 1. All foreign key relationships (class_id, user_id, student_id, etc.) must belong to the same org
-- 2. Application layer should validate:
--    - students.class_id belongs to students.org_id
--    - students.user_id belongs to students.org_id (if user_id is set)
--    - class_memberships.user_id belongs to class_memberships.org_id
--    - class_memberships.class_id belongs to class_memberships.org_id
--    - guardian_students.guardian_id belongs to guardian_students.org_id
--    - guardian_students.student_id belongs to guardian_students.org_id
--    - All denormalized org_id values match their parent table's org_id
--
DO $$
BEGIN
  -- Fix students.user_id foreign key
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'students_user_id_fkey' AND table_name = 'students') THEN
    ALTER TABLE students ADD CONSTRAINT students_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Fix class_memberships foreign keys
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'class_memberships_user_id_fkey' AND table_name = 'class_memberships') THEN
    ALTER TABLE class_memberships ADD CONSTRAINT class_memberships_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'class_memberships_class_id_fkey' AND table_name = 'class_memberships') THEN
    ALTER TABLE class_memberships ADD CONSTRAINT class_memberships_class_id_fkey 
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Fix guardian_students foreign keys
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'guardian_students_guardian_id_fkey' AND table_name = 'guardian_students') THEN
    ALTER TABLE guardian_students ADD CONSTRAINT guardian_students_guardian_id_fkey 
      FOREIGN KEY (guardian_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'guardian_students_student_id_fkey' AND table_name = 'guardian_students') THEN
    ALTER TABLE guardian_students ADD CONSTRAINT guardian_students_student_id_fkey 
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Add missing composite unique constraints
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'uq_class_memberships_class_user' AND table_name = 'class_memberships') THEN
    ALTER TABLE class_memberships ADD CONSTRAINT uq_class_memberships_class_user 
      UNIQUE (class_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'uq_guardian_students_guardian_student' AND table_name = 'guardian_students') THEN
    ALTER TABLE guardian_students ADD CONSTRAINT uq_guardian_students_guardian_student 
      UNIQUE (guardian_id, student_id);
  END IF;

  -- Add unique constraint for active invitations (prevent duplicate invitations per org)
  -- Create unique index instead of constraint for conditional uniqueness
  CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_org_email_active 
    ON invitations(org_id, email) WHERE deleted_at IS NULL AND accepted_at IS NULL;
END $$;

-- ======================
-- FOREIGN KEY CASCADE UPDATES
-- ======================
-- CHANGE: Ensure all FKs include ON UPDATE CASCADE (drop and recreate as needed)
DO $$
BEGIN
  -- users
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_id_fkey;
  ALTER TABLE users ADD CONSTRAINT users_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE RESTRICT ON UPDATE CASCADE;

  -- classes
  ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_org_id_fkey;
  ALTER TABLE classes ADD CONSTRAINT classes_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_created_by_fkey;
  ALTER TABLE classes ADD CONSTRAINT classes_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- class_memberships (already handled above, but ensure all are set)
  ALTER TABLE class_memberships DROP CONSTRAINT IF EXISTS class_memberships_org_id_fkey;
  ALTER TABLE class_memberships ADD CONSTRAINT class_memberships_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- students
  ALTER TABLE students DROP CONSTRAINT IF EXISTS students_org_id_fkey;
  ALTER TABLE students ADD CONSTRAINT students_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE students DROP CONSTRAINT IF EXISTS students_class_id_fkey;
  ALTER TABLE students ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- student_requests
  ALTER TABLE student_requests DROP CONSTRAINT IF EXISTS student_requests_org_id_fkey;
  ALTER TABLE student_requests ADD CONSTRAINT student_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE student_requests DROP CONSTRAINT IF EXISTS student_requests_class_id_fkey;
  ALTER TABLE student_requests ADD CONSTRAINT student_requests_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE student_requests DROP CONSTRAINT IF EXISTS student_requests_requested_by_fkey;
  ALTER TABLE student_requests ADD CONSTRAINT student_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE student_requests DROP CONSTRAINT IF EXISTS student_requests_approved_by_fkey;
  ALTER TABLE student_requests ADD CONSTRAINT student_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE student_requests DROP CONSTRAINT IF EXISTS student_requests_rejected_by_fkey;
  ALTER TABLE student_requests ADD CONSTRAINT student_requests_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- guardian_students (already handled above, but ensure all are set)
  ALTER TABLE guardian_students DROP CONSTRAINT IF EXISTS guardian_students_org_id_fkey;
  ALTER TABLE guardian_students ADD CONSTRAINT guardian_students_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- uploads
  ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_org_id_fkey;
  ALTER TABLE uploads ADD CONSTRAINT uploads_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_created_by_fkey;
  ALTER TABLE uploads ADD CONSTRAINT uploads_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- stories
  ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_org_id_fkey;
  ALTER TABLE stories ADD CONSTRAINT stories_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_class_id_fkey;
  ALTER TABLE stories ADD CONSTRAINT stories_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_author_id_fkey;
  ALTER TABLE stories ADD CONSTRAINT stories_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- story_items
  ALTER TABLE story_items DROP CONSTRAINT IF EXISTS story_items_org_id_fkey;
  ALTER TABLE story_items ADD CONSTRAINT story_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE story_items DROP CONSTRAINT IF EXISTS story_items_story_id_fkey;
  ALTER TABLE story_items ADD CONSTRAINT story_items_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE story_items DROP CONSTRAINT IF EXISTS story_items_upload_id_fkey;
  ALTER TABLE story_items ADD CONSTRAINT story_items_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- photos
  ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_org_id_fkey;
  ALTER TABLE photos ADD CONSTRAINT photos_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_class_id_fkey;
  ALTER TABLE photos ADD CONSTRAINT photos_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_student_id_fkey;
  ALTER TABLE photos ADD CONSTRAINT photos_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_upload_id_fkey;
  ALTER TABLE photos ADD CONSTRAINT photos_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_author_id_fkey;
  ALTER TABLE photos ADD CONSTRAINT photos_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- menus
  ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_org_id_fkey;
  ALTER TABLE menus ADD CONSTRAINT menus_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_class_id_fkey;
  ALTER TABLE menus ADD CONSTRAINT menus_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- daily_logs
  ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_org_id_fkey;
  ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_class_id_fkey;
  ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_created_by_fkey;
  ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- announcements
  ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_org_id_fkey;
  ALTER TABLE announcements ADD CONSTRAINT announcements_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_class_id_fkey;
  ALTER TABLE announcements ADD CONSTRAINT announcements_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_author_id_fkey;
  ALTER TABLE announcements ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- messages
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_org_id_fkey;
  ALTER TABLE messages ADD CONSTRAINT messages_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_created_by_fkey;
  ALTER TABLE messages ADD CONSTRAINT messages_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- message_participants
  ALTER TABLE message_participants DROP CONSTRAINT IF EXISTS message_participants_org_id_fkey;
  ALTER TABLE message_participants ADD CONSTRAINT message_participants_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE message_participants DROP CONSTRAINT IF EXISTS message_participants_message_id_fkey;
  ALTER TABLE message_participants ADD CONSTRAINT message_participants_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE message_participants DROP CONSTRAINT IF EXISTS message_participants_user_id_fkey;
  ALTER TABLE message_participants ADD CONSTRAINT message_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- message_items
  ALTER TABLE message_items DROP CONSTRAINT IF EXISTS message_items_org_id_fkey;
  ALTER TABLE message_items ADD CONSTRAINT message_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE message_items DROP CONSTRAINT IF EXISTS message_items_message_id_fkey;
  ALTER TABLE message_items ADD CONSTRAINT message_items_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE message_items DROP CONSTRAINT IF EXISTS message_items_author_id_fkey;
  ALTER TABLE message_items ADD CONSTRAINT message_items_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- events
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_org_id_fkey;
  ALTER TABLE events ADD CONSTRAINT events_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_class_id_fkey;
  ALTER TABLE events ADD CONSTRAINT events_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
  ALTER TABLE events ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- notifications
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_org_id_fkey;
  ALTER TABLE notifications ADD CONSTRAINT notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
  ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- device_tokens
  ALTER TABLE device_tokens DROP CONSTRAINT IF EXISTS device_tokens_user_id_fkey;
  ALTER TABLE device_tokens ADD CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- invitations
  ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_org_id_fkey;
  ALTER TABLE invitations ADD CONSTRAINT invitations_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_created_by_fkey;
  ALTER TABLE invitations ADD CONSTRAINT invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_accepted_by_fkey;
  ALTER TABLE invitations ADD CONSTRAINT invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- attendance
  ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_org_id_fkey;
  ALTER TABLE attendance ADD CONSTRAINT attendance_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_class_id_fkey;
  ALTER TABLE attendance ADD CONSTRAINT attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;
  ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_recorded_by_fkey;
  ALTER TABLE attendance ADD CONSTRAINT attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- assessments
  ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_org_id_fkey;
  ALTER TABLE assessments ADD CONSTRAINT assessments_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_class_id_fkey;
  ALTER TABLE assessments ADD CONSTRAINT assessments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_student_id_fkey;
  ALTER TABLE assessments ADD CONSTRAINT assessments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_assessed_by_fkey;
  ALTER TABLE assessments ADD CONSTRAINT assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- audit_log
  ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_org_id_fkey;
  ALTER TABLE audit_log ADD CONSTRAINT audit_log_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
  ALTER TABLE audit_log ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

  -- audit_changes
  ALTER TABLE audit_changes DROP CONSTRAINT IF EXISTS audit_changes_org_id_fkey;
  ALTER TABLE audit_changes ADD CONSTRAINT audit_changes_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE audit_changes DROP CONSTRAINT IF EXISTS audit_changes_changed_by_fkey;
  ALTER TABLE audit_changes ADD CONSTRAINT audit_changes_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  
  -- staff
  ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_org_id_fkey;
  ALTER TABLE staff ADD CONSTRAINT staff_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_user_id_fkey;
  ALTER TABLE staff ADD CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- student_relatives
  ALTER TABLE student_relatives DROP CONSTRAINT IF EXISTS student_relatives_org_id_fkey;
  ALTER TABLE student_relatives ADD CONSTRAINT student_relatives_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE student_relatives DROP CONSTRAINT IF EXISTS student_relatives_student_id_fkey;
  ALTER TABLE student_relatives ADD CONSTRAINT student_relatives_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;
END $$;

-- ======================
-- AUTO-UPDATE TIMESTAMP TRIGGERS
-- ======================
-- CHANGE: Auto-update timestamp trigger function and triggers for tables with updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT unnest(ARRAY[
    'orgs', 'users', 'classes', 'students',
    'student_requests', 'uploads', 'stories', 'story_items', 'photos', 'menus',
    'daily_logs', 'announcements', 'messages', 'message_participants', 'message_items',
    'events', 'notifications', 'invitations', 'attendance', 'assessments', 'staff', 'student_relatives'
  ]) AS tbl
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE t.tgname = 'trg_update_timestamp' AND c.relname = rec.tbl
    ) THEN
      EXECUTE format('CREATE TRIGGER trg_update_timestamp BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();', rec.tbl);
    END IF;
  END LOOP;
END $$;

-- ======================
-- MULTI-TENANT VALIDATION FUNCTION
-- ======================
-- Create validation function after all tables are created
CREATE OR REPLACE FUNCTION validate_org_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate students.class_id belongs to same org
  IF NEW.class_id IS NOT NULL THEN
    IF (SELECT org_id FROM classes WHERE id = NEW.class_id) != NEW.org_id THEN
      RAISE EXCEPTION 'Class belongs to different organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;