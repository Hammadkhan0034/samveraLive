'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import GuardianPageLayout, { useGuardianPageLayout } from '@/app/components/shared/GuardianPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { AlertCircle, Megaphone } from 'lucide-react';
import EmptyState from '@/app/components/EmptyState';

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author_id: string;
  class_id?: string | null;
  class_name?: string | null;
}

function GuardianAnnouncementsContent() {
  const { t, lang } = useLanguage();
  const { sidebarRef } = useGuardianPageLayout();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);

  const loadAnnouncements = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      // Do NOT pass userId or userRole - server gets them from authenticated session
      const params = new URLSearchParams();
      params.set('limit', '100');

      const res = await fetch(`/api/announcements?${params.toString()}&t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        const errorMessage = err.error || `Failed with ${res.status}`;
        throw new Error(errorMessage);
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

      // Cache the data for instant loading next time
      try {
        const cacheKey = 'guardian_announcements';
        if (typeof window !== 'undefined' && cacheKey) {
          localStorage.setItem(cacheKey, JSON.stringify(normalized));
        }
      } catch {
        // ignore cache errors
      }
    } catch (err: any) {
      console.error('Failed to load announcements:', err);
      // Use server error message or fallback - translation handled in UI
      setError(err.message || 'Failed to load announcements');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Load from cache first for instant display
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('guardian_announcements');
        if (cached) {
          const parsed = JSON.parse(cached) as Announcement[];
          if (Array.isArray(parsed) && mounted) {
            setAnnouncements(parsed);
            setHydratedFromCache(true);
          }
        }
      } catch {
        // ignore cache errors
      }
    }

    // Load fresh data in background without showing loading
    if (mounted) {
      loadAnnouncements(false);
    }

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      loadAnnouncements(false); // Refresh silently in background
    };

    window.addEventListener('announcements-refresh', handleRefresh);
    return () => {
      window.removeEventListener('announcements-refresh', handleRefresh);
    };
  }, [loadAnnouncements]);

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

  return (
    <>
      <PageHeader
        title={t.announcements || 'Announcements'}
        subtitle={t.announcements_subtitle_guardian || t.announcements_subtitle || 'View school announcements and updates'}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />

      {/* Error State */}
      {error && (
        <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <p>{error === 'Failed to load announcements' ? (t.error_loading || error) : error}</p>
          </div>
          <button
            onClick={() => loadAnnouncements(true)}
            className="mt-2 text-ds-small underline hover:no-underline"
          >
            {t.try_again || 'Try again'}
          </button>
        </div>
      )}

      {/* Loading State - Only show if we don't have cached data */}
      {loading && !error && !hydratedFromCache && announcements.length === 0 && (
        <div className="rounded-ds-lg border border-slate-200 bg-white p-8 shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          <p className="text-center text-slate-600 dark:text-slate-400">{t.loading || 'Loading...'}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && announcements.length === 0 && (
        <div className="rounded-ds-lg border border-slate-200 bg-white p-8 shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          <EmptyState
            lang={lang}
            icon={Megaphone}
            title={t.no_announcements_yet || 'No Announcements Yet'}
            description={t.no_announcements_description || 'There are no announcements available at this time. Check back later for updates.'}
          />
        </div>
      )}

      {/* Announcements List - Show if we have announcements (from cache or fresh load) */}
      {!error && announcements.length > 0 && (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="rounded-ds-lg border border-slate-200 bg-white p-6 shadow-ds-card dark:border-slate-700 dark:bg-slate-800 hover:shadow-ds-card-lg transition-shadow"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100 flex-1">
                  {announcement.title}
                </h3>
                {announcement.class_id ? (
                  <span className="inline-flex items-center rounded-ds-full bg-pale-blue px-2.5 py-0.5 text-ds-tiny font-medium text-slate-800 dark:bg-blue-900/20 dark:text-blue-300 flex-shrink-0">
                    {announcement.class_name || t.class || 'Class'}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-ds-full bg-mint-100 px-2.5 py-0.5 text-ds-tiny font-medium text-mint-800 dark:bg-green-900/20 dark:text-green-300 flex-shrink-0">
                    {t.org_wide || 'Organization-wide'}
                  </span>
                )}
              </div>
              <p className="text-ds-small text-slate-700 dark:text-slate-300 mb-4 whitespace-pre-wrap">
                {announcement.body}
              </p>
              <div className="text-ds-tiny text-slate-500 dark:text-slate-400">
                {formatDate(announcement.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function GuardianAnnouncementsPageContent() {
  return (
    <GuardianPageLayout>
      <GuardianAnnouncementsContent />
    </GuardianPageLayout>
  );
}

export default function GuardianAnnouncementsPage() {
  return (
    <Suspense
      fallback={
        <GuardianPageLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-slate-500 dark:text-slate-400">
              {typeof window !== 'undefined' ? 'Loading announcements...' : ''}
            </div>
          </div>
        </GuardianPageLayout>
      }
    >
      <GuardianAnnouncementsPageContent />
    </Suspense>
  );
}
