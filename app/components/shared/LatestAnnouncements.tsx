'use client';

import { useState, useEffect, useCallback } from 'react';
import { Megaphone } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useUserRole } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { type Announcement } from '@/lib/types/announcements';
import EmptyState from '@/app/components/EmptyState';

interface LatestAnnouncementsProps {
  className?: string;
  lang?: 'is' | 'en';
  showTitle?: boolean;
}

export default function LatestAnnouncements({
  className = '',
  lang,
  showTitle = true,
}: LatestAnnouncementsProps) {
  const { user } = useAuth();
  const userRole = useUserRole();
  const { t, lang: currentLang } = useLanguage();
  const effectiveLang = lang || currentLang;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hydratedFromCache, setHydratedFromCache] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    try {
      setError('');

      // Check if user is authenticated before making request
      if (!user) {
        console.warn('User not authenticated, skipping announcements load');
        return;
      }

      const params = new URLSearchParams();
      if (userRole) {
        params.set('userRole', userRole);
      }
      params.set('limit', '5');

      let res: Response;
      try {
        res = await fetch(`/api/announcements?${params.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
        });
      } catch (fetchError: any) {
        console.error('❌ Network error fetching announcements:', fetchError);
        setError('Network error. Please check your connection and try again.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        // Handle authentication errors gracefully
        if (res.status === 401) {
          console.warn('Authentication required for announcements, using cached data if available');
          return;
        }

        // Try to parse error response
        let errorMessage = `Failed to load announcements (${res.status})`;
        try {
          const err = await res.json();
          if (err && typeof err === 'object' && 'error' in err) {
            errorMessage = err.error || errorMessage;
          }
        } catch {
          try {
            const text = await res.text();
            if (text) {
              errorMessage = text;
            }
          } catch {
            // Use default error message
          }
        }

        // Check if error is authentication-related
        const authErrorKeywords = [
          'authentication',
          'auth',
          'unauthorized',
          'unauthenticated',
          'session',
          'login',
          'token',
        ];
        const isAuthError = authErrorKeywords.some((keyword) =>
          errorMessage.toLowerCase().includes(keyword.toLowerCase())
        );

        if (isAuthError) {
          console.warn('Authentication error loading announcements, using cached data if available:', errorMessage);
          return;
        }

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
        class_id: row.class_id ?? null,
        class_name: row.class_name || null,
      }));

      // Limit to 5 announcements
      const limited = normalized.slice(0, 5);
      setAnnouncements(limited);

      // Write-through cache
      try {
        const cacheKey = `latest_announcements_${userRole || 'all'}_${user?.id || 'all'}`;
        if (typeof window !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify(limited));
        }
      } catch {
        // ignore cache errors
      }
    } catch (err: any) {
      console.error('Failed to load announcements:', err);
      if (
        err.message &&
        !err.message.includes('Authentication required') &&
        !err.message.includes('401')
      ) {
        setError(t.failed_to_load);
      }
    } finally {
      setLoading(false);
    }
  }, [userRole, user?.id, t, user]);

  useEffect(() => {
    // Instant render from cache (no skeleton) and then refresh in background
    const cacheKey = `latest_announcements_${userRole || 'all'}_${user?.id || 'all'}`;

    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as Announcement[];
          if (Array.isArray(parsed)) {
            setAnnouncements(parsed);
            setLoading(false);
            setHydratedFromCache(true);
          }
        }
      } catch {
        // ignore cache errors
      }
    }

    // Only load fresh data if user is authenticated
    if (user) {
      loadAnnouncements();
    }
  }, [userRole, user?.id, loadAnnouncements, user]);

  // Listen for custom event to refresh announcements
  useEffect(() => {
    const handleRefresh = () => {
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

  // Loading skeleton
  if (loading && !hydratedFromCache && announcements.length === 0) {
    return (
      <div className={`rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800 ${className}`}>
        {showTitle && (
          <div className="mb-4">
            <h3 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">
              {t.announcements_list || 'Latest Announcements'}
            </h3>
          </div>
        )}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-ds-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-700/50 animate-pulse"
            >
              <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && announcements.length === 0) {
    return (
      <div className={`rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800 ${className}`}>
        {showTitle && (
          <div className="mb-4">
            <h3 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">
              {t.announcements_list || 'Latest Announcements'}
            </h3>
          </div>
        )}
        <div className="rounded-ds-md bg-red-50 border border-red-200 p-3 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-ds-small text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={loadAnnouncements}
            className="mt-2 text-ds-small text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline active:text-red-900"
          >
            {t.try_again || 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && !error && announcements.length === 0) {
    return (
      <div className={`rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800 ${className}`}>
        {showTitle && (
          <div className="mb-4">
            <h3 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">
              {t.announcements_list || 'Latest Announcements'}
            </h3>
          </div>
        )}
        <EmptyState
          lang={effectiveLang}
          icon={Megaphone}
          title={t.no_announcements_title}
          description={t.no_announcements_description}
        />
      </div>
    );
  }

  // Render announcements
  return (
    <div className={`rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800 ${className}`}>
      {showTitle && (
        <div className="mb-4">
          <h3 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">
            {t.announcements_list || 'Latest Announcements'}
          </h3>
        </div>
      )}
      <div className="space-y-3" suppressHydrationWarning>
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            className="rounded-ds-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-700/50 hover:shadow-sm transition-shadow"
            suppressHydrationWarning
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 overflow-hidden">
              <h4 className="text-ds-small font-semibold text-slate-900 dark:text-slate-100 truncate flex-1 min-w-0">
                {announcement.title}
              </h4>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-shrink-0">
                {announcement.class_id ? (
                  <span className="inline-flex items-center rounded-ds-full bg-pale-blue px-2.5 py-0.5 text-ds-tiny font-medium text-slate-800 dark:bg-blue-900/20 dark:text-blue-300 whitespace-nowrap flex-shrink-0">
                    {announcement.class_name || t.class_announcement || 'Class'}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-ds-full bg-mint-100 px-2.5 py-0.5 text-ds-tiny font-medium text-mint-800 dark:bg-green-900/20 dark:text-green-300 whitespace-nowrap flex-shrink-0">
                    {t.organization_wide || 'Organization-wide'}
                  </span>
                )}
                <span className="text-ds-tiny text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {formatDate(announcement.created_at)}
                </span>
              </div>
            </div>
            {announcement.body && (
              <p className="mt-2 text-ds-tiny text-slate-600 dark:text-slate-400 line-clamp-2">
                {announcement.body}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
