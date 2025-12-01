'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { Menu, Users, School, ChartBar as BarChart3, FileText, Megaphone, MessageSquare, Camera, CalendarDays, Utensils, AlertCircle } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useRouter } from 'next/navigation';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import KPICardSkeleton from '@/app/components/loading-skeletons/KPICardSkeleton';
import type { KPICard } from '@/lib/types/teacher-dashboard';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCurrentUserOrgId } from '@/lib/hooks/useCurrentUserOrgId';

interface PrincipalDashboardContentProps {
  t: any;
  kpis: KPICard[];
  calendarEventsCount: number;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function PrincipalDashboardContent({
  t,
  kpis,
  calendarEventsCount,
  isLoading = false,
  error = null,
  onRetry,
}: PrincipalDashboardContentProps) {
  const { sidebarRef } = usePrincipalPageLayout();
  const router = useRouter();

  return (
    <>
      {/* Content Header */}
      <div className="mb-ds-md flex flex-col gap-ds-md md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-ds-md">
          {/* Mobile menu button */}
          <button
            onClick={() => sidebarRef.current?.open()}
            className="md:hidden p-2 rounded-ds-md hover:bg-mint-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-ds-h1 font-bold tracking-tight text-ds-text-primary dark:text-slate-100">
            {t.title || 'Principal Dashboard'}
          </h1>
        </div>
        <div className="flex items-center gap-ds-md">
          <ProfileSwitcher />
        </div>
      </div>
      {/* Error Message */}
      {error && (
        <div className="mb-ds-sm rounded-ds-md border border-red-200 bg-red-50 p-ds-sm dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-ds-md">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-ds-small font-medium text-red-800 dark:text-red-200">{error}</p>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-ds-md bg-red-100 px-3 py-1.5 text-ds-small font-medium text-red-700 hover:bg-red-200 transition-colors dark:bg-red-800/50 dark:text-red-200 dark:hover:bg-red-800/70"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPIs Section */}
      <section className="mb-ds-lg">
        {isLoading ? (
          <KPICardSkeleton count={11} />
        ) : (
          <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map(({ label, value, icon: Icon, onClick }, i) => {
              // Cycle through tinted backgrounds: pale-blue, pale-yellow, pale-peach
              const bgColors = [
                'bg-pale-blue dark:bg-slate-800',
                'bg-pale-yellow dark:bg-slate-800',
                'bg-pale-peach dark:bg-slate-800',
              ];
              const bgColor = bgColors[i % 3];

              return (
                <div
                  key={i}
                  className={`cursor-pointer rounded-ds-lg ${bgColor} p-ds-md shadow-ds-card transition-all duration-200 hover:shadow-ds-md`}
                  onClick={onClick}
                >
                  <div className="text-ds-small text-ds-text-secondary dark:text-slate-400 mb-2">{label}</div>
                  <div className="flex items-center justify-between">
                    <div className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">{value}</div>
                    <span className="rounded-ds-md bg-white/50 dark:bg-slate-700/50 p-2">
                      <Icon className="h-5 w-5 text-ds-text-primary dark:text-slate-300" />
                    </span>
                  </div>
                </div>
              );
            })}
            {/* Calendar KPI Card */}
            {(() => {
              const bgColors = [
                'bg-pale-blue dark:bg-slate-800',
                'bg-pale-yellow dark:bg-slate-800',
                'bg-pale-peach dark:bg-slate-800',
              ];
              const bgColor = bgColors[kpis.length % 3];

              return (
                <div
                  onClick={() => router.push('/dashboard/principal/calendar')}
                  className={`cursor-pointer rounded-ds-lg ${bgColor} p-ds-md shadow-ds-card transition-all duration-200 hover:shadow-ds-md`}
                >
                  <div className="text-ds-small text-ds-text-secondary dark:text-slate-400 mb-2">{t.tile_calendar || 'Calendar'}</div>
                  <div className="flex items-center justify-between">
                    <div className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                      {calendarEventsCount}
                    </div>
                    <span className="rounded-ds-md bg-white/50 dark:bg-slate-700/50 p-2">
                      <CalendarDays className="h-5 w-5 text-ds-text-primary dark:text-slate-300" />
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </section>
    </>
  );
}

function PrincipalDashboardPageContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const { session } = useAuth?.() || {} as any;
  const { orgId: finalOrgId } = useCurrentUserOrgId();


  // KPI data states - simplified initialization
  const [studentsCount, setStudentsCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [classesCount, setClassesCount] = useState(0);
  const [guardiansCount, setGuardiansCount] = useState(0);
  const [menusCount, setMenusCount] = useState(0);
  const [storiesCount, setStoriesCount] = useState(0);
  const [announcementsCount, setAnnouncementsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [photosCount, setPhotosCount] = useState(0);
  const [calendarEventsCount, setCalendarEventsCount] = useState(0);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Single consolidated function to fetch all metrics
  const fetchMetrics = useCallback(async (signal: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);

      // API gets all data from authenticated session, no query params needed
      const res = await fetch(`/api/principal-dashboard-metrics?t=${Date.now()}`, {
        cache: 'no-store',
        signal,
        credentials: 'include',
      });

      if (signal.aborted) {
        return;
      }

      if (!res.ok) {
        // Try to parse as JSON first, fallback to text
        let errorMessage = `HTTP ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If JSON parsing fails, try text
          try {
            const errorText = await res.text();
            errorMessage = errorText || errorMessage;
          } catch {
            // Use default error message
          }
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();

      if (signal.aborted) {
        return;
      }

      // Update all state variables from the response
      setStudentsCount(data.studentsCount || 0);
      setStaffCount(data.staffCount || 0);
      setClassesCount(data.classesCount || 0);
      setGuardiansCount(data.guardiansCount || 0);
      setMenusCount(data.menusCount || 0);
      setStoriesCount(data.storiesCount || 0);
      setAnnouncementsCount(data.announcementsCount || 0);
      setMessagesCount(data.messagesCount || 0);
      setPhotosCount(data.photosCount || 0);
      setCalendarEventsCount(data.calendarEventsCount || 0);
    } catch (err: unknown) {
      if (signal.aborted) {
        return;
      }

      const message =
        err instanceof Error ? err.message : 'Failed to load dashboard metrics. Please try again.';
      setError(message);
      console.error('Error loading metrics:', err);
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Main effect: Load metrics on mount
  useEffect(() => {
    if (!session?.user?.id || !finalOrgId) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    void fetchMetrics(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [session?.user?.id, finalOrgId, fetchMetrics]);

  // Retry function
  const handleRetry = useCallback(() => {
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    void fetchMetrics(abortController.signal);
  }, [fetchMetrics]);

  // Stable icon references
  const icons = useMemo(() => ({
    Users,
    School,
    BarChart3,
    Utensils,
    FileText,
    Megaphone,
    MessageSquare,
    Camera,
  }), []);

  // Memoize KPIs array with stable references
  const kpis = useMemo<KPICard[]>(() => [
    {
      label: t.kpi_students || 'Students',
      value: studentsCount,
      icon: icons.Users,
      onClick: () => router.push('/dashboard/principal/students'),
    },
    {
      label: t.kpi_staff || 'Staff',
      value: staffCount,
      icon: icons.School,
      onClick: () => router.push('/dashboard/principal/staff'),
    },
    {
      label: t.kpi_classes || 'Classes',
      value: classesCount,
      icon: icons.BarChart3,
      onClick: () => router.push('/dashboard/principal/classes'),
    },
    {
      label: t.kpi_guardians || 'Guardians',
      value: guardiansCount,
      icon: icons.Users,
      onClick: () => router.push('/dashboard/guardians'),
    },
    {
      label: t.kpi_menus || 'Menus',
      value: menusCount,
      icon: icons.Utensils,
      onClick: () => router.push('/dashboard/menus-list'),
    },
    {
      label: t.kpi_stories || 'Stories',
      value: storiesCount,
      icon: icons.FileText,
      onClick: () => router.push('/dashboard/stories'),
    },
    {
      label: t.kpi_announcements || 'Announcements',
      value: announcementsCount,
      icon: icons.Megaphone,
      onClick: () => router.push('/dashboard/announcements'),
    },
    {
      label: t.kpi_messages || 'Messages',
      value: messagesCount,
      icon: icons.MessageSquare,
      onClick: () => router.push('/dashboard/principal/messages'),
    },
    {
      label: t.kpi_photos || 'Photos',
      value: photosCount,
      icon: icons.Camera,
      onClick: () => router.push('/dashboard/principal/photos'),
    },
    {
      label: t.kpi_link_student || 'Link Student',
      value: 0,
      icon: icons.Users,
      onClick: () => router.push('/dashboard/link-student'),
    },
  ], [t, studentsCount, staffCount, classesCount, guardiansCount, menusCount, storiesCount, announcementsCount, messagesCount, photosCount, icons, router]);

  return (
    <PrincipalPageLayout messagesBadge={messagesCount > 0 ? messagesCount : undefined}>
      <PrincipalDashboardContent 
        t={t} 
        kpis={kpis} 
        calendarEventsCount={calendarEventsCount}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
      />
    </PrincipalPageLayout>
  );
}

export default function PrincipalDashboardPage() {
  return (
    <Suspense fallback={
      <PrincipalPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <KPICardSkeleton count={11} />
        </div>
      </PrincipalPageLayout>
    }>
      <PrincipalDashboardPageContent />
    </Suspense>
  );
}
