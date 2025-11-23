'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { 
  requireServerAuth, 
  requireServerRole, 
  requireServerRoles, 
  requireServerRoleLevel,
  requireServerOrgAccess,
  requireServerClassAccess,
  createSupabaseServer 
} from './supabaseServer';
import { type SamveraRole, type UserMetadata } from './auth';
import { supabaseAdmin } from './supabaseClient';
import {
  createBulkNotifications,
  getClassNotificationTargets,
  getOrgNotificationTargets,
  type NotificationType,
} from './services/notifications';
import { createEventSchema, updateEventSchema } from './validation';

// Example server actions with role gating

export async function createAnnouncement(data: {
  title: string;
  body: string;
  classId?: string;
  orgId?: string;
}) {
  // Only teachers, principals, and admins can create announcements
  const { user, session } = await requireServerRoles(['teacher', 'principal', 'admin']);
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  // Priority: explicit orgId -> user metadata -> admin users table -> class fallback
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  let orgId = data.orgId || userMetadata?.org_id;
  if (!orgId && supabaseAdmin) {
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle();
    orgId = (userRow as any)?.org_id as string | undefined;
  }
  // Final fallback: use default org id from env for development
  if (!orgId && process.env.NEXT_PUBLIC_DEFAULT_ORG_ID) {
    orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
  }
  // Fallback: if still missing and classId provided, try resolve via class
  if (!orgId && data.classId) {
    const { data: cls } = await supabase
      .from('classes')
      .select('org_id')
      .eq('id', data.classId)
      .maybeSingle();
    orgId = (cls as any)?.org_id as string | undefined;
  }
  // Require org scope to satisfy typical FKs and business rules
  if (!orgId) {
    throw new Error('Missing organization for user');
  }
  
  // Ensure author exists in domain users table to satisfy FK
  // Ensure author exists in domain users table (FK target). If not possible due to constraints, fall back to null author.
  const userMeta: any = user.user_metadata || {};
  const upsertPayload: Record<string, any> = {
    id: user.id,
    email: user.email,
    full_name: userMeta.full_name || userMeta.name || null,
    is_active: true,
    org_id: orgId,
    metadata: userMeta,
  };
  let authorIdForInsert: string | null = user.id;
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (!existing) {
      const { error: upErr } = await supabase.from('users').upsert(upsertPayload, { onConflict: 'id' });
      if (upErr) {
        // Try minimal insert that passes domain/email constraints (email NULL allowed)
        const minimal = {
          id: user.id,
          email: null as any,
          full_name: upsertPayload.full_name || 'User',
          org_id: upsertPayload.org_id,
          is_active: true,
          metadata: upsertPayload.metadata,
        };
        const { error: insErr } = await supabase.from('users').insert(minimal).select('id').maybeSingle();
        if (insErr) {
          const systemAuthor = process.env.NEXT_PUBLIC_SYSTEM_AUTHOR_ID || process.env.SYSTEM_AUTHOR_ID || null;
          authorIdForInsert = (systemAuthor && typeof systemAuthor === 'string' && systemAuthor.length > 0) ? systemAuthor : null;
        }
      }
    }
  } catch {
    const systemAuthor = process.env.NEXT_PUBLIC_SYSTEM_AUTHOR_ID || process.env.SYSTEM_AUTHOR_ID || null;
    authorIdForInsert = (systemAuthor && typeof systemAuthor === 'string' && systemAuthor.length > 0) ? systemAuthor : null;
  }

  // Resolve class_id and week_start
  // If classId is explicitly provided as null, use null (org-wide announcement)
  // If classId is provided as a string, use it (class-specific announcement)
  // If classId is undefined, check metadata and potentially auto-provision
  let classIdResolved: string | null = null;
  if (data.classId !== undefined && data.classId !== null) {
    // classId was explicitly provided as a string (class-specific)
    classIdResolved = data.classId && data.classId.trim() !== '' ? data.classId : null;
  } else if (data.classId === null) {
    // classId was explicitly set to null (org-wide announcement)
    classIdResolved = null;
  } else {
    // classId was not provided (undefined), check class_memberships table as fallback
    if (supabaseAdmin && orgId) {
      const { data: membership } = await supabaseAdmin
        .from('class_memberships')
        .select('class_id')
        .eq('user_id', user.id)
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle();
      classIdResolved = (membership as any)?.class_id || null;
    } else {
      classIdResolved = null;
    }
  }
  
  // Only auto-provision a default class if classId was undefined (not provided) AND user is a teacher
  // This allows teachers to create org-wide announcements by explicitly setting classId to null
  const userRoles: string[] = Array.isArray(user.user_metadata?.roles) ? user.user_metadata.roles : [];
  if (userRoles.includes('teacher') && !classIdResolved && data.classId === undefined) {
    // Auto-provision a default class for this org and use it (only if classId wasn't explicitly provided)
    const defaultClassName = 'Default Class';
    const { data: clsRow, error: clsErr } = await (supabaseAdmin ?? supabase)
      .from('classes')
      .upsert({ org_id: orgId, name: defaultClassName }, { onConflict: 'org_id,name' })
      .select('id')
      .single();
    if (clsErr) {
      throw new Error('Missing class for teacher');
    }
    classIdResolved = (clsRow as any)?.id ?? null;
  }
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7)); // Monday as week start
  const weekStartISO = weekStart.toISOString().slice(0, 10);

  const insertPayload: Record<string, any> = {
    class_id: classIdResolved,
    author_id: authorIdForInsert,
    title: data.title,
    body: data.body,
    is_public: true,
    week_start: weekStartISO,
  };
  insertPayload.org_id = orgId;

  let { data: announcement, error } = await supabase
    .from('announcements')
    .insert(insertPayload)
    .select()
    .single();

  // If schema lacks org_id, retry without it
  if (error && /org_id/i.test(error.message)) {
    const retryPayload = { ...insertPayload };
    delete (retryPayload as any).org_id;
    ({ data: announcement, error } = await supabase
      .from('announcements')
      .insert(retryPayload)
      .select()
      .single());
  }

  if (error) {
    throw new Error(`Failed to create announcement: ${error.message}`);
  }
  
  // Create notifications for target users
  try {
    let targetUserIds: string[] = [];
    let notificationType: NotificationType;
    
    if (classIdResolved) {
      // Class-specific announcement: notify students and their parents
      notificationType = 'announcement_class';
      targetUserIds = await getClassNotificationTargets(classIdResolved, orgId);
    } else {
      // Organization-wide announcement: notify all teachers and all parents
      notificationType = 'announcement_org';
      targetUserIds = await getOrgNotificationTargets(orgId);
    }
    
    // Exclude the author from receiving notifications about their own announcement
    if (authorIdForInsert) {
      targetUserIds = targetUserIds.filter(id => id !== authorIdForInsert);
    }
    
    // Only create notifications if there are target users
    if (targetUserIds.length > 0 && announcement) {
      await createBulkNotifications(
        orgId,
        targetUserIds,
        notificationType,
        data.title,
        data.body,
        {
          announcement_id: announcement.id,
          class_id: classIdResolved,
          author_id: authorIdForInsert,
        }
      );
    }
  } catch (notificationError) {
    // Log error but don't fail the announcement creation
    console.error('Failed to create notifications for announcement:', notificationError);
  }
  
  revalidatePath('/dashboard');
  return announcement;
}

