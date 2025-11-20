'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * Hook to resolve teacher's organization ID from multiple sources
 * Tries metadata first, then database, then falls back to default
 */
export function useTeacherOrgId() {
  const { session } = useAuth();
  const [dbOrgId, setDbOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Try to get org_id from metadata
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

      // Otherwise, fetch from database
      try {
        setIsLoading(true);
        const response = await fetch(`/api/user-org-id?user_id=${session.user.id}`);
        const data = await response.json();
        
        if (response.ok && data.org_id) {
          setDbOrgId(data.org_id);
        }
      } catch (error) {
        console.error('Failed to fetch user org_id:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrgId();
  }, [session?.user?.id, orgIdFromMetadata]);

  // Final org_id to use - from metadata, database, or default
  const orgId = 
    orgIdFromMetadata || 
    dbOrgId || 
    process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 
    '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

  return {
    orgId,
    isLoading,
  };
}

