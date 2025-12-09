'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { Users, School, ChartBar as BarChart3, Utensils, AlertCircle, LayoutDashboard, MessageSquare, Camera, CalendarDays, Shield, Link as LinkIcon, Megaphone, Activity, Building } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import KPICardSkeleton from '@/app/components/loading-skeletons/KPICardSkeleton';
import type { KPICard } from '@/lib/types/dashboard';
import { useAuth } from '@/lib/hooks/useAuth';
import UserCard from '@/app/components/UserCard';
import StoryColumn from '@/app/components/shared/StoryColumn';

interface PrincipalDashboardContentProps {
  t: any;
  kpis: KPICard[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function PrincipalDashboardContent({
  t,
  kpis,
  isLoading = false,
  error = null,
  onRetry,
}: PrincipalDashboardContentProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Navigation tiles data
  const navigationTiles = useMemo(() => [
    {
      id: 'dashboard',
      title: t.title || 'Principal Dashboard',
      desc: 'View dashboard overview',
      Icon: LayoutDashboard,
      route: '/dashboard/principal',
    },
    {
      id: 'students',
      title: t.tile_students || 'Students',
      desc: t.tile_students_desc || 'Manage students',
      Icon: Users,
      route: '/dashboard/principal/students',
    },
    {
      id: 'staff',
      title: t.kpi_staff || 'Staff',
      desc: 'Manage staff members',
      Icon: School,
      route: '/dashboard/principal/staff',
    },
    {
      id: 'classes',
      title: t.kpi_classes || 'Classes',
      desc: 'Manage classes',
      Icon: BarChart3,
      route: '/dashboard/principal/classes',
    },
    {
      id: 'messages',
      title: t.tile_msg || 'Messages',
      desc: t.tile_msg_desc || 'View and send messages',
      Icon: MessageSquare,
      route: '/dashboard/principal/messages',
    },
    {
      id: 'photos',
      title: t.kpi_photos || 'Photos',
      desc: 'View and manage photos',
      Icon: Camera,
      route: '/dashboard/principal/photos',
    },
    {
      id: 'calendar',
      title: t.tile_calendar || 'Calendar',
      desc: t.tile_calendar_desc || 'View calendar events',
      Icon: CalendarDays,
      route: '/dashboard/principal/calendar',
    },
    {
      id: 'guardians',
      title: t.tile_guardians || 'Guardians',
      desc: t.tile_guardians_desc || 'Manage guardians',
      Icon: Shield,
      route: '/dashboard/principal/guardians',
    },
    {
      id: 'link_student',
      title: t.tile_link_student || 'Link Student',
      desc: t.tile_link_student_desc || 'Link a guardian to a student',
      Icon: LinkIcon,
      route: '/dashboard/principal/link-student',
    },
    {
      id: 'menus',
      title: t.tile_menus || 'Menus',
      desc: t.tile_menus_desc || 'Manage daily menus',
      Icon: Utensils,
      route: '/dashboard/principal/menus',
    },
    {
      id: 'announcements',
      title: t.tile_announcements || 'Announcements',
      desc: t.tile_announcements_desc || 'Manage announcements',
      Icon: Megaphone,
      route: '/dashboard/principal/announcements',
    },
    {
      id: 'daily_logs',
      title: t.activity_log || 'Activity Log',
      desc: t.tile_activity_log_desc || 'View and manage daily activity logs',
      Icon: Activity,
      route: '/dashboard/principal/daily-logs',
    },
    {
      id: 'organization_profile',
      title: 'Organization Profile',
      desc: 'View and update organization information',
      Icon: Building,
      route: '/dashboard/principal/organization-profile',
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
        title={t.title || 'Principal Dashboard'}
        subtitle={t.subtitle || 'Manage groups, staff and visibility.'}
        
        headingLevel="h1"
      />

      <StoryColumn
        userRole="principal"
      />
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
          <KPICardSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map(({ label, value, icon: Icon }, i) => {
              // Cycle through tinted backgrounds: pale-blue, pale-yellow, pale-peach, pale-green
              const bgColors = [
                'bg-pale-blue dark:bg-slate-800',
                'bg-pale-yellow dark:bg-slate-800',
                'bg-pale-peach dark:bg-slate-800',
                'bg-pale-green dark:bg-slate-800',
              ];
              const bgColor = bgColors[i % 4];

              return (
                <div
                  key={i}
                  className={`rounded-ds-lg ${bgColor} p-ds-md shadow-ds-card`}
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
          </div>
        )}
      </section>

      {/* Navigation Tiles Section */}
      <section className="mb-ds-lg">
        <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 mb-ds-md">
          Navigation
        </h2>
        <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {navigationTiles.map((tile) => {
            const active = isTileActive(tile.route);
            return (
              <button
                key={tile.id}
                onClick={() => handleTileClick(tile.route)}
                className={`
                  group rounded-ds-lg p-ds-md shadow-ds-card text-left transition-all duration-300
                  hover:shadow-ds-card-hover hover:scale-[1.02]
                  ${active 
                    ? 'bg-mint-200 dark:bg-slate-700 border-2 border-mint-500' 
                    : 'bg-white dark:bg-slate-800 border-2 border-transparent hover:border-mint-400 hover:bg-mint-50 dark:hover:bg-slate-700/50'
                  }
                `}
              >
                <div className="flex items-start gap-ds-sm">
                  <span className={`
                    flex-shrink-0 rounded-lg p-2 transition-all duration-300
                    ${active
                      ? 'bg-mint-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 group-hover:bg-mint-500 group-hover:text-white'
                    }
                  `}>
                    <tile.Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`
                      font-medium text-ds-base mb-1 transition-colors duration-300
                      ${active
                        ? 'text-slate-900 dark:text-slate-100'
                        : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100'
                      }
                    `}>
                      {tile.title}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 transition-colors duration-300 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                      {tile.desc}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* user card section */}

      {/* <UserCard
        user={{
          id: '1',
          org_id: 'org-1',
          email: 'maria@domain.is',
          phone: '777-1334',
          ssn: null,
          address: 'Jhress: JJohanna 9',
          canLogin: true,
          first_name: 'Mária',
          last_name: 'Jónsdóttir',
          role: 'staff',
          bio: null,
          avatar_url: null,
          gender: 'female',
          last_login_at: null,
          is_active: true,
          is_staff: true,
          status: 'active',
          dob: null,
          theme: 'light',
          language: 'is',
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }}
        onCall={() => {
          // Handle call action
          console.log('Call Mária Jónsdóttir');
        }}
        onMessage={() => {
          // Handle message action
          console.log('Message Mária Jónsdóttir');
        }}
        onViewProfile={() => {
          // Handle view profile action
          console.log('View profile Mária Jónsdóttir');
        }}
      /> */}
    </>
  );
}

function PrincipalDashboardPageContent() {
  const { t } = useLanguage();
  const { session } = useAuth?.() || {} as any;


  // KPI data states - simplified initialization
  const [studentsCount, setStudentsCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [classesCount, setClassesCount] = useState(0);
  const [menusCount, setMenusCount] = useState(0);

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
      setMenusCount(data.menusCount || 0);
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
    if (!session?.user?.id) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    void fetchMetrics(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [session?.user?.id, fetchMetrics]);

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
  }), []);

  // Memoize KPIs array with stable references
  const kpis = useMemo<KPICard[]>(() => [
    {
      label: t.kpi_students || 'Students',
      value: studentsCount,
      icon: icons.Users,
    },
    {
      label: t.kpi_staff || 'Staff',
      value: staffCount,
      icon: icons.School,
    },
    {
      label: t.kpi_classes || 'Classes',
      value: classesCount,
      icon: icons.BarChart3,
    },
    {
      label: t.kpi_menus || 'Menus',
      value: menusCount,
      icon: icons.Utensils,
    },
  ], [t, studentsCount, staffCount, classesCount, menusCount, icons]);

  return (
    <PrincipalPageLayout>
      <PrincipalDashboardContent 
        t={t} 
        kpis={kpis} 
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
          <KPICardSkeleton count={4} />
        </div>
      </PrincipalPageLayout>
    }>
      <PrincipalDashboardPageContent />
    </Suspense>
  );
}
