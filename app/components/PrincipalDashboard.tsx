'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Users, School, ChartBar as BarChart3, Utensils, AlertCircle, Plus } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import AnnouncementList from './AnnouncementList';
import { useRouter } from 'next/navigation';
import StoryColumn from './shared/StoryColumn';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import KPICardSkeleton from '@/app/components/loading-skeletons/KPICardSkeleton';
import type { KPICard } from '@/lib/types/dashboard';
import { useAuth } from '@/lib/hooks/useAuth';
import { ActivityLog } from '@/app/components/shared/ActivityLog';
import { ActivityModal } from '@/app/components/shared/ActivityModal';
import type { DailyLogWithRelations } from '@/lib/types/daily-logs';

export default function PrincipalDashboard() {
  const { t, lang } = useLanguage();
  const router = useRouter();

  // KPI data states - initialized to 0 and populated from API
  const [classesCount, setClassesCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [menusCount, setMenusCount] = useState(0);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Single consolidated function to fetch all metrics from the API
  const fetchMetrics = useCallback(async (signal: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/principal-dashboard-metrics?t=${Date.now()}`, {
        cache: 'no-store',
        signal,
        credentials: 'include',
      });

      if (signal.aborted) {
        return;
      }

      if (!res.ok) {
        let errorMessage = `HTTP ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = (errorData as any).error || errorMessage;
        } catch {
          try {
            const errorText = await res.text();
            errorMessage = errorText || errorMessage;
          } catch {
            // Fallback to default errorMessage
          }
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();

      if (signal.aborted) {
        return;
      }

      setStudentsCount((data as any).studentsCount || 0);
      setStaffCount((data as any).staffCount || 0);
      setClassesCount((data as any).classesCount || 0);
      setMenusCount((data as any).menusCount || 0);
    } catch (err: unknown) {
      if (signal.aborted) {
        return;
      }

      const message =
        err instanceof Error ? err.message : 'Failed to load dashboard metrics. Please try again.';
      setError(message);
      console.error('Error loading principal dashboard metrics:', err);
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    void fetchMetrics(abortController.signal);
    return () => {
      abortController.abort();
    };
  }, [ fetchMetrics]);

  // Retry handler for error state
  const handleRetry = useCallback(() => {
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    void fetchMetrics(abortController.signal);
  }, [fetchMetrics]);

  // Memoize activity items to ensure they update when language changes
  const activityItems = useMemo(
    () => [
      t.act_added_class.replace('{name}', 'Rauðkjarni'),
      t.act_invited.replace('{name}', 'Margrét Jónsdóttir'),
      t.act_visibility_off.replace('{name}', 'Rauðkjarni'),
      t.act_export,
    ],
    [t],
  );

  // Memoize KPIs to ensure they update when language changes
  const kpis = useMemo<KPICard[]>(
    () => [
      {
        label: t.kpi_students,
        value: studentsCount,
        icon: Users,
        onClick: () => router.push('/dashboard/principal/students'),
      },
      {
        label: t.kpi_staff,
        value: staffCount,
        icon: School,
        onClick: () => router.push('/dashboard/principal/staff'),
      },
      {
        label: t.kpi_classes,
        value: classesCount,
        icon: BarChart3,
        onClick: () => router.push('/dashboard/principal/classes'),
      },
      {
        label: t.kpi_menus,
        value: menusCount,
        icon: Utensils,
        onClick: () => router.push('/dashboard/principal/menus'),
      },
    ],
    [t, studentsCount, staffCount, classesCount, menusCount, router],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-ds-lg md:px-6">
      {/* Header */}
      <div className="mb-ds-md mt-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-ds-h1 font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
          <p className="mt-1 text-ds-small text-slate-600 dark:text-slate-400">{t.subtitle}</p>
        </div>

        {/* Profile switcher + actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center justify-end">
            <ProfileSwitcher /> {/* ← shows only if user has multiple roles */}
          </div>
        </div>
      </div>

      {/* Stories Column */}
      <StoryColumn
        lang={lang}
        userRole="principal"
      />

      {/* KPIs and status */}
      <section className="mt-ds-md">
        {/* Error Message */}
        {error && (
          <div className="mb-ds-sm rounded-ds-md border border-red-200 bg-red-50 p-ds-sm dark:border-red-800 dark:bg-red-900/20">
            <div className="flex items-center gap-ds-md">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <p className="text-ds-small font-medium text-red-800 dark:text-red-200">{error}</p>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-ds-md bg-red-100 px-3 py-1.5 text-ds-small font-medium text-red-700 hover:bg-red-200 transition-colors dark:bg-red-800/50 dark:text-red-200 dark:hover:bg-red-800/70"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <KPICardSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-4">
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
                  className={`rounded-ds-lg p-ds-md shadow-ds-card ${bgColor} ${
                    onClick !== undefined
                      ? 'cursor-pointer transition-all duration-200 hover:shadow-ds-lg'
                      : ''
                  }`}
                  onClick={onClick}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-ds-small text-slate-600 dark:text-slate-400">{label}</div>
                    <span className="rounded-ds-md bg-white/50 p-2 dark:bg-slate-700">
                      <Icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                    </span>
                  </div>
                  <div className="mt-3 text-ds-h2 font-semibold text-slate-900 dark:text-slate-100">
                    {value}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* School Announcements Section */}
      <div className="mt-ds-md">
        <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
          <div className="mb-4">
            <h3 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">{t.announcements_list}</h3>
          </div>
      <AnnouncementList
        userRole="principal"
        showAuthor={true}
        limit={5}
        lang={lang}
      />
        </div>
      </div>

      {/* Activity feed */}
      <div className="mt-ds-md grid grid-cols-1 gap-ds-md lg:grid-cols-2">
        <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
          <h3 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">{t.recent_activity}</h3>
          <ul className="mt-3 space-y-3 text-ds-small">
            {activityItems.map((txt, i) => (
              <li key={i} className="rounded-ds-md bg-mint-100 dark:bg-slate-700 p-3 text-slate-700 dark:text-slate-300">
                {txt}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
          <h3 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">{t.quick_tips}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ds-small text-slate-700 dark:text-slate-300">
            <li>{t.tip_roles}</li>
            <li>{t.tip_visibility}</li>
            <li>{t.tip_exports}</li>
          </ul>
        </div>
      </div>

      {/* Activity Log Section */}
      <ActivityLogSection />

    </main>
  );
}

function ActivityLogSection() {
  const { t } = useLanguage();
  const [activities, setActivities] = useState<DailyLogWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<DailyLogWithRelations | null>(null);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/daily-logs?kind=activity&t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err.error || `Failed with ${res.status}`);
      }

      const { dailyLogs } = await res.json();
      // Show only recent activities (last 10)
      const recentActivities = (dailyLogs || []).slice(0, 10);
      setActivities(recentActivities);
    } catch (err: any) {
      console.error('Failed to load activities:', err);
      setError(err.message || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleAddClick = () => {
    setEditingActivity(null);
    setIsModalOpen(true);
  };

  const handleEdit = (activity: DailyLogWithRelations) => {
    setEditingActivity(activity);
    setIsModalOpen(true);
  };

  const handleDelete = () => {
    loadActivities();
  };

  const handleModalSuccess = () => {
    loadActivities();
  };

  return (
    <section className="mt-ds-md">
      <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">
            {t.activity_log || 'Activity Log'}
          </h3>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 rounded-ds-md bg-mint-600 px-4 py-2 text-ds-small font-medium text-white hover:bg-mint-700 dark:bg-mint-500 dark:hover:bg-mint-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t.add_activity || 'Add Activity'}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-ds-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-ds-small text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <ActivityLog
          activities={activities}
          onEdit={handleEdit}
          onDelete={handleDelete}
          canEdit={true}
          canDelete={true}
          loading={loading}
          onRefresh={loadActivities}
        />

        <ActivityModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingActivity(null);
          }}
          onSuccess={handleModalSuccess}
          initialData={editingActivity}
        />
      </div>
    </section>
  );
}
