'use client';

import { useAuth as useAuthContext } from '../auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { type SamveraRole } from '../auth';

export function useAuth() {
  return useAuthContext();
}

export function useRequireAuth(requiredRole?: SamveraRole) {
  const { user, loading, session, isSigningIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
      return;
    }

    if (user && requiredRole) {
      // Check user metadata from user object first, then session
      const userRoles = user.user_metadata?.roles || session?.user?.user_metadata?.roles;
      const activeRole = user.user_metadata?.activeRole || session?.user?.user_metadata?.activeRole;
      
      if (userRoles && !userRoles.includes(requiredRole)) {
        // If user doesn't have required role, redirect to their default dashboard
        const defaultRole = activeRole || userRoles[0];
        const path = defaultRole === 'principal'
          ? '/dashboard/principal'
          : defaultRole === 'teacher'
          ? '/dashboard/teacher'
          : defaultRole === 'admin'
          ? '/dashboard/admin'
          : '/dashboard/parent';
        router.push(path);
        return;
      }
    }
  }, [user, loading, requiredRole, router, session]);

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