export async function updateUserRole(userId: string, newRoles: SamveraRole[], activeRole?: SamveraRole) {
  // Only admins can update user roles
  const { user } = await requireServerRole('admin');
  
  const supabase = await createSupabaseServer();
  
  // Get existing metadata to preserve org_id
  const { data: existingUser } = await supabase.auth.admin.getUserById(userId);
  const existingMetadata = existingUser?.user?.user_metadata as Partial<UserMetadata> | undefined;
  
  const orgId = existingMetadata?.org_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '';
  if (!orgId) {
    throw new Error('org_id is required but not found in user metadata and no default is configured');
  }
  
  const userMetadata: UserMetadata = {
    roles: newRoles,
    activeRole: activeRole || newRoles[0],
    org_id: orgId,
  };
  
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: userMetadata
  });
  
  if (error) {
    throw new Error(`Failed to update user role: ${error.message}`);
  }
  
  revalidatePath('/dashboard/admin');
  return { success: true };
}

export async function updateAnnouncement(announcementId: string, data: {
  title: string;
  body: string;
  classId?: string;
}) {
  // Only admins and the author can update announcements
  const { user } = await requireServerAuth();
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  // First check if user is admin or the author
  const { data: announcement } = await supabase
    .from('announcements')
    .select('author_id, org_id')
    .eq('id', announcementId)
    .single();
    
  if (!announcement) {
    throw new Error('Announcement not found');
  }
  
  const userRoles = user.user_metadata?.roles || [];
  const isAdmin = userRoles.includes('admin');
  const isAuthor = announcement.author_id === user.id;
  
  if (!isAdmin && !isAuthor) {
    throw new Error('Insufficient permissions to update this announcement');
  }
  
  // Validate org_id matches user's org
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const userOrgId = userMetadata?.org_id;
  if (!isAdmin && announcement.org_id && userOrgId && announcement.org_id !== userOrgId) {
    throw new Error('Cannot update announcement from different organization');
  }
  
  const updatePayload: Record<string, any> = {
    title: data.title.trim(),
    body: data.body.trim(),
    updated_at: new Date().toISOString(),
  };
  
  // Update class_id if provided
  if (data.classId !== undefined) {
    updatePayload.class_id = data.classId || null;
  }
  
  const { data: updated, error } = await supabase
    .from('announcements')
    .update(updatePayload)
    .eq('id', announcementId)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to update announcement: ${error.message}`);
  }
  
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/announcements');
  return updated;
}

export async function deleteAnnouncement(announcementId: string) {
  // Only admins and the author can delete announcements
  const { user } = await requireServerAuth();
  
  const supabase = await createSupabaseServer();
  
  // First check if user is admin or the author
  const { data: announcement } = await supabase
    .from('announcements')
    .select('author_id')
    .eq('id', announcementId)
    .single();
    
  if (!announcement) {
    throw new Error('Announcement not found');
  }
  
  const userRoles = user.user_metadata?.roles || [];
  const isAdmin = userRoles.includes('admin');
  const isAuthor = announcement.author_id === user.id;
  
  if (!isAdmin && !isAuthor) {
    throw new Error('Insufficient permissions to delete this announcement');
  }
  
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId);
    
  if (error) {
    throw new Error(`Failed to delete announcement: ${error.message}`);
  }
  
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/announcements');
  return { success: true };
}

export async function getClassData(classId: string) {
  // Teachers, principals, and admins can access class data
  const { user, session } = await requireServerClassAccess(classId);
  
  const supabase = await createSupabaseServer();
  
  const { data: classData, error } = await supabase
    .from('classes')
    .select(`
      *,
      children:children(*),
      announcements:announcements(*),
      menus:menus(*)
    `)
    .eq('id', classId)
    .single();
    
  if (error) {
    throw new Error(`Failed to fetch class data: ${error.message}`);
  }
  
  return classData;
}

export async function createMenu(data: {
  orgId: string;
  classId?: string;
  day: string;
  breakfast?: string;
  lunch?: string;
  snack?: string;
  notes?: string;
}) {
  // Only teachers, principals, and admins can create menus
  const { user } = await requireServerRoles(['teacher', 'principal', 'admin']);
  
  const supabase = await createSupabaseServer();
  
  const { data: menu, error } = await supabase
    .from('menus')
    .insert({
      org_id: data.orgId,
      class_id: data.classId,
      day: data.day,
      breakfast: data.breakfast,
      lunch: data.lunch,
      snack: data.snack,
      notes: data.notes,
      is_public: true,
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to create menu: ${error.message}`);
  }
  
  revalidatePath('/dashboard');
  return menu;
}

