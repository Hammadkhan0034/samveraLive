-- ======================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- Multi-Tenant Isolation & Role-Based Access Control
-- ======================
-- 
-- This file implements comprehensive RLS policies for multi-tenant isolation.
-- Each user can only access data from their own organization (org_id).
-- 
-- IMPORTANT: Run this AFTER running schema.sql in Supabase SQL Editor
-- ======================

-- ======================
-- HELPER FUNCTIONS
-- ======================

-- Function to get current user's organization ID from auth.users metadata or users table
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(
      (SELECT org_id FROM public.users WHERE id = auth.uid()::uuid),
      (SELECT (raw_user_meta_data->>'organization_id')::uuid FROM auth.users WHERE id = auth.uid())
    );
$$;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(
      (SELECT role FROM public.users WHERE id = auth.uid()::uuid),
      (SELECT (raw_user_meta_data->>'role')::user_role_type FROM auth.users WHERE id = auth.uid())
    );
$$;

-- Function to check if user is principal
CREATE OR REPLACE FUNCTION public.is_principal()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_role() = 'principal';
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_role() = 'admin';
$$;

-- Function to check if user is staff
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Prefer explicit flag on user record if available
    COALESCE(
      (SELECT is_staff FROM public.users WHERE id = auth.uid()::uuid),
      -- Fallback to role-based inference from auth metadata
      (SELECT COALESCE((raw_user_meta_data->>'is_staff')::boolean, false) FROM auth.users WHERE id = auth.uid()),
      false
    )
    OR public.user_role() IN (
      'admin',
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
$$;

-- Function to check if user is teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_role() = 'teacher';
$$;

-- Function to check if user is guardian
CREATE OR REPLACE FUNCTION public.is_guardian()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_role() = 'guardian';
$$;

-- Function to get user's student IDs (for guardians)
CREATE OR REPLACE FUNCTION public.user_student_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT student_id 
  FROM public.guardian_students 
  WHERE guardian_id = auth.uid()::uuid;
$$;

-- Function to get user's class IDs (for teachers/staff)
CREATE OR REPLACE FUNCTION public.user_class_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT class_id 
  FROM public.class_memberships 
  WHERE user_id = auth.uid()::uuid;
$$;

-- ======================
-- ENABLE RLS ON ALL TABLES
-- ======================

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_relatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_changes ENABLE ROW LEVEL SECURITY;

-- ======================
-- ORGANIZATIONS (ORGS)
-- ======================

-- Users can only see their own organization
CREATE POLICY "Users can view their own organization"
  ON orgs FOR SELECT
  USING (id = public.user_org_id());

-- Only principals can update their organization
CREATE POLICY "Principals can update their organization"
  ON orgs FOR UPDATE
  USING (id = public.user_org_id() AND (public.is_principal() OR public.is_admin()));

-- Only service role can create organizations (handled in application)
-- No INSERT policy for regular users

-- ======================
-- USERS
-- ======================

-- Users can view users in their organization
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (org_id = public.user_org_id());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid()::uuid AND org_id = public.user_org_id());

-- Principals can create users in their organization
CREATE POLICY "Principals can create users in their organization"
  ON users FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND (public.is_principal() OR public.is_admin()));

-- Principals can delete users in their organization
CREATE POLICY "Principals can delete users in their organization"
  ON users FOR DELETE
  USING (org_id = public.user_org_id() AND (public.is_principal() OR public.is_admin()));

-- ======================
-- STAFF
-- ======================

-- Staff can view staff in their organization
CREATE POLICY "Users can view staff in their organization"
  ON staff FOR SELECT
  USING (org_id = public.user_org_id());

-- Staff can update their own staff record
CREATE POLICY "Staff can update their own record"
  ON staff FOR UPDATE
  USING (user_id = auth.uid()::uuid AND org_id = public.user_org_id());

-- Principals can create staff in their organization
CREATE POLICY "Principals can create staff in their organization"
  ON staff FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND (public.is_principal() OR public.is_admin()));

-- Principals can delete staff in their organization
CREATE POLICY "Principals can delete staff in their organization"
  ON staff FOR DELETE
  USING (org_id = public.user_org_id() AND (public.is_principal() OR public.is_admin()));

