'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type SamveraRole, type UserMetadata } from './types/auth';
import { supabaseAdmin } from './supabaseClient';
import { type DeviceTokenProvider } from './services/deviceTokens';
import { createEventSchema } from './validation';
import type { z } from 'zod';
import { getRequestAuthContext, MissingOrgIdError } from './server-helpers';
import {
  handleCreateAnnouncement,
  handleUpdateAnnouncement,
  handleDeleteAnnouncement,
  handleUpdateUserRole,
  handleSwitchUserRole,
  handleGetClassData,
  handleCreateMenu,
  handleGetOrgUsers,
  handleGetNotifications,
  handleGetPaginatedNotifications,
  handleMarkNotificationRead,
  handleMarkAllNotificationsRead,
  handleDeleteNotification,
  handleDeleteAllNotifications,
  handleCreateEvent,
  handleUpdateEvent,
  handleDeleteEvent,
  handleGetEvents,
  handleUpdateUserTheme,
  handleUpdateUserLanguage,
  handleGetUserPreferences,
  handleRegisterDeviceToken,
  handleUnregisterDeviceToken,
} from './handlers/server_actions_handler';

// Example server actions with role gating

export async function createAnnouncement(data: {
  title: string;
  body: string;
  classId?: string;
}) {
  const { user } = await getRequestAuthContext({
    allowedRoles: ['teacher', 'principal', 'admin'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const announcement = await handleCreateAnnouncement(user, supabaseAdmin, data);
  
  revalidatePath('/dashboard');
  return announcement;
}

export async function updateUserRole(userId: string, newRoles: SamveraRole[], activeRole?: SamveraRole) {
  const { user } = await getRequestAuthContext({
    allowedRoles: ['admin'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const result = await handleUpdateUserRole(user, supabaseAdmin, userId, newRoles, activeRole);
  
  revalidatePath('/dashboard/admin');
  return result;
}

export async function updateAnnouncement(announcementId: string, data: {
  title: string;
  body: string;
  classId?: string;
}) {
  const { user } = await getRequestAuthContext({
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const updated = await handleUpdateAnnouncement(user, supabaseAdmin, announcementId, data);
  
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/announcements');
  return updated;
}

export async function deleteAnnouncement(announcementId: string) {
  const { user } = await getRequestAuthContext({
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const result = await handleDeleteAnnouncement(user, supabaseAdmin, announcementId);
  
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/announcements');
  return result;
}

export async function getClassData(classId: string) {
  const { user } = await getRequestAuthContext({
    allowedRoles: ['teacher', 'principal', 'admin'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  // Verify user has access to this class
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const userRoles = userMetadata?.roles || [];
  const canAccessClass = userRoles.includes('teacher') || userRoles.includes('principal') || userRoles.includes('admin');
  
  if (!canAccessClass) {
    throw new Error(`Access denied to class ${classId}`);
  }
  
  return await handleGetClassData(user, supabaseAdmin, classId);
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
  const { user } = await getRequestAuthContext({
    allowedRoles: ['teacher', 'principal', 'admin'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const menu = await handleCreateMenu(user, supabaseAdmin, data);
  
  revalidatePath('/dashboard');
  return menu;
}

export async function getOrgUsers(orgId: string) {
  const { user } = await getRequestAuthContext({
    allowedRoles: ['principal', 'admin'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  return await handleGetOrgUsers(user, supabaseAdmin, orgId);
}

export async function switchUserRole(newRole: SamveraRole) {
  const { user } = await getRequestAuthContext({
    requireOrg: false,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  await handleSwitchUserRole(user, supabaseAdmin, newRole);
  
  // Redirect to the new role's dashboard
  const rolePaths = {
    teacher: '/dashboard/teacher',
    principal: '/dashboard/principal',
    guardian: '/dashboard/guardian',
    admin: '/dashboard/admin',
  };
  
  redirect(rolePaths[newRole]);
}

// Utility function to check permissions in server components
export async function hasPermission(requiredRole: SamveraRole): Promise<boolean> {
  try {
    await getRequestAuthContext({
      allowedRoles: [requiredRole],
      requireOrg: false,
    });
    return true;
  } catch {
    return false;
  }
}

export async function hasAnyPermission(requiredRoles: SamveraRole[]): Promise<boolean> {
  try {
    await getRequestAuthContext({
      allowedRoles: requiredRoles,
      requireOrg: false,
    });
    return true;
  } catch {
    return false;
  }
}

export async function hasMinimumPermission(minimumRole: SamveraRole): Promise<boolean> {
  try {
    // Map role hierarchy: admin > principal > teacher > guardian
    const roleHierarchy: Record<SamveraRole, SamveraRole[]> = {
      admin: ['admin'],
      principal: ['principal', 'admin'],
      teacher: ['teacher', 'principal', 'admin'],
      guardian: ['guardian', 'teacher', 'principal', 'admin'],
    };
    
    await getRequestAuthContext({
      allowedRoles: roleHierarchy[minimumRole],
      requireOrg: false,
    });
    return true;
  } catch {
    return false;
  }
}

// Notification server actions

export async function getNotifications(limit: number = 50, unreadOnly: boolean = false) {
  const { user } = await getRequestAuthContext({
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  return await handleGetNotifications(user, supabaseAdmin, limit, unreadOnly);
}

export async function getPaginatedNotifications(page: number = 1, limit: number = 10) {
  const { user } = await getRequestAuthContext({
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  return await handleGetPaginatedNotifications(user, supabaseAdmin, page, limit);
}

export async function markNotificationRead(notificationId: string) {
  const { user } = await getRequestAuthContext({
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  return await handleMarkNotificationRead(user, supabaseAdmin, notificationId);
}

export async function markAllNotificationsRead() {
  const { user } = await getRequestAuthContext({
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  return await handleMarkAllNotificationsRead(user, supabaseAdmin);
}

export async function deleteNotification(notificationId: string) {
  const { user } = await getRequestAuthContext({
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const result = await handleDeleteNotification(user, supabaseAdmin, notificationId);
  
  revalidatePath('/dashboard/notifications');
  return result;
}

export async function deleteAllNotifications() {
  const { user } = await getRequestAuthContext({
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const result = await handleDeleteAllNotifications(user, supabaseAdmin);
  
  revalidatePath('/dashboard/notifications');
  return result;
}

// ============================================================================
// Event Server Actions
// ============================================================================

export async function createEvent(data: z.infer<typeof createEventSchema>) {
  const { user } = await getRequestAuthContext({
    allowedRoles: ['principal', 'teacher'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const event = await handleCreateEvent(user, supabaseAdmin, data);
  
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
  const { user } = await getRequestAuthContext({
    allowedRoles: ['principal', 'teacher'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const updatedEvent = await handleUpdateEvent(user, supabaseAdmin, eventId, data);
  
  revalidatePath('/dashboard');
  return updatedEvent;
}

export async function deleteEvent(eventId: string) {
  const { user } = await getRequestAuthContext({
    allowedRoles: ['principal', 'teacher'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const result = await handleDeleteEvent(user, supabaseAdmin, eventId);
  
  revalidatePath('/dashboard');
  return result;
}

export async function getEvents(options?: {
  classId?: string | null;
  startDate?: string;
  endDate?: string;
}) {
  const { user } = await getRequestAuthContext({
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  return await handleGetEvents(user, supabaseAdmin, options);
}

/**
 * Update user theme preference
 */
export async function updateUserTheme(theme: 'light' | 'dark' | 'system') {
  const { user } = await getRequestAuthContext({
    requireOrg: false,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  return await handleUpdateUserTheme(user, supabaseAdmin, theme);
}

/**
 * Update user language preference
 */
export async function updateUserLanguage(language: 'en' | 'is') {
  const { user } = await getRequestAuthContext({
    requireOrg: false,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  return await handleUpdateUserLanguage(user, supabaseAdmin, language);
}

/**
 * Get user preferences from database
 */
export async function getUserPreferences() {
  const { user } = await getRequestAuthContext({
    requireOrg: false,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  return await handleGetUserPreferences(user, supabaseAdmin);
}

/**
 * Register a device token for push notifications
 */
export async function registerDeviceTokenAction(
  token: string,
  provider: DeviceTokenProvider = 'fcm'
) {
  const { user } = await getRequestAuthContext({
    requireOrg: false,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }

  return await handleRegisterDeviceToken(user, supabaseAdmin, token, provider);
}

/**
 * Unregister a device token (remove it from push notifications)
 */
export async function unregisterDeviceTokenAction(
  token: string,
  provider?: DeviceTokenProvider
) {
  const { user } = await getRequestAuthContext({
    requireOrg: false,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }

  return await handleUnregisterDeviceToken(user, supabaseAdmin, token, provider);
}