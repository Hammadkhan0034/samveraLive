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
import { type SamveraRole } from './auth';
import { supabaseAdmin } from './supabaseClient';

// Example server actions with role gating

export async function createAnnouncement(data: {
  title: string;
  body: string;
  classId?: string;
  orgId?: string;
}) {
  // Only teachers, principals, and admins can create announcements
  const { user, session } = await requireServerRoles(['teacher', 'principal', 'admin']);
  
  const supabase = supabaseAdmin ?? createSupabaseServer();
  // Priority: explicit orgId -> user metadata -> admin users table -> class fallback
  let orgId = data.orgId || (user.user_metadata?.org_id as string | undefined) || (user.user_metadata?.organization_id as string | undefined);
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
  let classIdResolved = data.classId || (user.user_metadata?.class_id as string | undefined) || null;
  const userRoles: string[] = Array.isArray(user.user_metadata?.roles) ? user.user_metadata.roles : [];
  if (userRoles.includes('teacher') && !classIdResolved) {
    // Auto-provision a default class for this org and use it
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
  
  revalidatePath('/dashboard');
  return announcement;
}

export async function updateUserRole(userId: string, newRoles: SamveraRole[], activeRole?: SamveraRole) {
  // Only admins can update user roles
  const { user } = await requireServerRole('admin');
  
  const supabase = createSupabaseServer();
  
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      roles: newRoles,
      activeRole: activeRole || newRoles[0],
    }
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
  
  const supabase = supabaseAdmin ?? createSupabaseServer();
  
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
  const userOrgId = (user.user_metadata?.org_id as string | undefined) || (user.user_metadata?.organization_id as string | undefined);
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
  
  const supabase = createSupabaseServer();
  
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
  
  const supabase = createSupabaseServer();
  
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
  
  const supabase = createSupabaseServer();
  
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
  
  const supabase = createSupabaseServer();
  
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
  
  const supabase = createSupabaseServer();
  
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
