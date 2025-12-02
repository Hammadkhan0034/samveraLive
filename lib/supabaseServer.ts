import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type SamveraRole, type UserMetadata } from './auth';
import type { AuthUser } from './types/auth';
import { AuthRequiredError, NetworkAuthError } from './auth-errors';

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

export type ServerAuthError = ({ isNetworkError?: boolean } & {
  message: string;
  name?: string;
  status?: number;
}) | null;

export type ServerAuthResult = {
  user: AuthUser | null;
  error: ServerAuthError;
};

// Server-side role validation helpers
export async function getServerUser(): Promise<ServerAuthResult> {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  // Check if it's a network/fetch error (retryable) vs auth error
  if (error) {
    const isNetworkError = error.message?.includes('fetch failed') || 
                           error.message?.includes('timeout') ||
                           error.name === 'AuthRetryableFetchError' ||
                           error.status === 0;
    
    if (isNetworkError) {
      // For network errors, we currently surface a structured error so callers
      // can distinguish retryable auth failures from regular auth errors.
      return {
        user: null,
        error: {
          message: error.message,
          name: error.name,
          status: (error as any).status,
          isNetworkError: true,
        },
      };
    }
  }
  
  if (error || !user) {
    return error
      ? {
          user: null,
          error: {
            message: error.message,
            name: error.name,
            status: (error as any).status,
          },
        }
      : { user: null, error: null };
  }
  
  // User is authenticated via getUser() - session is not needed for authentication
  // If session is required downstream, it can be fetched separately
  return { user: user as unknown as AuthUser, error: null };
}

export async function requireServerAuth(): Promise<{ user: AuthUser }> {
  const { user, error } = await getServerUser();
  
  if (error) {
    if (error.isNetworkError) {
      throw new NetworkAuthError();
    }
    throw new AuthRequiredError();
  }
  
  if (!user) {
    throw new AuthRequiredError();
  }
  
  return { user };
}

export async function requireServerRole(requiredRole: SamveraRole) {
  const { user } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const userRoles = userMetadata?.roles || [];
  const activeRole = userMetadata?.activeRole;
  
  if (!userRoles.includes(requiredRole)) {
    throw new Error(`Role '${requiredRole}' required. User has roles: ${userRoles.join(', ')}`);
  }
  
  return { user, role: requiredRole, activeRole };
}

export async function requireServerRoles(requiredRoles: SamveraRole[]) {
  const { user } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const userRoles = userMetadata?.roles || [];
  const activeRole = userMetadata?.activeRole;
  
  const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
  
  if (!hasRequiredRole) {
    throw new Error(`One of roles [${requiredRoles.join(', ')}] required. User has roles: ${userRoles.join(', ')}`);
  }
  
  return { user, roles: userRoles, activeRole };
}

// Role hierarchy validation (admin > principal > teacher > parent)
const ROLE_HIERARCHY: Record<SamveraRole, number> = {
  admin: 4,
  principal: 3,
  teacher: 2,
  parent: 1,
};

export async function requireServerRoleLevel(minimumRole: SamveraRole) {
  const { user } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const userRoles = userMetadata?.roles || [];
  const activeRole = userMetadata?.activeRole;
  
  const userMaxLevel = Math.max(...userRoles.map((role: SamveraRole) => ROLE_HIERARCHY[role] || 0));
  const requiredLevel = ROLE_HIERARCHY[minimumRole];
  
  if (userMaxLevel < requiredLevel) {
    throw new Error(`Minimum role level '${minimumRole}' required. User max level: ${userMaxLevel}`);
  }
  
  return { user, roles: userRoles, activeRole, level: userMaxLevel };
}

// Organization/class scoped access
export async function requireServerOrgAccess(orgId: string) {
  const { user } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  const userOrgId = userMetadata?.org_id;
  
  if (userOrgId !== orgId) {
    throw new Error(`Access denied to organization ${orgId}`);
  }
  
  return { user, orgId };
}

export async function requireServerClassAccess(classId: string) {
  const { user } = await requireServerAuth();
  
  const userMetadata = user.user_metadata as UserMetadata | undefined;
  // class_id is no longer in UserMetadata, access it directly from user_metadata if needed
  const userClassId = (user.user_metadata as any)?.class_id;
  const userOrgId = userMetadata?.org_id;
  
  // Teachers and principals can access their class
  const userRoles = userMetadata?.roles || [];
  const canAccessClass = userRoles.includes('teacher') || userRoles.includes('principal') || userRoles.includes('admin');
  
  if (!canAccessClass || (userClassId && userClassId !== classId)) {
    throw new Error(`Access denied to class ${classId}`);
  }
  
  return { user, classId, orgId: userOrgId };
}


