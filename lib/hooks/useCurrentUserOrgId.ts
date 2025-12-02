'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { type UserMetadata } from '@/lib/types/auth';

/**
 * Universal hook to resolve current user's organization ID from user metadata.
 * If org_id is missing from metadata, logs out user and redirects to login.
 */
export function useCurrentUserOrgId() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoggedOut, setHasLoggedOut] = useState(false);

  // Get org_id from metadata
  const userMetadata = session?.user?.user_metadata as UserMetadata | undefined;
  const orgId = userMetadata?.org_id;

  // Check if org_id is missing and handle logout
  useEffect(() => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    // If we have org_id from metadata, we're done
    if (orgId) {
      setIsLoading(false);
      return;
    }

    // Org ID not found in metadata - logout and redirect
    if (!hasLoggedOut) {
      setHasLoggedOut(true);
      setIsLoading(false);
      console.error('Organization ID not found in user metadata. Logging out user.');
      
      // Show error message before logout
      alert('Your account is missing organization information. Please contact support.');
      
      // Logout and redirect
      signOut().then(() => {
        router.push('/signin');
      });
    }
  }, [session?.user?.id, orgId, hasLoggedOut, signOut, router]);

  return {
    orgId: orgId || null,
    isLoading,
  };
}

// Export the old name for backward compatibility during migration
export { useCurrentUserOrgId as useTeacherOrgId };

