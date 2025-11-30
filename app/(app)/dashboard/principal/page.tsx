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
import { type CalendarEvent } from '@/app/components/shared/Calendar';
import { getEvents } from '@/lib/server-actions';

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
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.title || 'Principal Dashboard'}
          </h2>
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
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
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
          <KPICardSkeleton count={11} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map(({ label, value, icon: Icon, onClick }, i) => (
              <div
                key={i}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
                onClick={onClick}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
                  <span className="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                    <Icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
              </div>
            ))}
            {/* Calendar KPI Card */}
            <div
              onClick={() => router.push('/dashboard/principal/calendar')}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-400">{t.tile_calendar || 'Calendar'}</div>
                <span className="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                  <CalendarDays className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {calendarEventsCount}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function PrincipalDashboardPageContent() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { session } = useAuth?.() || {} as any;
  const { orgId: finalOrgId } = useCurrentUserOrgId();
  const userMetadata = session?.user?.user_metadata;

  // Store user and org IDs in sessionStorage for cache lookup in menus-list
  useEffect(() => {
    if (session?.user?.id && finalOrgId && typeof window !== 'undefined') {
      sessionStorage.setItem('current_user_id', session.user.id);
      sessionStorage.setItem('current_org_id', finalOrgId);
    }
  }, [session?.user?.id, finalOrgId]);

  // KPI data states - initialize from cache
  const [guardiansCount, setGuardiansCount] = useState(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const cached = localStorage.getItem(`guardians_count_cache_${session.user.id}`);
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [studentsCount, setStudentsCount] = useState(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const cached = localStorage.getItem(`students_count_cache_${session.user.id}`);
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [staffCount, setStaffCount] = useState(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const cached = localStorage.getItem(`staff_count_cache_${session.user.id}`);
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [classesCount, setClassesCount] = useState(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const cached = localStorage.getItem(`classes_count_cache_${session.user.id}`);
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [menusCount, setMenusCount] = useState(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const cached = localStorage.getItem(`menus_count_cache_${session.user.id}`);
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [storiesCount, setStoriesCount] = useState(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const cached = localStorage.getItem(`stories_count_cache_${session.user.id}`);
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [announcementsCount, setAnnouncementsCount] = useState(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const cached = localStorage.getItem(`announcements_count_cache_${session.user.id}`);
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [messagesCount, setMessagesCount] = useState(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const cached = localStorage.getItem(`messages_count_cache_${session.user.id}`);
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [photosCount, setPhotosCount] = useState(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const cached = localStorage.getItem(`photos_count_cache_${session.user.id}`);
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load cached data immediately on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const userId = session.user.id;
      const cachedGuardiansCount = localStorage.getItem(`guardians_count_cache_${userId}`);
      const cachedStudentsCount = localStorage.getItem(`students_count_cache_${userId}`);
      const cachedStaffCount = localStorage.getItem(`staff_count_cache_${userId}`);
      const cachedClassesCount = localStorage.getItem(`classes_count_cache_${userId}`);
      const cachedMenusCount = localStorage.getItem(`menus_count_cache_${userId}`);
      const cachedStoriesCount = localStorage.getItem(`stories_count_cache_${userId}`);
      const cachedAnnouncementsCount = localStorage.getItem(`announcements_count_cache_${userId}`);
      const cachedMessagesCount = localStorage.getItem(`messages_count_cache_${userId}`);
      const cachedPhotosCount = localStorage.getItem(`photos_count_cache_${userId}`);
      const cachedCalendarEvents = localStorage.getItem(`calendar_events_cache_${userId}`);

      if (cachedGuardiansCount) setGuardiansCount(parseInt(cachedGuardiansCount));
      if (cachedStudentsCount) setStudentsCount(parseInt(cachedStudentsCount));
      if (cachedStaffCount) setStaffCount(parseInt(cachedStaffCount));
      if (cachedClassesCount) setClassesCount(parseInt(cachedClassesCount));
      if (cachedMenusCount) setMenusCount(parseInt(cachedMenusCount));
      if (cachedStoriesCount) setStoriesCount(parseInt(cachedStoriesCount));
      if (cachedAnnouncementsCount) setAnnouncementsCount(parseInt(cachedAnnouncementsCount));
      if (cachedMessagesCount) setMessagesCount(parseInt(cachedMessagesCount));
      if (cachedPhotosCount) setPhotosCount(parseInt(cachedPhotosCount));
      if (cachedCalendarEvents) setCalendarEvents(JSON.parse(cachedCalendarEvents));
    }
  }, [session?.user?.id]);

  // Load functions
  const loadMenusForKPI = useCallback(async () => {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;
    try {
      const res = await fetch(`/api/menus?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const menusList = json.menus || [];
      setMenusCount(menusList.length);
      if (typeof window !== 'undefined' && session?.user?.id) {
        localStorage.setItem(`menus_count_cache_${session.user.id}`, menusList.length.toString());
      }
    } catch (e: any) {
      console.error('❌ Error loading menus count:', e.message);
    }
  }, [finalOrgId, session?.user?.id]);

  const loadStoriesForKPI = useCallback(async () => {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;
    try {
      const res = await fetch(`/api/stories?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const list = json.stories || [];
      setStoriesCount(list.length);
      if (typeof window !== 'undefined' && session?.user?.id) {
        localStorage.setItem(`stories_count_cache_${session.user.id}`, String(list.length));
      }
    } catch (e: any) {
      console.error('❌ Error loading stories count:', e.message);
    }
  }, [finalOrgId, session?.user?.id]);

  const loadAnnouncementsForKPI = useCallback(async () => {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId || !session?.user?.id) return;
    try {
      const params = new URLSearchParams();
      params.set('userId', session.user.id);
      params.set('userRole', (userMetadata?.role || userMetadata?.activeRole || 'principal') as string);
      params.set('limit', '100');
      const res = await fetch(`/api/announcements?${params.toString()}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const list = json.announcements || [];
      setAnnouncementsCount(list.length);
      if (typeof window !== 'undefined' && session?.user?.id) {
        localStorage.setItem(`announcements_count_cache_${session.user.id}`, String(list.length));
      }
    } catch (e: any) {
      console.error('❌ Error loading announcements count:', e.message);
    }
  }, [finalOrgId, session?.user?.id, userMetadata]);

  const loadMessagesForKPI = useCallback(async () => {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId || !session?.user?.id) return;
    try {
      const res = await fetch(`/api/messages?userId=${session.user.id}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const threads = json.threads || [];
      const unreadCount = threads.filter((t: any) => t.unread).length;
      setMessagesCount(unreadCount);
      if (typeof window !== 'undefined' && session?.user?.id) {
        localStorage.setItem(`messages_count_cache_${session.user.id}`, String(unreadCount));
      }
    } catch (e: any) {
      console.error('❌ Error loading messages count:', e.message);
    }
  }, [finalOrgId, session?.user?.id]);

  const loadPhotosForKPI = useCallback(async () => {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;
    try {
      const res = await fetch(`/api/photos?orgId=${orgId}&limit=100&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const photosList = json.photos || [];
      setPhotosCount(photosList.length);
      if (typeof window !== 'undefined' && session?.user?.id) {
        localStorage.setItem(`photos_count_cache_${session.user.id}`, String(photosList.length));
      }
    } catch (e: any) {
      console.error('❌ Error loading photos count:', e.message);
    }
  }, [finalOrgId, session?.user?.id]);

  const loadClassesForKPI = useCallback(async () => {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;
    try {
      const res = await fetch(`/api/classes?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const classesList = json.classes || [];
      setClassesCount(classesList.length);
      if (typeof window !== 'undefined' && session?.user?.id) {
        localStorage.setItem(`classes_count_cache_${session.user.id}`, classesList.length.toString());
      }
    } catch (e: any) {
      console.error('❌ Error loading classes count:', e.message);
    }
  }, [finalOrgId, session?.user?.id]);

  const loadStaffForKPI = useCallback(async () => {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;
    try {
      const res = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const staffList = json.staff || [];
      setStaffCount(staffList.length);
      if (typeof window !== 'undefined' && session?.user?.id) {
        localStorage.setItem(`staff_count_cache_${session.user.id}`, staffList.length.toString());
      }
    } catch (e: any) {
      console.error('❌ Error loading staff count:', e.message);
    }
  }, [finalOrgId, session?.user?.id]);

  const loadGuardiansForKPI = useCallback(async () => {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;
    try {
      const res = await fetch(`/api/guardians?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const guardiansList = json.guardians || [];
      setGuardiansCount(guardiansList.length);
      if (typeof window !== 'undefined' && session?.user?.id) {
        localStorage.setItem(`guardians_count_cache_${session.user.id}`, guardiansList.length.toString());
      }
    } catch (e: any) {
      console.error('❌ Error loading guardians count:', e.message);
    }
  }, [finalOrgId, session?.user?.id]);

  const loadStudentsForKPI = useCallback(async () => {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;
    try {
      const res = await fetch(`/api/students?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const studentsList = json.students || [];
      setStudentsCount(studentsList.length);
      if (typeof window !== 'undefined' && session?.user?.id) {
        localStorage.setItem(`students_count_cache_${session.user.id}`, studentsList.length.toString());
      }
    } catch (e: any) {
      console.error('❌ Error loading students count:', e.message);
    }
  }, [finalOrgId, session?.user?.id]);

  // Load calendar events for KPI count
  useEffect(() => {
    const loadCalendarEventsForKPI = async () => {
      const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
      if (!orgId) return;
      try {
        const events = await getEvents(orgId, {
          userRole: 'principal',
          userId: session?.user?.id,
        });
        if (Array.isArray(events)) {
          setCalendarEvents(events as CalendarEvent[]);
          if (typeof window !== 'undefined' && session?.user?.id) {
            localStorage.setItem(`calendar_events_cache_${session.user.id}`, JSON.stringify(events));
          }
        } else {
          setCalendarEvents([]);
        }
      } catch (e: any) {
        console.error('❌ Error loading calendar events:', e?.message || e?.toString() || 'Unknown error');
        setCalendarEvents([]);
      }
    };
    if (finalOrgId && session?.user?.id) {
      loadCalendarEventsForKPI();
    }
  }, [finalOrgId, session?.user?.id]);

  // Main effect: Load metrics on mount
  useEffect(() => {
    if (!session?.user?.id || !finalOrgId) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchAllMetrics = async () => {
      try {
        setIsLoading(true);
        setError(null);
        await Promise.all([
          loadClassesForKPI(),
          loadStaffForKPI(),
          loadGuardiansForKPI(),
          loadStudentsForKPI(),
          loadMenusForKPI(),
          loadStoriesForKPI(),
          loadAnnouncementsForKPI(),
          loadMessagesForKPI(),
          loadPhotosForKPI(),
        ]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard metrics. Please try again.';
        setError(message);
        console.error('Error loading metrics:', err);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchAllMetrics();

    return () => {
      abortController.abort();
    };
  }, [session?.user?.id, finalOrgId, loadClassesForKPI, loadStaffForKPI, loadGuardiansForKPI, loadStudentsForKPI, loadMenusForKPI, loadStoriesForKPI, loadAnnouncementsForKPI, loadMessagesForKPI, loadPhotosForKPI]);

  // Retry function
  const handleRetry = useCallback(() => {
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    // Trigger reload by updating a dependency
    setIsLoading(true);
    setTimeout(() => {
      if (session?.user?.id && finalOrgId) {
        Promise.all([
          loadClassesForKPI(),
          loadStaffForKPI(),
          loadGuardiansForKPI(),
          loadStudentsForKPI(),
          loadMenusForKPI(),
          loadStoriesForKPI(),
          loadAnnouncementsForKPI(),
          loadMessagesForKPI(),
          loadPhotosForKPI(),
        ]).finally(() => setIsLoading(false));
      }
    }, 100);
  }, [session?.user?.id, finalOrgId, loadClassesForKPI, loadStaffForKPI, loadGuardiansForKPI, loadStudentsForKPI, loadMenusForKPI, loadStoriesForKPI, loadAnnouncementsForKPI, loadMessagesForKPI, loadPhotosForKPI]);

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

  // Calculate current month calendar events count
  const currentMonthEventsCount = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.start_at);
      return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
    }).length;
  }, [calendarEvents]);

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
      value: '',
      icon: icons.Users,
      onClick: () => router.push('/dashboard/link-student'),
    },
  ], [t, studentsCount, staffCount, classesCount, guardiansCount, menusCount, storiesCount, announcementsCount, messagesCount, photosCount, icons, router]);

  return (
    <PrincipalPageLayout messagesBadge={messagesCount > 0 ? messagesCount : undefined}>
      <PrincipalDashboardContent 
        t={t} 
        kpis={kpis} 
        calendarEventsCount={currentMonthEventsCount}
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
