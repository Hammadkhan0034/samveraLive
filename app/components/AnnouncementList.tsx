'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/hooks/useAuth';

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author_id: string;
  class_id?: string;
  class_name?: string | null;
}

interface AnnouncementListProps {
  classId?: string;
  orgId?: string;
  userId?: string;
  userRole?: string;
  teacherClassIds?: string[]; // For teachers: all assigned class IDs
  showAuthor?: boolean;
  limit?: number;
  lang?: 'is' | 'en';
}

type Lang = 'is' | 'en';

export default function AnnouncementList({ 
  classId, 
  orgId, 
  userId,
  userRole,
  teacherClassIds,
  showAuthor = false, 
  limit = 10,
  lang = 'en'
}: AnnouncementListProps) {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false); // Start with false to avoid initial skeleton
  const [error, setError] = useState('');
  const [orgName, setOrgName] = useState<string | null>(null);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);

  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);

  const loadAnnouncements = useCallback(async () => {
    try {
      // Never show loading skeleton - we always show cached data instantly
      // Fresh data loads silently in background
      setError('');

      // Check if user is authenticated before making request
      if (!user) {
        console.warn('User not authenticated, skipping announcements load');
        // Keep existing announcements from cache, don't show error
        return;
      }

      const params = new URLSearchParams();
      if (classId) params.set('classId', classId);
      if (userId) params.set('userId', userId);
      if (userRole) params.set('userRole', userRole);
      if (teacherClassIds && teacherClassIds.length > 0) {
        params.set('teacherClassIds', teacherClassIds.join(','));
      }
      params.set('limit', String(limit));

      const res = await fetch(`/api/announcements?${params.toString()}`, { 
        cache: 'no-store',
        credentials: 'include' // Ensure cookies are sent
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        
        // Handle authentication errors gracefully - don't show error, just keep cached data
        if (res.status === 401) {
          console.warn('Authentication required for announcements, using cached data if available');
          // Don't set error, just return - keep existing announcements from cache
          return;
        }
        
        // For other errors, throw to show error message
        throw new Error(err.error || `Failed with ${res.status}`);
      }
      const { announcements: data } = await res.json();

      const normalized: Announcement[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        created_at: row.created_at,
        author_id: row.author_id,
        class_id: row.class_id ?? undefined,
        class_name: row.class_name || null,
      }));
      setAnnouncements(normalized);

      // Write-through cache for instant next render
      // Include userId and userRole in cache key for proper filtering
      try {
        const effectiveOrgId = orgId || (user?.user_metadata?.org_id || user?.user_metadata?.organization_id);
        const cacheKey = effectiveOrgId ? `announcements_${effectiveOrgId}_${classId || 'org'}_${userId || 'all'}_${userRole || 'all'}` : null;
        if (typeof window !== 'undefined' && cacheKey) {
          localStorage.setItem(cacheKey, JSON.stringify(normalized));
        }
      } catch {
        // ignore cache errors
      }
    } catch (err: any) {
      console.error('Failed to load announcements:', err);
      // Only set error for non-authentication errors
      if (err.message && !err.message.includes('Authentication required') && !err.message.includes('401')) {
        setError(t.failed_to_load);
      }
    } finally {
      setLoading(false);
    }
  }, [classId, orgId, userId, userRole, teacherClassIds, limit, t, user]);

  useEffect(() => {
    // Instant render from cache (no skeleton) and then refresh in background
    const effectiveOrgId = orgId || (user?.user_metadata?.org_id || user?.user_metadata?.organization_id);
    // Use same cache key format as loadAnnouncements
    const cacheKey = effectiveOrgId ? `announcements_${effectiveOrgId}_${classId || 'org'}_${userId || 'all'}_${userRole || 'all'}` : null;

    if (typeof window !== 'undefined' && cacheKey) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as Announcement[];
          if (Array.isArray(parsed)) {
            setAnnouncements(parsed);
            setLoading(false); // Ensure loading is false when we have cache
            setHydratedFromCache(true);
          }
        }
      } catch {
        // ignore cache errors
      }
    }

    // Only load fresh data if user is authenticated
    if (user) {
      // Load fresh data in background without showing loading
      loadAnnouncements();
    }
  }, [classId, orgId, userId, userRole, loadAnnouncements, user]);
  
  // Listen for custom event to refresh announcements
  useEffect(() => {
    const handleRefresh = () => {
      // Don't show loading skeleton when refreshing - just update in background
      // Keep hydratedFromCache true so we don't show skeleton
      loadAnnouncements();
    };
    
    window.addEventListener('announcements-refresh', handleRefresh);
    return () => {
      window.removeEventListener('announcements-refresh', handleRefresh);
    };
  }, [loadAnnouncements]);

  useEffect(() => {
    const effectiveOrgId = orgId || (user?.user_metadata?.org_id || user?.user_metadata?.organization_id);
    if (!effectiveOrgId) return;
    (async () => {
      try {
        const res = await fetch(`/api/orgs?ids=${encodeURIComponent(effectiveOrgId)}`, { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const { orgs } = await res.json();
          const found = Array.isArray(orgs) && orgs[0] ? orgs[0] : null;
          setOrgName(found?.name || null);
        }
      } catch {
        // ignore
      }
    })();
  }, [orgId, user?.user_metadata?.org_id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded w-1/2 mb-3"></div>
            <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded w-full"></div>
            <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded w-2/3 mt-1"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={loadAnnouncements}
          className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
        >
          {t.try_again}
        </button>
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6 text-center">
        <p className="text-gray-600 dark:text-slate-400">{t.no_announcements}</p>
        <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
          {classId ? t.class_announcements_note : t.org_announcements_note}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" suppressHydrationWarning>
      {announcements.map((announcement) => (
        <div key={announcement.id} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4" suppressHydrationWarning>
          <div className="flex items-center gap-3 overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 truncate flex-1 min-w-0">
              {announcement.title}
            </h3>
            {announcement.class_id ? (
              <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full text-xs whitespace-nowrap flex-shrink-0">
                {announcement.class_name || t.class_announcement}
              </span>
            ) : (
              <span className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-2 py-1 rounded-full text-xs whitespace-nowrap flex-shrink-0">
                {orgName || t.organization_wide}
              </span>
            )}
            <span className="text-sm text-gray-500 dark:text-slate-400 whitespace-nowrap flex-shrink-0">
              {formatDate(announcement.created_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

const enText = {
  failed_to_load: 'Failed to load announcements',
  try_again: 'Try again',
  no_announcements: 'No announcements yet.',
  class_announcements_note: 'Class announcements will appear here.',
  org_announcements_note: 'Organization announcements will appear here.',
  by: 'By',
  class_announcement: 'Class Announcement',
  organization_wide: 'Organization-wide',
};

const isText = {
  failed_to_load: 'Mistókst að hlaða tilkynningum',
  try_again: 'Reyna aftur',
  no_announcements: 'Engar tilkynningar enn.',
  class_announcements_note: 'Tilkynningar hóps munu birtast hér.',
  org_announcements_note: 'Tilkynningar stofnunar munu birtast hér.',
  by: 'Eftir',
  class_announcement: 'Tilkynning hóps',
  organization_wide: 'Alla stofnunina',
};
