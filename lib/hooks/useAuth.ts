'use client';

import { useAuth as useAuthContext } from '../auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { type SamveraRole } from '../auth';

export function useAuth() {
  return useAuthContext();
}

export function useRequireAuth(requiredRole?: SamveraRole | SamveraRole[]) {
  const { user, loading, session, isSigningIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect if we're still loading or signing in
    if (loading || isSigningIn) {
      return;
    }

    // Check if there was a recent rate limit error - if so, wait a bit longer
    const rateLimitErrorTime = typeof window !== 'undefined' 
      ? sessionStorage.getItem('supabase_rate_limit_error') 
      : null;
    
    if (rateLimitErrorTime) {
      const errorTime = parseInt(rateLimitErrorTime, 10);
      const timeSinceError = Date.now() - errorTime;
      // If rate limit error was very recent (within 2 seconds), wait a bit before redirecting
      if (timeSinceError < 2000) {
        return;
      }
    }

    // Only redirect if we're sure there's no user (not loading and not signing in)
    if (!user) {
      router.push('/signin');
      return;
    }

    if (user && requiredRole) {
      // Check user metadata from user object first, then session
      const userRoles = user.user_metadata?.roles || session?.user?.user_metadata?.roles || [];
      const activeRole = user.user_metadata?.activeRole || session?.user?.user_metadata?.activeRole;
      
      // If we have roles or activeRole, check them
      if (userRoles.length > 0 || activeRole) {
        const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        
        // Check if user has any of the required roles
        const hasAnyRequired = userRoles.length > 0 
          ? required.some((r) => (userRoles as SamveraRole[]).includes(r))
          : false;
        
        // Also check activeRole as fallback
        const hasActiveRole = activeRole && required.includes(activeRole as SamveraRole);
        
        if (!hasAnyRequired && !hasActiveRole) {
          const defaultRole = activeRole || (userRoles.length > 0 ? userRoles[0] : null);
          if (defaultRole) {
            const path = defaultRole === 'principal'
              ? '/dashboard/principal'
              : defaultRole === 'teacher'
              ? '/dashboard/teacher'
              : defaultRole === 'admin'
              ? '/dashboard/admin'
              : '/dashboard/guardian';
            router.push(path);
            return;
          }
        }
      } else {
        // If no roles are set yet, but user exists, allow access (roles might be loading)
        // This prevents premature redirects when metadata is still being fetched
        console.log('⚠️ User exists but roles not yet loaded, allowing access temporarily');
      }
    }
  }, [user, loading, requiredRole, router, session, isSigningIn]);

  return { user, loading, session, isSigningIn };
}

export function useUserRole(): SamveraRole | null {
  const { session } = useAuth();
  
  if (!session?.user?.user_metadata?.activeRole) {
    return null;
  }
  
  return session.user.user_metadata.activeRole as SamveraRole;
}

export function useUserRoles(): SamveraRole[] {
  const { session } = useAuth();
  
  if (!session?.user?.user_metadata?.roles) {
    return [];
  }
  
  return session.user.user_metadata.roles as SamveraRole[];
}
