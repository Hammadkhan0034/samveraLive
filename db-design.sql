-- 00_extensions.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

/* ===========================
   01_orgs_roles_users.sql
   =========================== */
CREATE TABLE orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orgs_slug ON orgs(slug);

CREATE TABLE roles (
  id smallint PRIMARY KEY,
  name text NOT NULL UNIQUE
);

-- Seed common roles (optional)
INSERT INTO roles (id, name) VALUES
  (1, 'admin'),
  (2, 'staff'),
  (3, 'guardian')
ON CONFLICT DO NOTHING;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email text,
  phone text,
  full_name text NOT NULL,
  role_id smallint NOT NULL REFERENCES roles(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());

CREATE UNIQUE INDEX unique_user_email_per_org
ON users (org_id, email)
WHERE email IS NOT NULL;

CREATE INDEX idx_users_org_role ON users(org_id, role_id);

/* ===========================
   02_classes_memberships.sql
   =========================== */
CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);
CREATE INDEX idx_classes_org ON classes(org_id);

CREATE TABLE class_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);
CREATE INDEX idx_cm_class_user ON class_memberships(class_id, user_id);

/* ===========================
   03_children_guardians.sql
   =========================== */
CREATE TABLE children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id),
  first_name text NOT NULL,
  last_name text,
  dob date,
  gender text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_children_class ON children(class_id);

CREATE TABLE guardian_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  relation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guardian_id, child_id)
);
CREATE INDEX idx_gc_guardian_child ON guardian_children(guardian_id, child_id);

/* ===========================
   04_uploads_photos_stories.sql
   =========================== */
CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id),
  bucket text NOT NULL,
  path text NOT NULL,
  filename text,
  mime_type text,
  size_bytes bigint,
  width int,
  height int,
  checksum text,
  visibility text NOT NULL DEFAULT 'private',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, path)
);
CREATE INDEX idx_uploads_org_visibility ON uploads(org_id, visibility);
CREATE INDEX idx_uploads_path ON uploads(path);

CREATE TABLE stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id),
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  title text,
  caption text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_stories_class_expires ON stories(class_id, expires_at);
CREATE INDEX idx_stories_org_created ON stories(org_id, created_at DESC);

CREATE TABLE story_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  upload_id uuid REFERENCES uploads(id) ON DELETE SET NULL,
  order_index int NOT NULL DEFAULT 0,
  duration_ms int,
  caption text,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, order_index)
);
CREATE INDEX idx_story_items_story_order ON story_items(story_id, order_index);

CREATE TABLE photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  class_id uuid REFERENCES classes(id),
  child_id uuid REFERENCES children(id),
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id),
  caption text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_photos_class_created ON photos(class_id, created_at DESC);

/* ===========================
   05_menus_daily_logs_announcements.sql
   =========================== */
CREATE TABLE menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  class_id uuid REFERENCES classes(id),
  day date NOT NULL,
  breakfast text,
  lunch text,
  snack text,
  notes text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, class_id, day)
);
CREATE INDEX idx_menus_org_day ON menus(org_id, day);

CREATE TABLE daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  class_id uuid REFERENCES classes(id),
  child_id uuid REFERENCES children(id),
  kind text NOT NULL,
  value text,
  rating smallint,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  public boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_dailylogs_child_time ON daily_logs(child_id, recorded_at DESC);
CREATE INDEX idx_dailylogs_class_time ON daily_logs(class_id, recorded_at DESC);

CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  class_id uuid REFERENCES classes(id),
  author_id uuid REFERENCES users(id),
  title text NOT NULL,
  body text,
  week_start date,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_org_week ON announcements(org_id, week_start DESC);

/* ===========================
   06_messages_events_tokens.sql
   =========================== */
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  thread_type text NOT NULL,
  subject text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE message_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text,
  unread boolean DEFAULT true,
  UNIQUE (message_id, user_id)
);
CREATE INDEX idx_msg_participant ON message_participants(message_id, user_id);

CREATE TABLE message_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id),
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  edit_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX idx_message_items_message_time ON message_items(message_id, created_at DESC);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  class_id uuid REFERENCES classes(id),
  title text NOT NULL,
  description text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  location text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_org_start ON events(org_id, start_at);

CREATE TABLE device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  token text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, token)
);
CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);

/* ===========================
   07_invitations_audit.sql
   =========================== */
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id),
  email text NOT NULL,
  role_id smallint REFERENCES roles(id),
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES users(id),
  accepted_by uuid REFERENCES users(id),
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_org_email ON invitations(org_id, email);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  object_type text,
  object_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_time ON audit_log(org_id, created_at DESC);

/* ===========================
   08_student_requests.sql
   =========================== */
CREATE TABLE student_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  dob date,
  gender text NOT NULL DEFAULT 'unknown',
  medical_notes text,
  allergies text,
  emergency_contact text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  rejected_by uuid REFERENCES users(id),
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_requests_org ON student_requests(org_id);
CREATE INDEX idx_student_requests_class ON student_requests(class_id);
CREATE INDEX idx_student_requests_status ON student_requests(status);
CREATE INDEX idx_student_requests_requested_by ON student_requests(requested_by);