'use client';

import { useState, useEffect, useCallback } from 'react';
import { Megaphone } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import EmptyState from '@/app/components/EmptyState';

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
  userRole?: string;
  teacherClassIds?: string[]; // For teachers: all assigned class IDs
  showAuthor?: boolean;
  limit?: number;
  lang?: 'is' | 'en';
}


export default function AnnouncementList({ 
  classId,
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
  const [hydratedFromCache, setHydratedFromCache] = useState(false);

  const { t, lang: currentLang } = useLanguage();
  // Use lang prop if provided, otherwise use current language from context
  const effectiveLang = lang || currentLang;

  const loadAnnouncements = useCallback(async () => {
    try {
      setError('');

      // Check if user is authenticated before making request
      if (!user) {
        console.warn('User not authenticated, skipping announcements load');
        // Keep existing announcements from cache, don't show error
        return;
      }

      const params = new URLSearchParams();
      if (classId) params.set('classId', classId);
      if (userRole) params.set('userRole', userRole);
      if (teacherClassIds && teacherClassIds.length > 0) {
        params.set('teacherClassIds', teacherClassIds.join(','));
      }
      params.set('limit', String(limit));

      let res: Response;
      try {
        res = await fetch(`/api/announcements?${params.toString()}`, { 
          cache: 'no-store',
          credentials: 'include' // Ensure cookies are sent
        });
      } catch (fetchError: any) {
        // Handle network errors (fetch failed)
        console.error('❌ Network error fetching announcements:', fetchError);
        setError('Network error. Please check your connection and try again.');
        setLoading(false);
        return;
      }
      
      if (!res.ok) {
        // Handle authentication errors gracefully - don't show error, just keep cached data
        if (res.status === 401) {
          console.warn('Authentication required for announcements, using cached data if available');
          // Don't set error, just return - keep existing announcements from cache
          return;
        }
        
        // Try to parse error response, but handle cases where response might not be JSON
        let errorMessage = `Failed to load announcements (${res.status})`;
        try {
          const err = await res.json();
          if (err && typeof err === 'object' && 'error' in err) {
            errorMessage = err.error || errorMessage;
          }
        } catch {
          // If JSON parsing fails, try to get text response
          try {
            const text = await res.text();
            if (text) {
              errorMessage = text;
            }
          } catch {
            // If all else fails, use default error message
          }
        }
        
        // Check if error is authentication-related and handle gracefully
        const authErrorKeywords = [
          'authentication',
          'auth',
          'unauthorized',
          'unauthenticated',
          'session',
          'login',
          'token'
        ];
        const isAuthError = authErrorKeywords.some(keyword => 
          errorMessage.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (isAuthError) {
          // For authentication-related errors, silently fail and keep cached data
          console.warn('Authentication error loading announcements, using cached data if available:', errorMessage);
          // Don't set error, just return - keep existing announcements from cache
          return;
        }
        
        // For other errors, set error but don't throw - keep existing data
        console.error('❌ Error loading announcements:', errorMessage);
        setError(errorMessage);
        setLoading(false);
        return;
      }
      
      let data: any;
      try {
        const json = await res.json();
        data = json.announcements || [];
      } catch (parseError) {
        console.error('❌ Error parsing announcements response:', parseError);
        setError('Invalid response from server');
        setLoading(false);
        return;
      }

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
      // Include role and class-based filters in cache key for proper filtering
      try {
        const cacheKey = `announcements_${classId || 'org'}_${userRole || 'all'}_${teacherClassIds?.join('-') || 'none'}`;
        if (typeof window !== 'undefined') {
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
  }, [classId, userRole, teacherClassIds, limit, t, user]);

  useEffect(() => {
    // Instant render from cache (no skeleton) and then refresh in background
    const cacheKey = `announcements_${classId || 'org'}_${userRole || 'all'}_${teacherClassIds?.join('-') || 'none'}`;

    if (typeof window !== 'undefined') {
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
  }, [classId, userRole, teacherClassIds, loadAnnouncements, user]);
  
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(effectiveLang === 'is' ? 'is-IS' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3 sm:p-4 animate-pulse">
            <div className="h-3 sm:h-4 bg-gray-200 dark:bg-slate-600 rounded w-3/4 mb-2"></div>
            <div className="h-2.5 sm:h-3 bg-gray-200 dark:bg-slate-600 rounded w-1/2 mb-2 sm:mb-3"></div>
            <div className="h-2.5 sm:h-3 bg-gray-200 dark:bg-slate-600 rounded w-full"></div>
            <div className="h-2.5 sm:h-3 bg-gray-200 dark:bg-slate-600 rounded w-2/3 mt-1"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4">
        <p className="text-ds-tiny sm:text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={loadAnnouncements}
          className="mt-2 text-ds-tiny sm:text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline active:text-red-900"
        >
          {t.try_again}
        </button>
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title={t.no_announcements_title}
        description={t.no_announcements_description}
      />
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4" suppressHydrationWarning>
      {announcements.map((announcement) => (
        <div key={announcement.id} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3 sm:p-4" suppressHydrationWarning>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 overflow-hidden">
            <h3 className="text-ds-small sm:text-lg font-semibold text-gray-900 dark:text-slate-100 truncate flex-1 min-w-0">
              {announcement.title}
            </h3>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {announcement.class_id ? (
                <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full text-ds-tiny sm:text-xs whitespace-nowrap flex-shrink-0">
                  {announcement.class_name || t.class_announcement}
                </span>
              ) : (
                <span className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-2 py-1 rounded-full text-ds-tiny sm:text-xs whitespace-nowrap flex-shrink-0">
                  {t.organization_wide}
                </span>
              )}
              <span className="text-ds-tiny sm:text-sm text-gray-500 dark:text-slate-400 whitespace-nowrap flex-shrink-0">
                {formatDate(announcement.created_at)}
              </span>
            </div>
          </div>
          {announcement.body && (
            <p className="mt-2 sm:mt-3 text-ds-tiny sm:text-sm text-gray-600 dark:text-slate-400 line-clamp-2 sm:line-clamp-none">
              {announcement.body}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// Translations removed - using centralized translations from @/lib/translations
