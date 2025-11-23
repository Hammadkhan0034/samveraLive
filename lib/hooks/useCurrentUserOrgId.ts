'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * Universal hook to resolve current user's organization ID from multiple sources.
 * Tries metadata first (fastest, no API call), then falls back to API if needed.
 * If org_id is missing from both sources, logs out user and redirects to login.
 */
export function useCurrentUserOrgId() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [dbOrgId, setDbOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoggedOut, setHasLoggedOut] = useState(false);

  // Try to get org_id from metadata first (fastest, no API call)
  const userMetadata = session?.user?.user_metadata;
  const orgIdFromMetadata = 
    userMetadata?.org_id || 
    userMetadata?.organization_id || 
    userMetadata?.orgId;

  // Fetch org_id from database if not in metadata
  useEffect(() => {
    const fetchOrgId = async () => {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      // If we have org_id from metadata, we're done
      if (orgIdFromMetadata) {
        setIsLoading(false);
        return;
      }

      // Otherwise, fetch from API
      try {
        setIsLoading(true);
        const response = await fetch(`/api/user-org-id?user_id=${session.user.id}`);
        const data = await response.json();
        
        if (response.ok && data.org_id) {
          setDbOrgId(data.org_id);
          setIsLoading(false);
        } else if (response.status === 401 && data.code === 'MISSING_ORG_ID') {
          // Org ID not found - logout and redirect
          if (!hasLoggedOut) {
            setHasLoggedOut(true);
            console.error('Organization ID not found. Logging out user.');
            
            // Show error message before logout
            alert('Your account is missing organization information. Please contact support.');
            
            // Logout and redirect
            await signOut();
            router.push('/signin');
          }
        } else {
          console.error('Failed to fetch user org_id:', data);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch user org_id:', error);
        setIsLoading(false);
      }
    };

    fetchOrgId();
  }, [session?.user?.id, orgIdFromMetadata, hasLoggedOut, signOut, router]);

  // Final org_id to use - from metadata, database, or null if missing
  const orgId = orgIdFromMetadata || dbOrgId;

  return {
    orgId,
    isLoading,
  };
}

// Export the old name for backward compatibility during migration
export { useCurrentUserOrgId as useTeacherOrgId };

