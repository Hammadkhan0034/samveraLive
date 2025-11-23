import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type SamveraRole, type UserMetadata } from './auth';

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
  
  // Check if it's a network/fetch error (retryable) vs auth error
  if (error) {
    const isNetworkError = error.message?.includes('fetch failed') || 
                           error.message?.includes('timeout') ||
                           error.name === 'AuthRetryableFetchError' ||
                           error.status === 0;
    
    if (isNetworkError) {
      // For network errors, try to get session from cookies as fallback
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        return { user: session.user, session, error: null };
      }
      // If session also fails, return network error
      return { user: null, session: null, error: { ...error, isNetworkError: true } };
    }
  }
  
  if (error || !user) {
    return { user: null, session: null, error };
  }
  
  // User is authenticated via getUser() - session is not needed for authentication
  // If session is required downstream, it can be fetched separately
  return { user, session: null, error: null };
}

export async function requireServerAuth() {
  const { user, session, error } = await getServerUser();
  
  if (error) {
    // If it's a network error, don't throw - allow request to continue
    // Client-side will handle retry
    if ((error as any).isNetworkError) {
      throw new Error('Network error - please retry');
    }
    throw new Error('Authentication required');
  }
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return { user, session };
}

export async function requireServerRole(requiredRole: SamveraRole) {
  const { user, session } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const userRoles = userMetadata?.roles || [];
  const activeRole = userMetadata?.activeRole;
  
  if (!userRoles.includes(requiredRole)) {
    throw new Error(`Role '${requiredRole}' required. User has roles: ${userRoles.join(', ')}`);
  }
  
  return { user, session, role: requiredRole, activeRole };
}

export async function requireServerRoles(requiredRoles: SamveraRole[]) {
  const { user, session } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const userRoles = userMetadata?.roles || [];
  const activeRole = userMetadata?.activeRole;
  
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
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const userRoles = userMetadata?.roles || [];
  const activeRole = userMetadata?.activeRole;
  
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
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const userOrgId = userMetadata?.org_id;
  
  if (userOrgId !== orgId) {
    throw new Error(`Access denied to organization ${orgId}`);
  }
  
  return { user, session, orgId };
}

export async function requireServerClassAccess(classId: string) {
  const { user, session } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const userClassId = userMetadata?.class_id;
  const userOrgId = userMetadata?.org_id;
  
  // Teachers and principals can access their class
  const userRoles = userMetadata?.roles || [];
  const canAccessClass = userRoles.includes('teacher') || userRoles.includes('principal') || userRoles.includes('admin');
  
  if (!canAccessClass || (userClassId && userClassId !== classId)) {
    throw new Error(`Access denied to class ${classId}`);
  }
  
  return { user, session, classId, orgId: userOrgId };
}


