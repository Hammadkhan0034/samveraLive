import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type SamveraRole } from './auth';

export const createSupabaseServer = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};

// Server-side role validation helpers
export async function getServerUser() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, session: null, error };
  }
  // Optionally fetch session if needed downstream
  const { data: { session } } = await supabase.auth.getSession();
  return { user, session: session ?? null, error: null };
}

export async function requireServerAuth() {
  const { user, session, error } = await getServerUser();
  
  if (error || !user) {
    throw new Error('Authentication required');
  }
  
  return { user, session };
}

export async function requireServerRole(requiredRole: SamveraRole) {
  const { user, session } = await requireServerAuth();
  
  const userRoles = user.user_metadata?.roles || [];
  const activeRole = user.user_metadata?.activeRole;
  
  if (!userRoles.includes(requiredRole)) {
    throw new Error(`Role '${requiredRole}' required. User has roles: ${userRoles.join(', ')}`);
  }
  
  return { user, session, role: requiredRole, activeRole };
}

export async function requireServerRoles(requiredRoles: SamveraRole[]) {
  const { user, session } = await requireServerAuth();
  
  const userRoles = user.user_metadata?.roles || [];
  const activeRole = user.user_metadata?.activeRole;
  
  const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
  
  if (!hasRequiredRole) {
    throw new Error(`One of roles [${requiredRoles.join(', ')}] required. User has roles: ${userRoles.join(', ')}`);
  }
  
  return { user, session, roles: userRoles, activeRole };
}

// Role hierarchy validation (admin > principal > teacher > parent)
const ROLE_HIERARCHY: Record<SamveraRole, number> = {
  admin: 4,
  principal: 3,
  teacher: 2,
  parent: 1,
};

export async function requireServerRoleLevel(minimumRole: SamveraRole) {
  const { user, session } = await requireServerAuth();
  
  const userRoles = user.user_metadata?.roles || [];
  const activeRole = user.user_metadata?.activeRole;
  
  const userMaxLevel = Math.max(...userRoles.map((role: SamveraRole) => ROLE_HIERARCHY[role] || 0));
  const requiredLevel = ROLE_HIERARCHY[minimumRole];
  
  if (userMaxLevel < requiredLevel) {
    throw new Error(`Minimum role level '${minimumRole}' required. User max level: ${userMaxLevel}`);
  }
  
  return { user, session, roles: userRoles, activeRole, level: userMaxLevel };
}

// Organization/class scoped access
export async function requireServerOrgAccess(orgId: string) {
  const { user, session } = await requireServerAuth();
  
  const userOrgId = user.user_metadata?.org_id;
  
  if (userOrgId !== orgId) {
    throw new Error(`Access denied to organization ${orgId}`);
  }
  
  return { user, session, orgId };
}

export async function requireServerClassAccess(classId: string) {
  const { user, session } = await requireServerAuth();
  
  const userClassId = user.user_metadata?.class_id;
  const userOrgId = user.user_metadata?.org_id;
  
  // Teachers and principals can access their class
  const userRoles = user.user_metadata?.roles || [];
  const canAccessClass = userRoles.includes('teacher') || userRoles.includes('principal') || userRoles.includes('admin');
  
  if (!canAccessClass || (userClassId && userClassId !== classId)) {
    throw new Error(`Access denied to class ${classId}`);
  }
  
  return { user, session, classId, orgId: userOrgId };
}


