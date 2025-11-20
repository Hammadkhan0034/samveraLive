import { supabaseAdmin } from '@/lib/supabaseClient';
import { createSupabaseServer } from '@/lib/supabaseServer';

export interface Notification {
  id: string;
  org_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  priority: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationType = 
  | 'announcement_class' 
  | 'announcement_org' 
  | 'story_class' 
  | 'story_org';

/**
 * Create a single notification
 */
export async function createNotification(
  orgId: string,
  userId: string,
  type: NotificationType,
  title: string,
  body: string | null = null,
  data: Record<string, any> = {},
  priority: string = 'normal',
  expiresAt: string | null = null
): Promise<Notification> {
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      org_id: orgId,
      user_id: userId,
      type,
      title,
      body,
      data,
      priority,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return notification as Notification;
}

/**
 * Create notifications for multiple users in bulk
 */
export async function createBulkNotifications(
  orgId: string,
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string | null = null,
  data: Record<string, any> = {},
  priority: string = 'normal',
  expiresAt: string | null = null
): Promise<Notification[]> {
  if (userIds.length === 0) {
    return [];
  }

  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  const notifications = userIds.map(userId => ({
    org_id: orgId,
    user_id: userId,
    type,
    title,
    body,
    data,
    priority,
    expires_at: expiresAt,
  }));

  const { data: createdNotifications, error } = await supabase
    .from('notifications')
    .insert(notifications)
    .select();

  if (error) {
    throw new Error(`Failed to create bulk notifications: ${error.message}`);
  }

  return createdNotifications as Notification[];
}

/**
 * Get all students in a class, their parents (guardians), and teachers assigned to the class
 * Returns unique user IDs of students, their parents, and teachers
 */
export async function getClassNotificationTargets(
  classId: string,
  orgId: string
): Promise<string[]> {
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  // Get all students in the class
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('user_id, id')
    .eq('class_id', classId)
    .eq('org_id', orgId)
    .not('user_id', 'is', null);

  if (studentsError) {
    throw new Error(`Failed to fetch students: ${studentsError.message}`);
  }

  const studentUserIds = (students || [])
    .map(s => s.user_id)
    .filter((id): id is string => !!id && typeof id === 'string');

  const studentIds = (students || [])
    .map(s => s.id)
    .filter((id): id is string => !!id && typeof id === 'string');

  // Get all parents (guardians) of these students
  let parentUserIds: string[] = [];
  if (studentIds.length > 0) {
    const { data: guardianRelations, error: guardianError } = await supabase
      .from('guardian_students')
      .select('guardian_id')
      .in('student_id', studentIds)
      .eq('org_id', orgId);

    if (guardianError) {
      throw new Error(`Failed to fetch guardians: ${guardianError.message}`);
    }

    parentUserIds = (guardianRelations || [])
      .map(r => r.guardian_id)
      .filter((id): id is string => !!id && typeof id === 'string');
  }

  // Get all teachers assigned to this class via class_memberships
  const { data: classMemberships, error: membershipsError } = await supabase
    .from('class_memberships')
    .select('user_id')
    .eq('class_id', classId)
    .eq('org_id', orgId)
    .eq('membership_role', 'teacher');

  if (membershipsError) {
    throw new Error(`Failed to fetch class teachers: ${membershipsError.message}`);
  }

  const teacherUserIds = (classMemberships || [])
    .map(cm => cm.user_id)
    .filter((id): id is string => !!id && typeof id === 'string');

  // Combine and deduplicate user IDs (students, parents, and teachers)
  const allUserIds = [...new Set([...studentUserIds, ...parentUserIds, ...teacherUserIds])];
  
  return allUserIds;
}

/**
 * Get all teachers and all parents in an organization
 * Returns unique user IDs
 */
export async function getOrgNotificationTargets(
  orgId: string
): Promise<string[]> {
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  // Get all teachers in the org
  const { data: teachers, error: teachersError } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', orgId)
    .eq('role', 'teacher')
    .eq('is_active', true)
    .is('deleted_at', null);

  if (teachersError) {
    throw new Error(`Failed to fetch teachers: ${teachersError.message}`);
  }

  const teacherUserIds = (teachers || [])
    .map(t => t.id)
    .filter((id): id is string => !!id && typeof id === 'string');

  // Get all parents (guardians) in the org
  const { data: parents, error: parentsError } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', orgId)
    .eq('role', 'guardian')
    .eq('is_active', true)
    .is('deleted_at', null);

  if (parentsError) {
    throw new Error(`Failed to fetch parents: ${parentsError.message}`);
  }

  const parentUserIds = (parents || [])
    .map(p => p.id)
    .filter((id): id is string => !!id && typeof id === 'string');

  // Combine and deduplicate user IDs
  const allUserIds = [...new Set([...teacherUserIds, ...parentUserIds])];
  
  return allUserIds;
}

/**
 * Get user's notifications
 */
export async function getUserNotifications(
  userId: string,
  orgId: string,
  limit: number = 50,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data: notifications, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }

  return (notifications || []) as Notification[];
}

/**
 * Get count of unread notifications for a user
 */
export async function getUnreadCount(
  userId: string,
  orgId: string
): Promise<number> {
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .eq('is_read', false);

  if (error) {
    throw new Error(`Failed to get unread count: ${error.message}`);
  }

  return count || 0;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
  orgId: string
): Promise<void> {
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .eq('org_id', orgId);

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(
  userId: string,
  orgId: string
): Promise<void> {
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .eq('is_read', false);

  if (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
}

