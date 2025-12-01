'use client';
import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Menu, ClipboardCheck, Users, MessageSquare, FileText, Megaphone, Utensils, AlertCircle } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useRouter, useSearchParams } from 'next/navigation';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import KPICardSkeleton from '@/app/components/loading-skeletons/KPICardSkeleton';
import type { KPICard, TeacherDashboardContentProps, TeacherMetrics } from '@/lib/types/teacher-dashboard';

function TeacherDashboardContent({
  t,
  kpis,
  isLoading = false,
  error = null,
  onRetry,
}: TeacherDashboardContentProps) {
  const { sidebarRef } = useTeacherPageLayout();

  return (
    <>
      {/* Content Header */}
      <div className="mb-ds-sm flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            onClick={() => sidebarRef.current?.open()}
            className="md:hidden p-2 rounded-ds-md hover:bg-mint-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="text-ds-h2 font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.teacher_dashboard}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <ProfileSwitcher />
        </div>
      </div>
      {/* Error Message */}
      {error && (
        <div className="mb-ds-md rounded-ds-md border border-red-200 bg-red-50 p-ds-md dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-ds-small font-medium text-red-800 dark:text-red-200">{error}</p>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-ds-md bg-red-100 px-3 py-1.5 text-ds-small font-medium text-red-700 hover:bg-red-200 dark:bg-red-800/50 dark:text-red-200 dark:hover:bg-red-800/70"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPIs Section */}
      <section className="mb-ds-md">
        {isLoading ? (
          <KPICardSkeleton count={6} />
        ) : (
          <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map(({ label, value, icon: Icon, onClick }, i) => {
              const bgColors = [
                'bg-pale-blue dark:bg-slate-800',
                'bg-pale-yellow dark:bg-slate-800',
                'bg-pale-peach dark:bg-slate-800',
              ];
              const bgColor = bgColors[i % 3];
              return (
                <div
                  key={i}
                  className={`cursor-pointer rounded-ds-lg p-ds-md shadow-ds-card transition-all duration-200 hover:shadow-ds-lg ${bgColor}`}
                  onClick={onClick}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-ds-small text-slate-600 dark:text-slate-400">{label}</div>
                    <span className="rounded-ds-md bg-white/50 dark:bg-slate-700 p-2">
                      <Icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                    </span>
                  </div>
                  <div className="mt-3 text-ds-h2 font-semibold text-slate-900 dark:text-slate-100">{value}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function TeacherDashboardPageContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Set active tab from query parameter
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    // No tabs available in TeacherDashboard anymore
    if (tabParam) {
      // Redirect to appropriate page if needed
      if (tabParam === 'students') {
        router.replace('/dashboard/teacher/students');
      } else if (tabParam === 'menus') {
        router.replace('/dashboard/teacher/menus');
      } else if (tabParam === 'link_student') {
        router.replace('/dashboard/teacher/link-student');
      } else if (tabParam === 'guardians') {
        router.replace('/dashboard/teacher/guardians');
      }
    }
  }, [searchParams, router]);

  // Prefetch routes for instant navigation
  useEffect(() => {
    try {
      router.prefetch('/dashboard/teacher/attendance');
      router.prefetch('/dashboard/teacher/diapers');
      router.prefetch('/dashboard/teacher/media');
      router.prefetch('/dashboard/teacher/stories');
      router.prefetch('/dashboard/teacher/announcements');
      router.prefetch('/dashboard/teacher/menus');
      router.prefetch('/dashboard/teacher/link-student');
      router.prefetch('/dashboard/teacher/guardians');
      router.prefetch('/dashboard/teacher/messages');
      router.prefetch('/dashboard/teacher/calendar');
    } catch {
      // Prefetch errors are non-fatal
    }
  }, [router]);

  // Metrics state - all KPIs in one object
  const [metrics, setMetrics] = useState<TeacherMetrics>({
    attendanceCount: 0,
    studentsCount: 0,
    messagesCount: 0,
    storiesCount: 0,
    announcementsCount: 0,
    menusCount: 0,
  });

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Single consolidated function to fetch metrics
  const fetchMetrics = useCallback(async (signal: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);

      // API gets all data from authenticated session, no query params needed
      const res = await fetch(`/api/teacher-dashboard-metrics?t=${Date.now()}`, {
        cache: 'no-store',
        signal,
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

      setMetrics({
        attendanceCount: data.attendanceCount || 0,
        studentsCount: data.studentsCount || 0,
        messagesCount: data.messagesCount || 0,
        storiesCount: data.storiesCount || 0,
        announcementsCount: data.announcementsCount || 0,
        menusCount: data.menusCount || 0,
      });
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
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    void fetchMetrics(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchMetrics]);

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
    ClipboardCheck,
    Users,
    MessageSquare,
    FileText,
    Megaphone,
    Utensils,
  }), []);

  // Stable navigation handlers
  const navigationHandlers = useMemo(() => ({
    attendance: () => router.push('/dashboard/teacher/attendance'),
    students: () => router.push('/dashboard/teacher/students'),
    messages: () => router.push('/dashboard/teacher/messages'),
    stories: () => router.push('/dashboard/stories'),
    announcements: () => router.push('/dashboard/announcements'),
    menus: () => router.push('/dashboard/teacher/menus'),
  }), [router]);

  // Memoize KPIs array with stable references
  const kpis = useMemo<KPICard[]>(() => [
    {
      label: t.attendance || 'Attendance',
      value: metrics.attendanceCount,
      icon: icons.ClipboardCheck,
      onClick: navigationHandlers.attendance,
    },
    {
      label: t.kpi_students || 'Students',
      value: metrics.studentsCount,
      icon: icons.Users,
      onClick: navigationHandlers.students,
    },
    {
      label: t.kpi_messages || 'Messages',
      value: metrics.messagesCount,
      icon: icons.MessageSquare,
      onClick: navigationHandlers.messages,
    },
    {
      label: `${t.kpi_stories || 'Stories'} (24h)`,
      value: metrics.storiesCount,
      icon: icons.FileText,
      onClick: navigationHandlers.stories,
    },
    {
      label: t.kpi_announcements || 'Announcements',
      value: metrics.announcementsCount,
      icon: icons.Megaphone,
      onClick: navigationHandlers.announcements,
    },
    {
      label: t.kpi_menus || 'Menus',
      value: metrics.menusCount,
      icon: icons.Utensils,
      onClick: navigationHandlers.menus,
    },
  ], [t, metrics, icons, navigationHandlers]);

  return (
    <TeacherPageLayout messagesBadge={metrics.messagesCount > 0 ? metrics.messagesCount : undefined}>
      <TeacherDashboardContent 
        t={t} 
        kpis={kpis} 
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
      />
    </TeacherPageLayout>
  );
}

export default function TeacherDashboardPage() {
  return (
    <Suspense fallback={
      <TeacherPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <KPICardSkeleton count={6} />
        </div>
      </TeacherPageLayout>
    }>
      <TeacherDashboardPageContent />
    </Suspense>
  );
}