export async function getOrgUsers(orgId: string) {
  // Only principals and admins can view org users
  const { user } = await requireServerRoleLevel('principal');
  
  const supabase = await createSupabaseServer();
  
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, role_id, is_active, metadata')
    .eq('org_id', orgId);
    
  if (error) {
    throw new Error(`Failed to fetch org users: ${error.message}`);
  }
  
  return users;
}

export async function switchUserRole(newRole: SamveraRole) {
  // Users can only switch to roles they have
  const { user, session } = await requireServerAuth();
  
  const userRoles = user.user_metadata?.roles || [];
  
  if (!userRoles.includes(newRole)) {
    throw new Error(`You don't have the '${newRole}' role`);
  }
  
  const supabase = await createSupabaseServer();
  
  const { error } = await supabase.auth.updateUser({
    data: {
      activeRole: newRole,
    }
  });
  
  if (error) {
    throw new Error(`Failed to switch role: ${error.message}`);
  }
  
  // Redirect to the new role's dashboard
  const rolePaths = {
    teacher: '/dashboard/teacher',
    principal: '/dashboard/principal',
    parent: '/dashboard/parent',
    admin: '/dashboard/admin',
  };
  
  redirect(rolePaths[newRole]);
}

// Utility function to check permissions in server components
export async function hasPermission(requiredRole: SamveraRole): Promise<boolean> {
  try {
    await requireServerRole(requiredRole);
    return true;
  } catch {
    return false;
  }
}