-- ======================
-- CLASSES
-- ======================

-- Users can view classes in their organization
CREATE POLICY "Users can view classes in their organization"
  ON classes FOR SELECT
  USING (org_id = public.user_org_id());

-- Staff can create classes in their organization
CREATE POLICY "Staff can create classes in their organization"
  ON classes FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_staff());

-- Staff can update classes in their organization
CREATE POLICY "Staff can update classes in their organization"
  ON classes FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Principals can delete classes in their organization
CREATE POLICY "Principals can delete classes in their organization"
  ON classes FOR DELETE
  USING (org_id = public.user_org_id() AND (public.is_principal() OR public.is_admin()));

-- ======================
-- CLASS MEMBERSHIPS
-- ======================

-- Users can view class memberships in their organization
CREATE POLICY "Users can view class memberships in their organization"
  ON class_memberships FOR SELECT
  USING (org_id = public.user_org_id());

-- Staff can create class memberships in their organization
CREATE POLICY "Staff can create class memberships in their organization"
  ON class_memberships FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_staff());

-- Staff can update class memberships in their organization
CREATE POLICY "Staff can update class memberships in their organization"
  ON class_memberships FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Staff can delete class memberships in their organization
CREATE POLICY "Staff can delete class memberships in their organization"
  ON class_memberships FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- STUDENTS
-- ======================

-- Staff can view all students in their organization
CREATE POLICY "Staff can view students in their organization"
  ON students FOR SELECT
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Guardians can only view their own children
CREATE POLICY "Guardians can view their own children"
  ON students FOR SELECT
  USING (
    org_id = public.user_org_id() 
    AND public.is_guardian() 
    AND id IN (SELECT public.user_student_ids())
  );

-- Staff can create students in their organization
CREATE POLICY "Staff can create students in their organization"
  ON students FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_staff());

-- Staff can update students in their organization
CREATE POLICY "Staff can update students in their organization"
  ON students FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Guardians can update their own children (limited fields - handled in application)
CREATE POLICY "Guardians can update their own children"
  ON students FOR UPDATE
  USING (
    org_id = public.user_org_id() 
    AND public.is_guardian() 
    AND id IN (SELECT public.user_student_ids())
  );

-- Principals can delete students in their organization
CREATE POLICY "Principals can delete students in their organization"
  ON students FOR DELETE
  USING (org_id = public.user_org_id() AND (public.is_principal() OR public.is_admin()));

-- ======================
-- STUDENT RELATIVES
-- ======================

-- Staff can view all student relatives in their organization
CREATE POLICY "Staff can view student relatives in their organization"
  ON student_relatives FOR SELECT
  USING (
    org_id = public.user_org_id() 
    AND public.is_staff()
  );

-- Guardians can view relatives of their own children
CREATE POLICY "Guardians can view relatives of their children"
  ON student_relatives FOR SELECT
  USING (
    org_id = public.user_org_id() 
    AND public.is_guardian() 
    AND student_id IN (SELECT public.user_student_ids())
  );

-- Staff can manage student relatives
CREATE POLICY "Staff can manage student relatives"
  ON student_relatives FOR ALL
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- STUDENT REQUESTS
-- ======================

-- Staff can view all requests in their organization
CREATE POLICY "Staff can view requests in their organization"
  ON student_requests FOR SELECT
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Guardians can view their own requests
CREATE POLICY "Guardians can view their own requests"
  ON student_requests FOR SELECT
  USING (
    org_id = public.user_org_id() 
    AND public.is_guardian() 
    AND requested_by = auth.uid()::uuid
  );

-- Guardians can create requests in their organization
CREATE POLICY "Guardians can create requests in their organization"
  ON student_requests FOR INSERT
  WITH CHECK (
    org_id = public.user_org_id() 
    AND public.is_guardian() 
    AND requested_by = auth.uid()::uuid
  );

-- Staff can update requests in their organization
CREATE POLICY "Staff can update requests in their organization"
  ON student_requests FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- GUARDIAN STUDENTS (Linking Table)
