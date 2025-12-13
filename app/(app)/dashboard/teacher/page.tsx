'use client';
import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { ClipboardCheck, Users, School, AlertCircle, LayoutDashboard, Baby, MessageSquare, Camera, Bell, Utensils, CalendarDays, Activity, Grid3x3 } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import KPICardSkeleton from '@/app/components/loading-skeletons/KPICardSkeleton';
import type { KPICard, TeacherDashboardContentProps, TeacherMetrics } from '@/lib/types/dashboard';
import StoryColumn from '@/app/components/shared/StoryColumn';
import AttendancePanel from '@/app/components/attendance/AttendancePanel';
import Navbar from '@/app/components/Navbar';
import Loading from '@/app/components/shared/Loading';
import { useRequireAuth } from '@/lib/hooks/useAuth';

function TeacherDashboardContent({
  t,
  kpis,
  isLoading = false,
  error = null,
  onRetry,
}: TeacherDashboardContentProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Helper to get icon color from border color for hover effect
  const getIconHoverColor = (borderColor: string) => {
    const colorMap: Record<string, string> = {
      'border-blue-500': 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
      'border-orange-500': 'group-hover:text-orange-600 dark:group-hover:text-orange-400',
      'border-green-500': 'group-hover:text-green-600 dark:group-hover:text-green-400',
      'border-pink-500': 'group-hover:text-pink-600 dark:group-hover:text-pink-400',
      'border-purple-500': 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
      'border-cyan-500': 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
      'border-mint-500': 'group-hover:text-mint-600 dark:group-hover:text-mint-400',
      'border-indigo-500': 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400',
      'border-teal-500': 'group-hover:text-teal-600 dark:group-hover:text-teal-400',
      'border-yellow-500': 'group-hover:text-yellow-600 dark:group-hover:text-yellow-400',
      'border-red-500': 'group-hover:text-red-600 dark:group-hover:text-red-400',
      'border-slate-500': 'group-hover:text-slate-600 dark:group-hover:text-slate-400',
    };
    return colorMap[borderColor] || 'group-hover:text-slate-600 dark:group-hover:text-slate-400';
  };

  // Navigation tiles data with colored borders
  const navigationTiles = useMemo(() => [
    {
      id: 'dashboard',
      title: t.teacher_dashboard || 'Dashboard',
      desc: t.teacher_dashboard_subtitle || 'View dashboard overview',
      Icon: LayoutDashboard,
      route: '/dashboard/teacher',
      borderColor: 'border-blue-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'diapers',
      title: t.tile_diaper || 'Diapers',
      desc: t.tile_diaper_desc || 'Manage diaper changes',
      Icon: Baby,
      route: '/dashboard/teacher/diapers',
      borderColor: 'border-pink-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'messages',
      title: t.tile_msg || 'Messages',
      desc: t.tile_msg_desc || 'View and send messages',
      Icon: MessageSquare,
      route: '/dashboard/teacher/messages',
      borderColor: 'border-cyan-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'media',
      title: t.tile_media || 'Media',
      desc: t.tile_media_desc || 'Photos and videos',
      Icon: Camera,
      route: '/dashboard/teacher/media',
      borderColor: 'border-purple-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'announcements',
      title: t.tile_announcements || 'Announcements',
      desc: t.tile_announcements_desc || 'View announcements',
      Icon: Bell,
      route: '/dashboard/teacher/announcements',
      borderColor: 'border-yellow-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'calendar',
      title: t.tile_calendar || 'Calendar',
      desc: t.tile_calendar_desc || 'View calendar events',
      Icon: CalendarDays,
      route: '/dashboard/teacher/calendar',
      borderColor: 'border-green-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'menus',
      title: t.tile_menus || 'Menus',
      desc: t.tile_menus_desc || 'Manage daily menus',
      Icon: Utensils,
      route: '/dashboard/teacher/menus',
      borderColor: 'border-orange-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
    {
      id: 'daily_logs',
      title: t.activity_log || 'Activity Log',
      desc: t.tile_activity_log_desc || 'View and manage daily activity logs',
      Icon: Activity,
      route: '/dashboard/teacher/daily-logs',
      borderColor: 'border-red-500',
      titleColor: 'text-slate-900 dark:text-slate-100',
    },
  ], [t]);

  const handleTileClick = (route: string) => {
    router.push(route);
  };

  const isTileActive = (route: string): boolean => {
    return pathname === route;
  };

  return (
    <>
      {/* Content Header */}
      <PageHeader
        title={t.teacher_dashboard || 'Teacher Dashboard'}
        subtitle={t.teacher_dashboard_subtitle || 'Track attendance, manage students, and communicate with guardians.'}
        headingLevel="h1"
        showMobileMenu={false}
      />

      <StoryColumn
        userRole="teacher"
      />

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
          <KPICardSkeleton count={3} />
        ) : (
          <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map(({ label, value, icon: Icon }, i) => {
              const bgColors = [
                'bg-pale-blue dark:bg-slate-800',
                'bg-pale-yellow dark:bg-slate-800',
                'bg-pale-peach dark:bg-slate-800',
              ];
              const bgColor = bgColors[i % 3];
              return (
                <div
                  key={i}
                  className={`rounded-ds-lg p-ds-md shadow-ds-card transition-all duration-200 ${bgColor}`}
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

      {/* Attendance Panel */}
      <section className="mb-ds-md">
        <AttendancePanel />
      </section>

      {/* Navigation Tiles Section */}
      <section className="mb-ds-lg">
        <div className="mb-ds-md flex items-center gap-ds-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-ds-md bg-mint-100 dark:bg-slate-800">
            <Grid3x3 className="h-5 w-5 text-mint-700 dark:text-mint-400" />
          </div>
          <div>
            <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100">
              {t.management_modules || 'Management Modules'}
            </h2>
            <p className="mt-1 text-ds-small text-ds-text-muted dark:text-slate-400">
              {t.management_modules_description || 'Access and manage all teacher modules and features'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {navigationTiles.map((tile) => {
            const active = isTileActive(tile.route);
            const borderColor = tile.borderColor || 'border-slate-500';
            const titleColor = tile.titleColor || 'text-slate-900 dark:text-slate-100';
            // Get hover border color class
            const getHoverBorderClass = (borderColor: string) => {
              const colorMap: Record<string, string> = {
                'border-blue-500': 'hover:border-blue-500',
                'border-orange-500': 'hover:border-orange-500',
                'border-green-500': 'hover:border-green-500',
                'border-pink-500': 'hover:border-pink-500',
                'border-purple-500': 'hover:border-purple-500',
                'border-cyan-500': 'hover:border-cyan-500',
                'border-mint-500': 'hover:border-mint-500',
                'border-indigo-500': 'hover:border-indigo-500',
                'border-teal-500': 'hover:border-teal-500',
                'border-yellow-500': 'hover:border-yellow-500',
                'border-red-500': 'hover:border-red-500',
                'border-slate-500': 'hover:border-slate-500',
              };
              return colorMap[borderColor] || 'hover:border-slate-500';
            };

            return (
              <button
                key={tile.id}
                onClick={() => handleTileClick(tile.route)}
                className={`
                  group relative bg-white dark:bg-slate-800 rounded-ds-lg shadow-ds-card text-left transition-all duration-300
                  hover:shadow-ds-card-hover hover:scale-[1.02] overflow-hidden
                  border-2 border-transparent ${getHoverBorderClass(borderColor)}
                  ${active ? 'ring-2 ring-mint-500' : ''}
                `}
              >
                {/* Content */}
                <div className="p-ds-md">
                  {/* Icon */}
                  <div className="mb-3">
                    <tile.Icon className={`h-8 w-8 text-slate-600 dark:text-slate-400 transition-colors duration-300 ${getIconHoverColor(borderColor)}`} />
                  </div>
                  
                  {/* Title */}
                  <div className={`font-bold text-base mb-1 ${titleColor}`}>
                    {tile.title}
                  </div>
                  
                  {/* Subtitle */}
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {tile.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
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
      router.prefetch('/dashboard/teacher/messages');
      router.prefetch('/dashboard/teacher/calendar');
      router.prefetch('/dashboard/teacher/daily-logs');
    } catch {
      // Prefetch errors are non-fatal
    }
  }, [router]);

  // Metrics state - all KPIs in one object
  const [metrics, setMetrics] = useState<TeacherMetrics>({
    classesCount: 0,
    studentsCount: 0,
    attendanceCount: 0,
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
        classesCount: data.classesCount || 0,
        studentsCount: data.studentsCount || 0,
        attendanceCount: data.attendanceCount || 0,
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
    School,
    Users,
    ClipboardCheck,
  }), []);

  // Memoize KPIs array with stable references
  const kpis = useMemo<KPICard[]>(() => [
    {
      label: t.kpi_classes || 'Total Classes',
      value: metrics.classesCount,
      icon: icons.School,
    },
    {
      label: t.kpi_students || 'Students',
      value: metrics.studentsCount,
      icon: icons.Users,
    },
    {
      label: t.attendance || 'Attendance Marked',
      value: metrics.attendanceCount,
      icon: icons.ClipboardCheck,
    },
  ], [t, metrics, icons]);

  return (
    <TeacherDashboardContent 
      t={t} 
      kpis={kpis} 
      isLoading={isLoading}
      error={error}
      onRetry={handleRetry}
    />
  );
}

function TeacherDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isSigningIn } = useRequireAuth('teacher');

  // Show loading state while checking authentication
  if (loading || (isSigningIn && !user)) {
    return <Loading fullScreen />;
  }

  // Safety check: if user is still not available after loading, don't render
  if (!loading && !isSigningIn && !user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Navbar */}
      <Navbar variant="static" />

      {/* Main content area - mint green background with 32px padding */}
      <main
        className="flex-1 overflow-y-auto"
        style={{
          backgroundColor: 'var(--ds-mint)',
        }}
      >
        <div className="p-ds-lg">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function TeacherDashboardPage() {
  return (
    <Suspense fallback={
      <TeacherDashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <KPICardSkeleton count={3} />
        </div>
      </TeacherDashboardLayout>
    }>
      <TeacherDashboardLayout>
        <TeacherDashboardPageContent />
      </TeacherDashboardLayout>
    </Suspense>
  );
}