export async function hasAnyPermission(requiredRoles: SamveraRole[]): Promise<boolean> {
  try {
    await requireServerRoles(requiredRoles);
    return true;
  } catch {
    return false;
  }
}

export async function hasMinimumPermission(minimumRole: SamveraRole): Promise<boolean> {
  try {
    await requireServerRoleLevel(minimumRole);
    return true;
  } catch {
    return false;
  }
}

// Notification server actions

export async function getNotifications(limit: number = 50, unreadOnly: boolean = false) {
  const { user } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const orgId = userMetadata?.org_id;
  
  if (!orgId) {
    throw new Error('Missing organization for user');
  }
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
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
  
  return notifications || [];
}

export async function getPaginatedNotifications(page: number = 1, limit: number = 10) {
  const { user } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const orgId = userMetadata?.org_id;
  
  if (!orgId) {
    throw new Error('Missing organization for user');
  }
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  const offset = (page - 1) * limit;
  
  // Get total count
  const { count, error: countError } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('org_id', orgId);
  
  if (countError) {
    throw new Error(`Failed to fetch notification count: ${countError.message}`);
  }
  
  // Get paginated notifications
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }
  
  return {
    notifications: notifications || [],
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
    currentPage: page,
  };
}

export async function markNotificationRead(notificationId: string) {
  const { user } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const orgId = userMetadata?.org_id;
  
  if (!orgId) {
    throw new Error('Missing organization for user');
  }
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .eq('org_id', orgId);
  
  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
  
  return { success: true };
}