-- ======================

-- Staff can view all guardian-student links in their organization
CREATE POLICY "Staff can view guardian-student links"
  ON guardian_students FOR SELECT
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Guardians can view their own links
CREATE POLICY "Guardians can view their own links"
  ON guardian_students FOR SELECT
  USING (
    org_id = public.user_org_id() 
    AND public.is_guardian() 
    AND guardian_id = auth.uid()::uuid
  );

-- Staff can manage guardian-student links
CREATE POLICY "Staff can manage guardian-student links"
  ON guardian_students FOR ALL
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- ======================
-- STORIES
-- ======================

-- Users can view stories in their organization
CREATE POLICY "Users can view stories in their organization"
  ON stories FOR SELECT
  USING (org_id = public.user_org_id());

-- Staff can create stories in their organization
CREATE POLICY "Staff can create stories in their organization"
  ON stories FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_staff());

-- Staff can update stories they created
CREATE POLICY "Staff can update their own stories"
  ON stories FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff() AND author_id = auth.uid()::uuid);

-- Staff can delete stories they created
CREATE POLICY "Staff can delete their own stories"
  ON stories FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_staff() AND author_id = auth.uid()::uuid);

-- ======================
-- STORY ITEMS
-- ======================

-- Users can view story items in their organization
CREATE POLICY "Users can view story items in their organization"
  ON story_items FOR SELECT
  USING (
    org_id = public.user_org_id()
  );

-- Staff can manage story items
CREATE POLICY "Staff can manage story items"
  ON story_items FOR ALL
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- PHOTOS
-- ======================

-- Staff can view all photos in their organization
CREATE POLICY "Staff can view photos in their organization"
  ON photos FOR SELECT
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Guardians can view photos of their children
CREATE POLICY "Guardians can view photos of their children"
  ON photos FOR SELECT
  USING (
    org_id = public.user_org_id() 
    AND public.is_guardian() 
    AND (
      student_id IN (SELECT public.user_student_ids())
      OR is_public = true
    )
  );

-- Staff can create photos in their organization
CREATE POLICY "Staff can create photos in their organization"
  ON photos FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_staff());

-- Staff can update photos in their organization
CREATE POLICY "Staff can update photos in their organization"
  ON photos FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Staff can delete photos in their organization
CREATE POLICY "Staff can delete photos in their organization"
  ON photos FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- MENUS
-- ======================

-- Users can view menus in their organization
CREATE POLICY "Users can view menus in their organization"
  ON menus FOR SELECT
  USING (org_id = public.user_org_id());

-- Staff can manage menus in their organization
CREATE POLICY "Staff can manage menus in their organization"
  ON menus FOR ALL
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- DAILY LOGS
-- ======================

-- Staff can view all daily logs in their organization
CREATE POLICY "Staff can view daily logs in their organization"
  ON daily_logs FOR SELECT
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Guardians can view daily logs of their children
CREATE POLICY "Guardians can view daily logs of their children"
  ON daily_logs FOR SELECT
  USING (
    org_id = public.user_org_id() 
    AND public.is_guardian() 
    AND student_id IN (SELECT public.user_student_ids())
  );

-- Staff can create daily logs in their organization
CREATE POLICY "Staff can create daily logs in their organization"
  ON daily_logs FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_staff());

-- Staff can update daily logs in their organization
CREATE POLICY "Staff can update daily logs in their organization"
  ON daily_logs FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Staff can delete daily logs in their organization
CREATE POLICY "Staff can delete daily logs in their organization"
  ON daily_logs FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- ANNOUNCEMENTS
-- ======================

-- Users can view announcements in their organization
CREATE POLICY "Users can view announcements in their organization"
  ON announcements FOR SELECT
  USING (org_id = public.user_org_id());

-- Staff can create announcements in their organization
CREATE POLICY "Staff can create announcements in their organization"
  ON announcements FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_staff());

-- Staff can update announcements they created
CREATE POLICY "Staff can update their own announcements"
  ON announcements FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff() AND author_id = auth.uid()::uuid);

