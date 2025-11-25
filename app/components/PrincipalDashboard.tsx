'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Users, School, ChartBar as BarChart3, FileText, Plus, ListFilter as Filter, Search, CircleCheck as CheckCircle2, Circle as XCircle, Eye, EyeOff, Settings, Bell, Utensils, Megaphone, MessageSquare, CalendarDays, Camera } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCurrentUserOrgId } from '@/lib/hooks/useCurrentUserOrgId';
import AnnouncementList from './AnnouncementList';
import { useRouter } from 'next/navigation';
import StoryColumn from './shared/StoryColumn';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { type CalendarEvent } from './shared/Calendar';
import { getEvents } from '@/lib/server-actions';

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function PrincipalDashboard() {
  const { t, lang } = useLanguage();
  const { session } = useAuth?.() || {} as any;
  const router = useRouter();

  // Use universal hook to get org_id (checks metadata first, then API, handles logout if missing)
  const { orgId: finalOrgId } = useCurrentUserOrgId();

  // Get user metadata from session
  const userMetadata = session?.user?.user_metadata;

  // Store user and org IDs in sessionStorage for cache lookup in menus-list
  useEffect(() => {
    if (session?.user?.id && finalOrgId && typeof window !== 'undefined') {
      sessionStorage.setItem('current_user_id', session.user.id);
      sessionStorage.setItem('current_org_id', finalOrgId);
    }
  }, [session?.user?.id, finalOrgId]);

  // Load cached data immediately on mount - but only for current user
  useEffect(() => {
      // Only load cached data if we have a session user ID to avoid showing old principal's data
      if (typeof window !== 'undefined' && session?.user?.id) {
        const userId = session.user.id;
        // Use user-specific cache keys to prevent showing old principal's data
        const cachedGuardiansCount = localStorage.getItem(`guardians_count_cache_${userId}`);
        const cachedStudentsCount = localStorage.getItem(`students_count_cache_${userId}`);
        const cachedStaffCount = localStorage.getItem(`staff_count_cache_${userId}`);
        const cachedClassesCount = localStorage.getItem(`classes_count_cache_${userId}`);
        
        if (cachedGuardiansCount) setGuardiansCount(parseInt(cachedGuardiansCount));
        if (cachedStudentsCount) setStudentsCount(parseInt(cachedStudentsCount));
        if (cachedStaffCount) setStaffCount(parseInt(cachedStaffCount));
        if (cachedClassesCount) setClassesCount(parseInt(cachedClassesCount));
        
        const cachedMenusCount = localStorage.getItem(`menus_count_cache_${userId}`);
        if (cachedMenusCount) setMenusCount(parseInt(cachedMenusCount));
        
        const cachedStoriesCount = localStorage.getItem(`stories_count_cache_${userId}`);
        if (cachedStoriesCount) setStoriesCount(parseInt(cachedStoriesCount));

        const cachedAnnouncementsCount = localStorage.getItem(`announcements_count_cache_${userId}`);
        if (cachedAnnouncementsCount) setAnnouncementsCount(parseInt(cachedAnnouncementsCount));

        const cachedMessagesCount = localStorage.getItem(`messages_count_cache_${userId}`);
        if (cachedMessagesCount) setMessagesCount(parseInt(cachedMessagesCount));

        const cachedPhotosCount = localStorage.getItem(`photos_count_cache_${userId}`);
        if (cachedPhotosCount) setPhotosCount(parseInt(cachedPhotosCount));

        const cachedCalendarEvents = localStorage.getItem(`calendar_events_cache_${userId}`);
        if (cachedCalendarEvents) setCalendarEvents(JSON.parse(cachedCalendarEvents));
      } else {
        // If no session, clear old cached data to prevent showing old principal's data
        // This ensures fresh data loads when a new principal signs in
        if (typeof window !== 'undefined') {
          // Clear old non-user-specific cache
          localStorage.removeItem('guardians_count_cache');
          localStorage.removeItem('students_count_cache');
          localStorage.removeItem('staff_count_cache');
          localStorage.removeItem('classes_count_cache');
          localStorage.removeItem('menus_count_cache');
          localStorage.removeItem('stories_count_cache');
          localStorage.removeItem('announcements_count_cache');
          localStorage.removeItem('messages_count_cache');
          localStorage.removeItem('photos_count_cache');
        }
      }
  }, [session?.user?.id]);

  // Load fresh data once when session and orgId are available - only once, no refresh
  useEffect(() => {
    // Only load if we have session and orgId, and only once
    if (session?.user?.id && finalOrgId) {
      // Load fresh data in background without showing loading
      Promise.allSettled([
        loadOrgs(false),
        loadClassesForKPI(false),
        loadStaff(false),
        loadStaffForKPI(false),
        loadGuardiansForKPI(false),
        loadStudentsForKPI(false),
        loadMenusForKPI(false),
        loadStoriesForKPI(),
        loadAnnouncementsForKPI(),
        loadMessagesForKPI(false),
        loadPhotosForKPI(false)
      ]).then((results) => {
        // Log results for debugging
        results.forEach((result, index) => {
          const names = ['loadOrgs', 'loadClassesForKPI', 'loadStaff', 'loadStaffForKPI', 'loadGuardiansForKPI', 'loadStudentsForKPI', 'loadMenusForKPI', 'loadStoriesForKPI', 'loadAnnouncementsForKPI', 'loadPhotosForKPI'];
          if (result.status === 'rejected') {
            console.error(`❌ ${names[index]} failed:`, result.reason);
          } else {
            console.log(`✅ ${names[index]} completed`);
          }
        });
      });
    }
  }, [session?.user?.id, finalOrgId]);

  // Check on mount if stories were just updated (when returning from add-story page)
  useEffect(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const storiesUpdated = localStorage.getItem('stories_data_updated');
      if (storiesUpdated === 'true') {
        localStorage.removeItem('stories_data_updated');
        loadStoriesForKPI();
      }
    }
  }, [session?.user?.id, finalOrgId]);

  // Listen for student data changes triggered from other pages (e.g., Add Student)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'students_data_changed') {
        refreshAllData();
        try { localStorage.removeItem('students_data_changed'); } catch {}
      }
      if (e.key === 'stories_data_updated') {
        loadStoriesForKPI();
        try { localStorage.removeItem('stories_data_updated'); } catch {}
      }
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        const studentFlag = typeof window !== 'undefined' ? localStorage.getItem('students_data_changed') : null;
        if (studentFlag) {
          refreshAllData();
          try { localStorage.removeItem('students_data_changed'); } catch {}
        }
        const storiesFlag = typeof window !== 'undefined' ? localStorage.getItem('stories_data_updated') : null;
        if (storiesFlag) {
          loadStoriesForKPI();
          try { localStorage.removeItem('stories_data_updated'); } catch {}
        }
      }
    }
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [session?.user?.id]);

  // Load organizations
  async function loadOrgs(showLoading = true) {
    try {
      if (showLoading) setLoadingOrgs(true);
      const res = await fetch('/api/orgs', { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setOrgs(json.orgs || []);
    } catch (e: any) {
      console.error('❌ Error loading organizations:', e.message);
    } finally {
      if (showLoading) setLoadingOrgs(false);
    }
  }

  // Load menus count for KPI
  async function loadMenusForKPI(showLoading = true) {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;

    try {
      const res = await fetch(`/api/menus?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const menusList = json.menus || [];
      setMenusCount(menusList.length);
      
      // Cache count for instant loading
      if (typeof window !== 'undefined') {
        if (session?.user?.id) {
          localStorage.setItem(`menus_count_cache_${session.user.id}`, menusList.length.toString());
        }
      }
    } catch (e: any) {
      console.error('❌ Error loading menus count:', e.message);
    }
  }

  async function loadStoriesForKPI() {
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
  }

  async function loadAnnouncementsForKPI() {
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
  }

  async function loadMessagesForKPI(showLoading = true) {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId || !session?.user?.id) return;
    try {
      const res = await fetch(`/api/messages?userId=${session.user.id}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const threads = json.threads || [];
      // Count unread threads
      const unreadCount = threads.filter((t: any) => t.unread).length;
      setMessagesCount(unreadCount);
      if (typeof window !== 'undefined' && session?.user?.id) {
        localStorage.setItem(`messages_count_cache_${session.user.id}`, String(unreadCount));
      }
    } catch (e: any) {
      console.error('❌ Error loading messages count:', e.message);
    }
  }

  async function loadPhotosForKPI(showLoading = true) {
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
  }

  // Calendar state (for KPI count only)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

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
        
        // Validate that events is an array
        if (Array.isArray(events)) {
          setCalendarEvents(events as CalendarEvent[]);
        } else {
          console.warn('⚠️ Calendar events response is not an array:', events);
          setCalendarEvents([]);
        }
      } catch (e: any) {
        // Silently fail for calendar events - it's not critical for dashboard
        console.error('❌ Error loading calendar events:', e?.message || e?.toString() || 'Unknown error');
        setCalendarEvents([]);
      }
    };

    if (finalOrgId && session?.user?.id) {
      loadCalendarEventsForKPI();
    }
  }, [finalOrgId, session?.user?.id]);

  // Listen for stories refresh event
  useEffect(() => {
    const handleStoriesRefresh = () => {
      const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
      if (!orgId) return;
      
      // Fetch and update stories count immediately
      fetch(`/api/stories?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' })
        .then(res => res.json())
        .then(json => {
          if (json.stories && Array.isArray(json.stories)) {
            const count = json.stories.length;
            setStoriesCount(count);
            if (typeof window !== 'undefined' && session?.user?.id) {
              localStorage.setItem(`stories_count_cache_${session.user.id}`, String(count));
            }
          }
        })
        .catch(e => {
          console.error('❌ Error refreshing stories count:', e.message);
        });
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('stories-refresh', handleStoriesRefresh);
      return () => {
        window.removeEventListener('stories-refresh', handleStoriesRefresh);
      };
    }
  }, [finalOrgId, session?.user?.id]);

  // Listen for announcements refresh event
  useEffect(() => {
    const handleAnnouncementsRefresh = () => {
      loadAnnouncementsForKPI();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('announcements-refresh', handleAnnouncementsRefresh);
      return () => {
        window.removeEventListener('announcements-refresh', handleAnnouncementsRefresh);
      };
    }
  }, [finalOrgId, session?.user?.id, userMetadata]);

  // Listen for photos refresh event
  useEffect(() => {
    const handlePhotosRefresh = () => {
      loadPhotosForKPI();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('photos-refresh', handlePhotosRefresh);
      return () => {
        window.removeEventListener('photos-refresh', handlePhotosRefresh);
      };
    }
  }, [finalOrgId, session?.user?.id]);

  // Refresh all data function for real-time updates
  const refreshAllData = async () => {
    if (session?.user?.id) {
      await Promise.all([
        loadOrgs(),
        loadClassesForKPI(),
        loadStaff(),
        loadStaffForKPI(),
        loadGuardiansForKPI(),
        loadStudentsForKPI(),
        loadMenusForKPI(),
        loadStoriesForKPI(),
        loadAnnouncementsForKPI(),
        loadMessagesForKPI(),
        loadPhotosForKPI()
      ]);
    }
  };

  // Demo data
  
  const [classesCount, setClassesCount] = useState(0);
  // Classes list for staff form dropdown only
  const [classesForDropdown, setClassesForDropdown] = useState<Array<{ id: string; name: string; code: string | null }>>([]);

  // Staff management states
  const [staff, setStaff] = useState<Array<{ id: string; email: string; first_name: string; last_name: string | null; is_active: boolean; created_at: string }>>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // KPI data states (simplified for counts only) - initialize from cache
  const [guardiansCount, setGuardiansCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('guardians_count_cache');
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [studentsCount, setStudentsCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('students_count_cache');
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [staffCount, setStaffCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('staff_count_cache');
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

  // Organizations states
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string; timezone: string }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  
  // Global loading state - always false to show dashboard immediately
  const [isInitialLoading] = useState(false);

  // Memoize activity items to ensure they update when language changes
  const activityItems = useMemo(() => [
    t.act_added_class.replace('{name}', 'Rauðkjarni'),
    t.act_invited.replace('{name}', 'Margrét Jónsdóttir'),
    t.act_visibility_off.replace('{name}', 'Rauðkjarni'),
    t.act_export,
  ], [t, lang]);

  // Memoize KPIs to ensure they update when language changes
  const kpis = useMemo(() => [
    { 
      label: t.kpi_students, 
      value: studentsCount, 
      icon: Users,
      onClick: () => router.push('/dashboard/principal/students')
    },
    { 
      label: t.kpi_staff, 
      value: staffCount, 
      icon: School,
      onClick: () => router.push('/dashboard/principal/staff')
    },
    { 
      label: t.kpi_classes, 
      value: classesCount, 
      icon: BarChart3,
      onClick: () => router.push('/dashboard/principal/classes')
    },
    { 
      label: t.kpi_link_student, 
      value: '', 
      icon: Users,
      onClick: () => router.push('/dashboard/link-student')
    },
    { 
      label: t.kpi_guardians, 
      value: guardiansCount, 
      icon: Users,
      onClick: () => router.push('/dashboard/guardians')
    },
    { 
      label: t.kpi_menus, 
      value: menusCount, 
      icon: Utensils,
      onClick: () => router.push('/dashboard/menus-list')
    },
    {
      label: t.kpi_stories,
      value: storiesCount,
      icon: FileText,
      onClick: () => router.push('/dashboard/stories')
    },
    {
      label: t.kpi_announcements,
      value: announcementsCount,
      icon: Megaphone,
      onClick: () => router.push('/dashboard/announcements')
    },
    {
      label: t.kpi_messages,
      value: messagesCount,
      icon: MessageSquare,
      onClick: () => router.push('/dashboard/principal/messages')
    },
    {
      label: t.kpi_photos,
      value: photosCount,
      icon: Camera,
      onClick: () => router.push('/dashboard/principal/photos')
    },
  ], [t, lang, studentsCount, staffCount, classesCount, guardiansCount, menusCount, storiesCount, announcementsCount, messagesCount, photosCount, router]);


  // Load classes count for KPI (simplified, just count)
  async function loadClassesForKPI(showLoading = true) {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;

    try {
      const res = await fetch(`/api/classes?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const classesList = json.classes || [];
      setClassesCount(classesList.length);
      // Also update dropdown list
      setClassesForDropdown(classesList.map((cls: any) => ({ id: cls.id, name: cls.name, code: cls.code })));
      
      // Cache count for instant loading
      if (typeof window !== 'undefined') {
        if (session?.user?.id) {
          localStorage.setItem(`classes_count_cache_${session.user.id}`, classesList.length.toString());
        }
      }
    } catch (e: any) {
      console.error('❌ Error loading classes count:', e.message);
    }
  }

  // Load staff count for KPI (fast, just count)
  async function loadStaffForKPI(showLoading = true) {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;

    try {
      const res = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const staffList = json.staff || [];
      setStaffCount(staffList.length);
      
      // Cache count for instant loading
      if (typeof window !== 'undefined') {
        if (session?.user?.id) {
          localStorage.setItem(`staff_count_cache_${session.user.id}`, staffList.length.toString());
        }
      }
    } catch (e: any) {
      console.error('❌ Error loading staff count:', e.message);
    }
  }

  // Load staff members
  async function loadStaff(showLoading = true) {
    if (!finalOrgId) return;
    if (loadingStaff && showLoading) return;
    try {
      if (showLoading) setLoadingStaff(true);
      const response = await fetch(`/api/staff-management?orgId=${finalOrgId}`, { cache: 'no-store', credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load staff');
      setStaff(data.staff || []);
      const staffList = data.staff || [];
      setStaffCount(staffList.length);
      if (typeof window !== 'undefined' && session?.user?.id) {
        localStorage.setItem(`staff_count_cache_${session.user.id}`, staffList.length.toString());
      }
    } catch (error: any) {
      // Keep dashboard resilient; do not surface error toast here
    } finally {
      if (showLoading) setLoadingStaff(false);
    }
  }

  // Guardian functions (simplified for KPI counts only)
  async function loadGuardiansForKPI(showLoading = true) {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;

    try {
      const res = await fetch(`/api/guardians?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const guardiansList = json.guardians || [];
      setGuardiansCount(guardiansList.length);
      
      // Cache both count and full data for instant loading
      if (typeof window !== 'undefined') {
        if (session?.user?.id) {
          localStorage.setItem(`guardians_count_cache_${session.user.id}`, guardiansList.length.toString());
          localStorage.setItem(`guardians_cache_${session.user.id}`, JSON.stringify(guardiansList));
        }
      }
    } catch (e: any) {
      console.error('❌ Error loading guardians count:', e.message);
    }
  }

  // Student functions (simplified for KPI counts only)
  async function loadStudentsForKPI(showLoading = true) {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;

    try {
      const res = await fetch(`/api/students?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const studentsList = json.students || [];
      console.log('📊 Loaded students:', studentsList.length, studentsList);
      
      setStudentsCount(studentsList.length);
      
      // Cache both count and full data for instant loading
      if (typeof window !== 'undefined') {
        if (session?.user?.id) {
          localStorage.setItem(`students_count_cache_${session.user.id}`, studentsList.length.toString());
          localStorage.setItem(`students_cache_${session.user.id}`, JSON.stringify(studentsList));
        }
      }
    } catch (e: any) {
      console.error('❌ Error loading students count:', e.message);
    }
  }


 

  

  

  



  

  // Do not block UI with a loading overlay; render immediately

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between mt-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.subtitle}</p>
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
        orgId={finalOrgId}
        userId={session?.user?.id}
        userRole="principal"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, onClick }, i) => (
          <div
            key={i}
            className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${
              onClick !== undefined ? 'cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200' : ''
            }`}
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
        {/* Calendar KPI Card - Inline */}
        {(() => {
          const today = new Date();
          const currentMonth = today.getMonth();
          const currentYear = today.getFullYear();
          const currentMonthEvents = calendarEvents.filter(event => {
            const eventDate = new Date(event.start_at);
            return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
          });
          
          return (
            <div
              onClick={() => router.push('/dashboard/principal/calendar')}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-400">{t.tile_calendar || 'Calendar'}</div>
                <span className="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                  <CalendarDays className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {currentMonthEvents.length}
              </div>
            </div>
          );
        })()}
      </div>

      {/* School Announcements Section */}
      <div className="mt-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.announcements_list}</h3>
          </div>
          <AnnouncementList
            orgId={finalOrgId as string}
            userId={session?.user?.id}
            userRole={(userMetadata?.role || userMetadata?.activeRole || 'principal') as string}
            showAuthor={true}
            limit={5}
            lang={lang}
          />
        </div>
      </div>

      {/* Activity feed */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.recent_activity}</h3>
          <ul className="mt-3 space-y-3 text-sm">
            {activityItems.map((txt, i) => (
              <li key={i} className="rounded-xl border border-slate-200 p-3 text-slate-700 dark:border-slate-600 dark:text-slate-300">
                {txt}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.quick_tips}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
            <li>{t.tip_roles}</li>
            <li>{t.tip_visibility}</li>
            <li>{t.tip_exports}</li>
          </ul>
        </div>
      </div>


    </main>
  );
}