export async function markAllNotificationsRead() {
  const { user } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const orgId = userMetadata?.org_id;
  
  if (!orgId) {
    throw new Error('Missing organization for user');
  }
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .eq('is_read', false);
  
  if (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
  
  return { success: true };
}

export async function deleteNotification(notificationId: string) {
  const { user } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const orgId = userMetadata?.org_id;
  
  if (!orgId) {
    throw new Error('Missing organization for user');
  }
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  // Verify the notification belongs to the user
  const { data: notification, error: fetchError } = await supabase
    .from('notifications')
    .select('id, user_id, org_id, is_read')
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .single();
  
  if (fetchError || !notification) {
    throw new Error('Notification not found or access denied');
  }
  
  // Delete the notification
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .eq('org_id', orgId);
  
  if (error) {
    throw new Error(`Failed to delete notification: ${error.message}`);
  }
  
  revalidatePath('/dashboard/notifications');
  return { success: true };
}

export async function deleteAllNotifications() {
  const { user } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const orgId = userMetadata?.org_id;
  
  if (!orgId) {
    throw new Error('Missing organization for user');
  }
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  // Delete all notifications for the user
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id)
    .eq('org_id', orgId);
  
  if (error) {
    throw new Error(`Failed to delete all notifications: ${error.message}`);
  }
  
  revalidatePath('/dashboard/notifications');
  return { success: true };
}

// ============================================================================
// Event Server Actions
// ============================================================================

export async function createEvent(data: {
  org_id: string;
  class_id?: string | null;
  title: string;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
}) {
  // Only principals and teachers can create events
  const { user, session } = await requireServerRoles(['principal', 'teacher']);
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  // Validate input
  const validation = createEventSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`);
  }
  
  const validatedData = validation.data;
  
  // Get org_id from user if not provided
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  let orgId = validatedData.org_id || userMetadata?.org_id;
  if (!orgId && supabaseAdmin) {
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle();
    orgId = (userRow as any)?.org_id as string | undefined;
  }
  if (!orgId) {
    throw new Error('Organization ID is required');
  }
  
  // For teachers, ensure they can only create class-based events for their assigned classes
  if (userMetadata?.activeRole === 'teacher' || userMetadata?.roles?.includes('teacher')) {
    if (!validatedData.class_id) {
      throw new Error('Teachers can only create class-based events');
    }
    
    // Verify teacher is assigned to this class
    const { data: membership } = await supabase
      .from('class_memberships')
      .select('id')
      .eq('class_id', validatedData.class_id)
      .eq('user_id', user.id)
      .eq('membership_role', 'teacher')
      .maybeSingle();
    
    if (!membership) {
      throw new Error('You are not assigned to this class');
    }
  }
  
  // Create event
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      org_id: orgId,
      class_id: validatedData.class_id || null,
      title: validatedData.title,
      description: validatedData.description || null,
      start_at: validatedData.start_at,
      end_at: validatedData.end_at || null,
      location: validatedData.location || null,
      created_by: user.id,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create event: ${error.message}`);
  }
  
  // Create notifications for target users
  try {
    let targetUserIds: string[] = [];
    let notificationType: NotificationType;
    
    if (validatedData.class_id) {
      // Class-specific event: notify assigned teachers + parents of students in class
      notificationType = 'event_created';
      targetUserIds = await getClassNotificationTargets(validatedData.class_id, orgId);
    } else {
      // Organization-wide event: notify all teachers + all parents
      notificationType = 'event_created';
      targetUserIds = await getOrgNotificationTargets(orgId);
    }
    
    // Exclude the creator from receiving notifications
    targetUserIds = targetUserIds.filter(id => id !== user.id);
    
    // Only create notifications if there are target users
    if (targetUserIds.length > 0 && event) {
      await createBulkNotifications(
        orgId,
        targetUserIds,
        notificationType,
        `New Event: ${validatedData.title}`,
        validatedData.description || `Event scheduled for ${new Date(validatedData.start_at).toLocaleDateString()}`,
        {
          event_id: event.id,
          class_id: validatedData.class_id,
          created_by: user.id,
        }
      );
    }
  } catch (notificationError) {
    // Log error but don't fail the event creation
    console.error('Failed to create notifications for event:', notificationError);
  }
  
  revalidatePath('/dashboard');
  return event;
}