-- Staff can delete announcements they created
CREATE POLICY "Staff can delete their own announcements"
  ON announcements FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_staff() AND author_id = auth.uid()::uuid);

-- ======================
-- MESSAGES
-- ======================

-- Users can view messages they are participants in
CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  USING (
    org_id = public.user_org_id()
    AND id IN (
      SELECT message_id 
      FROM message_participants 
      WHERE user_id = auth.uid()::uuid
    )
  );

-- Users can create messages in their organization
CREATE POLICY "Users can create messages in their organization"
  ON messages FOR INSERT
  WITH CHECK (org_id = public.user_org_id());

-- Users can update their own messages
CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (
    org_id = public.user_org_id() 
    AND created_by = auth.uid()::uuid
  );

-- Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  USING (
    org_id = public.user_org_id() 
    AND created_by = auth.uid()::uuid
  );

-- ======================
-- MESSAGE PARTICIPANTS
-- ======================

-- Users can view message participants for their messages
CREATE POLICY "Users can view message participants"
  ON message_participants FOR SELECT
  USING (
    org_id = public.user_org_id()
    AND (
      user_id = auth.uid()::uuid
      OR message_id IN (
        SELECT id FROM messages WHERE created_by = auth.uid()::uuid
      )
    )
  );

-- Users can add participants to their messages
CREATE POLICY "Users can add participants to their messages"
  ON message_participants FOR INSERT
  WITH CHECK (
    org_id = public.user_org_id()
    AND message_id IN (
      SELECT id FROM messages WHERE created_by = auth.uid()::uuid
    )
  );

-- Users can remove themselves from messages
CREATE POLICY "Users can remove themselves from messages"
  ON message_participants FOR DELETE
  USING (
    org_id = public.user_org_id() 
    AND user_id = auth.uid()::uuid
  );

-- ======================
-- MESSAGE ITEMS
-- ======================

-- Users can view message items for their messages
CREATE POLICY "Users can view message items"
  ON message_items FOR SELECT
  USING (
    org_id = public.user_org_id()
    AND message_id IN (
      SELECT message_id 
      FROM message_participants 
      WHERE user_id = auth.uid()::uuid
    )
  );

-- Users can create message items in their messages
CREATE POLICY "Users can create message items"
  ON message_items FOR INSERT
  WITH CHECK (
    org_id = public.user_org_id()
    AND message_id IN (
      SELECT message_id 
      FROM message_participants 
      WHERE user_id = auth.uid()::uuid
    )
    AND author_id = auth.uid()::uuid
  );

-- Users can update their own message items
CREATE POLICY "Users can update their own message items"
  ON message_items FOR UPDATE
  USING (
    org_id = public.user_org_id() 
    AND author_id = auth.uid()::uuid
  );

-- Users can delete their own message items
CREATE POLICY "Users can delete their own message items"
  ON message_items FOR DELETE
  USING (
    org_id = public.user_org_id() 
    AND author_id = auth.uid()::uuid
  );

-- ======================
-- EVENTS
-- ======================

-- Users can view events in their organization
CREATE POLICY "Users can view events in their organization"
  ON events FOR SELECT
  USING (org_id = public.user_org_id());

-- Staff can create events in their organization
CREATE POLICY "Staff can create events in their organization"
  ON events FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_staff());

-- Staff can update events in their organization
CREATE POLICY "Staff can update events in their organization"
  ON events FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Staff can delete events in their organization
CREATE POLICY "Staff can delete events in their organization"
  ON events FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- NOTIFICATIONS
-- ======================

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (
    org_id = public.user_org_id() 
    AND user_id = auth.uid()::uuid
  );

-- System can create notifications (handled by service role)
-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (
    org_id = public.user_org_id() 
    AND user_id = auth.uid()::uuid
  );

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (
    org_id = public.user_org_id() 
    AND user_id = auth.uid()::uuid
  );

-- ======================
-- DEVICE TOKENS
-- ======================

-- Users can only view their own device tokens
CREATE POLICY "Users can view their own device tokens"
  ON device_tokens FOR SELECT
  USING (
    user_id = auth.uid()::uuid
  );

-- Users can create their own device tokens
CREATE POLICY "Users can create their own device tokens"
  ON device_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);

