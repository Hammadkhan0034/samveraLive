'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import { type SamveraRole, type UserMetadata } from '@/lib/types/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { type DeviceTokenProvider } from '@/lib/services/deviceTokens';
import { createEventSchema, updateEventSchema } from '@/lib/validation';
import { createAnnouncementSchema, updateAnnouncementSchema } from '@/lib/validation/announcements';
import { postMenuBodySchema } from '@/lib/validation/menus';
import { getRequestAuthContext, MissingOrgIdError } from '@/lib/server-helpers';
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
} from '@/lib/handlers/server_actions_handler';

// Example server actions with role gating

export async function createAnnouncement(data: z.infer<typeof createAnnouncementSchema>) {
  const { user } = await getRequestAuthContext({
    allowedRoles: ['teacher', 'principal', 'admin'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const announcement = await handleCreateAnnouncement(user, supabaseAdmin, data);
  
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/principal/announcements');
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

export async function updateAnnouncement(announcementId: string, data: z.infer<typeof updateAnnouncementSchema>) {
  const { user } = await getRequestAuthContext({
    allowedRoles: ['teacher', 'principal', 'admin'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const updated = await handleUpdateAnnouncement(user, supabaseAdmin, announcementId, data);
  
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/principal/announcements');
  return updated;
}

export async function deleteAnnouncement(announcementId: string) {
  const { user } = await getRequestAuthContext({
    allowedRoles: ['teacher', 'principal', 'admin'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const result = await handleDeleteAnnouncement(user, supabaseAdmin, announcementId);
  
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/principal/announcements');
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
  
  return await handleGetClassData(user, supabaseAdmin, classId);
}

export async function createMenu(data: z.infer<typeof postMenuBodySchema> & { orgId: string }) {
  const { user } = await getRequestAuthContext({
    allowedRoles: ['teacher', 'principal', 'admin'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const menu = await handleCreateMenu(user, supabaseAdmin, data);
  
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/menus');
  revalidatePath('/dashboard/menus-list');
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
  const rolePaths: Record<SamveraRole, string> = {
    teacher: '/dashboard/teacher',
    principal: '/dashboard/principal',
    guardian: '/dashboard/guardian',
    admin: '/dashboard/admin',
    parent: '/dashboard/guardian', // parent is an alias for guardian
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
    // Map role hierarchy: admin > principal > teacher > guardian/parent
    const roleHierarchy: Record<SamveraRole, SamveraRole[]> = {
      admin: ['admin'],
      principal: ['principal', 'admin'],
      teacher: ['teacher', 'principal', 'admin'],
      guardian: ['guardian', 'teacher', 'principal', 'admin'],
      parent: ['parent', 'guardian', 'teacher', 'principal', 'admin'], // parent is equivalent to guardian
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
  revalidatePath('/dashboard/calendar');
  return event;
}

export async function updateEvent(eventId: string, data: z.infer<typeof updateEventSchema>) {
  const { user } = await getRequestAuthContext({
    allowedRoles: ['principal', 'teacher'],
    requireOrg: true,
  });
  
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }
  
  const updatedEvent = await handleUpdateEvent(user, supabaseAdmin, eventId, data);
  
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/calendar');
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
  revalidatePath('/dashboard/calendar');
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