export async function updateEvent(eventId: string, data: {
  title?: string;
  description?: string | null;
  start_at?: string;
  end_at?: string | null;
  location?: string | null;
  class_id?: string | null;
}) {
  // Only principals and teachers can update events
  const { user } = await requireServerRoles(['principal', 'teacher']);
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  // Get existing event to check permissions
  const { data: existingEvent, error: fetchError } = await supabase
    .from('events')
    .select('*, classes(name)')
    .eq('id', eventId)
    .is('deleted_at', null)
    .single();
  
  if (fetchError || !existingEvent) {
    throw new Error('Event not found');
  }
  
  const orgId = existingEvent.org_id;
  
  // Check permissions
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  if (userMetadata?.activeRole === 'teacher' || userMetadata?.roles?.includes('teacher')) {
    // Teachers can only update their class events
    if (!existingEvent.class_id) {
      throw new Error('Teachers cannot update organization-wide events');
    }
    
    // Verify teacher is assigned to this class
    const { data: membership } = await supabase
      .from('class_memberships')
      .select('id')
      .eq('class_id', existingEvent.class_id)
      .eq('user_id', user.id)
      .eq('membership_role', 'teacher')
      .maybeSingle();
    
    if (!membership) {
      throw new Error('You are not assigned to this class');
    }
    
    // Teachers cannot change class_id
    if (data.class_id !== undefined && data.class_id !== existingEvent.class_id) {
      throw new Error('Teachers cannot change event scope');
    }
  }
  
  // Validate update data
  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.start_at !== undefined) updateData.start_at = data.start_at;
  if (data.end_at !== undefined) updateData.end_at = data.end_at;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.class_id !== undefined && (userMetadata?.activeRole === 'principal' || userMetadata?.roles?.includes('principal'))) {
    updateData.class_id = data.class_id;
  }
  
  // Validate end_at is after start_at
  const startAt = updateData.start_at || existingEvent.start_at;
  const endAt = updateData.end_at !== undefined ? updateData.end_at : existingEvent.end_at;
  if (endAt && new Date(endAt) < new Date(startAt)) {
    throw new Error('End date must be after or equal to start date');
  }
  
  // Update event
  const { data: updatedEvent, error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update event: ${error.message}`);
  }
  
  // Create notifications for target users
  try {
    let targetUserIds: string[] = [];
    const finalClassId = updateData.class_id !== undefined ? updateData.class_id : existingEvent.class_id;
    
    if (finalClassId) {
      targetUserIds = await getClassNotificationTargets(finalClassId, orgId);
    } else {
      targetUserIds = await getOrgNotificationTargets(orgId);
    }
    
    // Exclude the updater from receiving notifications
    targetUserIds = targetUserIds.filter(id => id !== user.id);
    
    if (targetUserIds.length > 0 && updatedEvent) {
      await createBulkNotifications(
        orgId,
        targetUserIds,
        'event_updated',
        `Event Updated: ${updateData.title || existingEvent.title}`,
        `Event has been updated.${updateData.description ? ` ${updateData.description}` : ''}`,
        {
          event_id: updatedEvent.id,
          class_id: finalClassId,
          updated_by: user.id,
        }
      );
    }
  } catch (notificationError) {
    console.error('Failed to create notifications for event update:', notificationError);
  }
  
  revalidatePath('/dashboard');
  return updatedEvent;
}

export async function deleteEvent(eventId: string) {
  // Only principals and teachers can delete events
  const { user } = await requireServerRoles(['principal', 'teacher']);
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  // Get existing event to check permissions
  const { data: existingEvent, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .is('deleted_at', null)
    .single();
  
  if (fetchError || !existingEvent) {
    throw new Error('Event not found');
  }
  
  // Check permissions
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  if (userMetadata?.activeRole === 'teacher' || userMetadata?.roles?.includes('teacher')) {
    // Teachers can only delete their class events
    if (!existingEvent.class_id) {
      throw new Error('Teachers cannot delete organization-wide events');
    }
    
    // Verify teacher is assigned to this class
    const { data: membership } = await supabase
      .from('class_memberships')
      .select('id')
      .eq('class_id', existingEvent.class_id)
      .eq('user_id', user.id)
      .eq('membership_role', 'teacher')
      .maybeSingle();
    
    if (!membership) {
      throw new Error('You are not assigned to this class');
    }
  }
  
  // Soft delete
  const { error } = await supabase
    .from('events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', eventId);
  
  if (error) {
    throw new Error(`Failed to delete event: ${error.message}`);
  }
  
  revalidatePath('/dashboard');
  return { success: true };
}

export async function getEvents(orgId: string, options?: {
  classId?: string | null;
  startDate?: string;
  endDate?: string;
  userRole?: 'principal' | 'teacher' | 'parent';
  userId?: string;
}) {
  const { user } = await requireServerAuth();
  
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  // Build query
  let query = supabase
    .from('events')
    .select(`
      *,
      classes(name)
    `)
    .eq('org_id', orgId)
    .is('deleted_at', null);
  
  // Apply role-based filtering
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const role = options?.userRole || userMetadata?.activeRole || userMetadata?.roles?.[0];
  
  if (role === 'parent') {
    // Parents: only events for their child's class or org-wide
    if (options?.classId) {
      query = query.or(`class_id.eq.${options.classId},class_id.is.null`);
    } else {
      // If no classId provided, only show org-wide events
      query = query.is('class_id', null);
    }
  } else if (role === 'teacher') {
    // Teachers: events for their assigned classes or org-wide
    const userId = options?.userId || user.id;
    
    // Get teacher's assigned classes
    const { data: memberships } = await supabase
      .from('class_memberships')
      .select('class_id')
      .eq('user_id', userId)
      .eq('membership_role', 'teacher');
    
    const classIds = memberships?.map(m => m.class_id) || [];
    
    if (classIds.length > 0) {
      query = query.or(`class_id.in.(${classIds.join(',')}),class_id.is.null`);
    } else {
      // If no classes assigned, only show org-wide events
      query = query.is('class_id', null);
    }
  }
  // Principals can see all events (no additional filtering)
  
  // Apply date range filter
  if (options?.startDate) {
    query = query.gte('start_at', options.startDate);
  }
  if (options?.endDate) {
    query = query.lte('start_at', options.endDate);
  }
  
  // Order by start date
  query = query.order('start_at', { ascending: true });
  
  const { data: events, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }
  
  return events || [];
}

/**
 * Update user theme preference
 */
export async function updateUserTheme(theme: 'light' | 'dark' | 'system') {
  const { user } = await requireServerAuth();
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  const { error } = await supabase
    .from('users')
    .update({ theme })
    .eq('id', user.id);
  
  if (error) {
    throw new Error(`Failed to update theme: ${error.message}`);
  }
  
  return { success: true };
}

/**
 * Update user language preference
 */
export async function updateUserLanguage(language: 'en' | 'is') {
  const { user } = await requireServerAuth();
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  const { error } = await supabase
    .from('users')
    .update({ language })
    .eq('id', user.id);
  
  if (error) {
    throw new Error(`Failed to update language: ${error.message}`);
  }
  
  return { success: true };
}

/**
 * Get user preferences from database
 */
export async function getUserPreferences() {
  const { user } = await requireServerAuth();
  const supabase = supabaseAdmin ?? await createSupabaseServer();
  
  const { data, error } = await supabase
    .from('users')
    .select('theme, language')
    .eq('id', user.id)
    .maybeSingle();
  
  if (error) {
    throw new Error(`Failed to fetch preferences: ${error.message}`);
  }
  
  return {
    theme: (data?.theme as 'light' | 'dark' | 'system') || 'system',
    language: (data?.language as 'en' | 'is') || 'en',
  };
}