-- Users can update their own device tokens
CREATE POLICY "Users can update their own device tokens"
  ON device_tokens FOR UPDATE
  USING (user_id = auth.uid()::uuid);

-- Users can delete their own device tokens
CREATE POLICY "Users can delete their own device tokens"
  ON device_tokens FOR DELETE
  USING (user_id = auth.uid()::uuid);

-- ======================
-- INVITATIONS
-- ======================

-- Staff can view invitations in their organization
CREATE POLICY "Staff can view invitations in their organization"
  ON invitations FOR SELECT
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Staff can create invitations in their organization
CREATE POLICY "Staff can create invitations in their organization"
  ON invitations FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_staff());

-- Staff can update invitations in their organization
CREATE POLICY "Staff can update invitations in their organization"
  ON invitations FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Staff can delete invitations in their organization
CREATE POLICY "Staff can delete invitations in their organization"
  ON invitations FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- ATTENDANCE
-- ======================

-- Staff can view all attendance in their organization
CREATE POLICY "Staff can view attendance in their organization"
  ON attendance FOR SELECT
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Guardians can view attendance of their children
CREATE POLICY "Guardians can view attendance of their children"
  ON attendance FOR SELECT
  USING (
    org_id = public.user_org_id() 
    AND public.is_guardian() 
    AND student_id IN (SELECT public.user_student_ids())
  );

-- Staff can create attendance in their organization
CREATE POLICY "Staff can create attendance in their organization"
  ON attendance FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_staff());

-- Staff can update attendance in their organization
CREATE POLICY "Staff can update attendance in their organization"
  ON attendance FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Staff can delete attendance in their organization
CREATE POLICY "Staff can delete attendance in their organization"
  ON attendance FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- ASSESSMENTS
-- ======================

-- Staff can view all assessments in their organization
CREATE POLICY "Staff can view assessments in their organization"
  ON assessments FOR SELECT
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Guardians can view assessments of their children
CREATE POLICY "Guardians can view assessments of their children"
  ON assessments FOR SELECT
  USING (
    org_id = public.user_org_id() 
    AND public.is_guardian() 
    AND student_id IN (SELECT public.user_student_ids())
  );

-- Staff can create assessments in their organization
CREATE POLICY "Staff can create assessments in their organization"
  ON assessments FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_staff());

-- Staff can update assessments in their organization
CREATE POLICY "Staff can update assessments in their organization"
  ON assessments FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Staff can delete assessments in their organization
CREATE POLICY "Staff can delete assessments in their organization"
  ON assessments FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_staff());

-- ======================
-- AUDIT LOG
-- ======================

-- Staff can view audit logs in their organization
CREATE POLICY "Staff can view audit logs in their organization"
  ON audit_log FOR SELECT
  USING (org_id = public.user_org_id() AND public.is_staff());

-- Only service role can create audit logs (handled in application)
-- No INSERT policy for regular users

-- ======================
-- AUDIT CHANGES
-- ======================

-- Staff can view audit changes in their organization
CREATE POLICY "Staff can view audit changes in their organization"
  ON audit_changes FOR SELECT
  USING (
    org_id = public.user_org_id() 
    AND public.is_staff()
  );

-- Only service role can create audit changes (handled in application)
-- No INSERT policy for regular users

-- ======================
-- NOTES
-- ======================

-- 1. All policies enforce multi-tenant isolation using org_id
-- 2. Role-based access is enforced through helper functions
-- 3. Principals have full access to their organization
-- 4. Staff can view and manage most data in their organization
-- 5. Guardians can only view data related to their children
-- 6. Users can only modify their own records (with some exceptions)
-- 7. Service role (used in application) bypasses RLS for system operations

-- ======================
-- TESTING RLS POLICIES
-- ======================

-- To test RLS policies:
-- 1. Create test users with different roles in different organizations
-- 2. Verify they can only see data from their organization
-- 3. Verify role-based access restrictions
-- 4. Test guardian access to only their children's data

-- Example test query:
-- SELECT * FROM students WHERE org_id = public.user_org_id();
-- This should only return students from the current user's organization

