'use client';
import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { CalendarDays, Menu, ClipboardCheck, Users, MessageSquare, FileText, Megaphone, Utensils, AlertCircle } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useTeacherOrgId } from '@/lib/hooks/useTeacherOrgId';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useTeacherStudents } from '@/lib/hooks/useTeacherStudents';
import KPICardSkeleton from '@/app/components/loading-skeletons/KPICardSkeleton';
import type { enText, isText } from '@/lib/translations';

interface KPICard {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

interface TeacherDashboardContentProps {
  t: typeof enText | typeof isText;
  kpis: KPICard[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function TeacherDashboardContent({ 
  t, 
  kpis,
  isLoading = false,
  error = null,
  onRetry
}: TeacherDashboardContentProps) {
  const { sidebarRef } = useTeacherPageLayout();

  return (
    <>
      {/* Content Header */}
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            onClick={() => sidebarRef.current?.open()}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.teacher_dashboard}</h2>
        </div>
        <div className="flex items-center gap-3">
          <ProfileSwitcher />
        </div>
      </div>
      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {error}
              </p>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-800/50 dark:text-red-200 dark:hover:bg-red-800/70"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPIs Section */}
      <section className="mb-6">
        {isLoading ? (
          <KPICardSkeleton count={6} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map(({ label, value, icon: Icon, onClick }, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                onClick={onClick}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
                  <span className="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                    <Icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function TeacherDashboardPageContent() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
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
      router.prefetch('/dashboard/teacher/menus');
      router.prefetch('/dashboard/teacher/link-student');
      router.prefetch('/dashboard/teacher/guardians');
      router.prefetch('/dashboard/teacher/messages');
    } catch {}
  }, [router]);

  // Get orgId and classes using hooks
  const { orgId: finalOrgId } = useTeacherOrgId();
  const { classes: teacherClasses } = useTeacherClasses();
  const { students: teacherStudents } = useTeacherStudents(teacherClasses, finalOrgId);

  // Metrics state - all KPIs in one object
  const [metrics, setMetrics] = useState({
    attendanceCount: 0,
    messagesCount: 0,
    storiesCount: 0,
    announcementsCount: 0,
    menusCount: 0,
  });

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract stable values from session to avoid unnecessary re-renders
  const userId = session?.user?.id ?? null;
  const userMetadata = session?.user?.user_metadata;
  const userRole = useMemo(() => {
    return (userMetadata?.role || userMetadata?.activeRole || 'teacher') as string;
  }, [userMetadata?.role, userMetadata?.activeRole]);

  // Request deduplication: track in-flight requests
  const inFlightRequestRef = useRef<Promise<void> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce helper for visibility changes
  const visibilityDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Single consolidated function to fetch metrics
  const fetchMetrics = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);

      // API gets all data from authenticated session, no query params needed
      const res = await fetch(`/api/teacher-dashboard-metrics?t=${Date.now()}`, {
        cache: 'no-store',
        signal,
      });

      if (signal?.aborted) {
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
      
      if (signal?.aborted) {
        return;
      }

      setMetrics({
        attendanceCount: data.attendanceCount || 0,
        messagesCount: data.messagesCount || 0,
        storiesCount: data.storiesCount || 0,
        announcementsCount: data.announcementsCount || 0,
        menusCount: data.menusCount || 0,
      });
    } catch (err: any) {
      // Don't set error for aborted requests
      if (err.name === 'AbortError' || signal?.aborted) {
        return;
      }
      
      const errorMessage = err.message || 'Failed to load dashboard metrics. Please try again.';
      setError(errorMessage);
      console.error('Error loading metrics:', err);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Main effect: Load metrics on mount
  useEffect(() => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Check if there's already a request in flight
    if (inFlightRequestRef.current) {
      // Wait for existing request or abort it
      abortController.abort();
      return;
    }

    // Create new request
    const requestPromise = fetchMetrics(abortController.signal);
    inFlightRequestRef.current = requestPromise;

    // Clear ref when done
    requestPromise.finally(() => {
      if (inFlightRequestRef.current === requestPromise) {
        inFlightRequestRef.current = null;
      }
    });

    return () => {
      abortController.abort();
      if (inFlightRequestRef.current === requestPromise) {
        inFlightRequestRef.current = null;
      }
    };
  }, [fetchMetrics]);

  // Consolidated event listeners for refresh events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRefresh = () => {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Clear any pending request
      inFlightRequestRef.current = null;

      void fetchMetrics(abortController.signal);
    };

    // Debounced visibility change handler
    const handleVisibilityChange = () => {
      if (visibilityDebounceRef.current) {
        clearTimeout(visibilityDebounceRef.current);
      }

      visibilityDebounceRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          handleRefresh();
        }
      }, 300); // 300ms debounce
    };

    window.addEventListener('stories-refresh', handleRefresh);
    window.addEventListener('announcements-refresh', handleRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('stories-refresh', handleRefresh);
      window.removeEventListener('announcements-refresh', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (visibilityDebounceRef.current) {
        clearTimeout(visibilityDebounceRef.current);
      }
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
    inFlightRequestRef.current = null;
    void fetchMetrics(abortController.signal);
  }, [fetchMetrics]);

  // Derive students count from hook
  const studentsCount = useMemo(() => teacherStudents.length, [teacherStudents.length]);

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
      value: studentsCount,
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
  ], [t, metrics, studentsCount, icons, navigationHandlers]);

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
