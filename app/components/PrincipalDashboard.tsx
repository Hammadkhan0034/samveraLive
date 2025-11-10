'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Users, School, ChartBar as BarChart3, FileText, Plus, ListFilter as Filter, Search, CircleCheck as CheckCircle2, Circle as XCircle, Eye, EyeOff, Settings, Bell, Utensils, Megaphone } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import AnnouncementList from './AnnouncementList';
import { useRouter } from 'next/navigation';
import StoryColumn from './shared/StoryColumn';
 

type Lang = 'is' | 'en';

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function PrincipalDashboard({ lang = 'en' }: { lang?: Lang }) {
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { session } = useAuth?.() || {} as any;
  const router = useRouter();

  // Try to get org_id from multiple possible locations
  const userMetadata = session?.user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  
  // If no org_id in metadata, we need to get it from the database
  const [dbOrgId, setDbOrgId] = useState<string | null>(null);
  
  // Fetch org_id from database if not in metadata
  useEffect(() => {
    if (session?.user?.id && !orgId) {
      const fetchUserOrgId = async () => {
        try {
          const response = await fetch(`/api/user-org-id?user_id=${session.user.id}`);
          const data = await response.json();
          if (response.ok && data.org_id) {
            setDbOrgId(data.org_id);
          }
        } catch (error) {
          console.error('Failed to fetch user org_id:', error);
        }
      };
      fetchUserOrgId();
    }
  }, [session?.user?.id, orgId]);
  
  // Fallback to default org ID if not found in metadata
  const finalOrgId = orgId || dbOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;

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
      } else {
        // If no session, clear old cached data to prevent showing old principal's data
        // This ensures fresh data loads when a new principal signs in
        if (typeof window !== 'undefined') {
          // Clear old non-user-specific cache
          localStorage.removeItem('guardians_count_cache');
          localStorage.removeItem('students_count_cache');
          localStorage.removeItem('staff_count_cache');
          localStorage.removeItem('classes_count_cache');
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
        loadAnnouncementsForKPI()
      ]).then((results) => {
        // Log results for debugging
        results.forEach((result, index) => {
          const names = ['loadOrgs', 'loadClassesForKPI', 'loadStaff', 'loadStaffForKPI', 'loadGuardiansForKPI', 'loadStudentsForKPI', 'loadMenusForKPI', 'loadStoriesForKPI', 'loadAnnouncementsForKPI'];
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
      const res = await fetch('/api/orgs', { cache: 'no-store' });
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
      const res = await fetch(`/api/menus?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
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
      const res = await fetch(`/api/stories?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
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
      
      const res = await fetch(`/api/announcements?${params.toString()}&t=${Date.now()}`, { cache: 'no-store' });
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

  // Listen for stories refresh event
  useEffect(() => {
    const handleStoriesRefresh = () => {
      const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
      if (!orgId) return;
      
      // Fetch and update stories count immediately
      fetch(`/api/stories?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' })
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
        loadAnnouncementsForKPI()
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

  // Organizations states
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string; timezone: string }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  
  // Global loading state - always false to show dashboard immediately
  const [isInitialLoading] = useState(false);


  const kpis = [
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
  ];


  // Load classes count for KPI (simplified, just count)
  async function loadClassesForKPI(showLoading = true) {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;

    try {
      const res = await fetch(`/api/classes?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
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
      const res = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
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
      const response = await fetch(`/api/staff-management?orgId=${finalOrgId}`, { cache: 'no-store' });
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
      const res = await fetch(`/api/guardians?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
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
      const res = await fetch(`/api/students?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
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


  // Data loading is handled in the main useEffect above - no duplicate loading needed

  


  

  



  

  // Do not block UI with a loading overlay; render immediately

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 mt-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
              onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200' : ''
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
      </div>

      {/* School Announcements Section */}
      <div className="mt-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.announcements_list}</h3>
          </div>
          <AnnouncementList
            orgId={finalOrgId}
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
            {[
              t.act_added_class.replace('{name}', 'Rauðkjarni'),
              t.act_invited.replace('{name}', 'Margrét Jónsdóttir'),
              t.act_visibility_off.replace('{name}', 'Rauðkjarni'),
              t.act_export,
            ].map((txt, i) => (
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

/* -------------------- copy -------------------- */

const enText = {
  staff_ssn: 'SSN',
  staff_ssn_placeholder: 'Enter SSN',
  edit: 'Edit',
  edit_staff: 'Edit Staff Member',
  title: 'Principal Dashboard',
  subtitle: 'Manage groups, staff and visibility.',
  kpi_students: 'Total students',
  kpi_staff: 'Total staff',
  kpi_classes: 'Classes',
  kpi_link_student: 'Link Student',
  kpi_guardians: 'Total guardians',
  kpi_menus: 'Menus',
  kpi_stories: 'Stories',
  kpi_announcements: 'Announcements',
  classes_management: 'Classes Management',
  add_class: 'Add class',
  invite_staff: 'Invite staff',
  refresh: 'Refresh',
  export: 'Export',
  settings: 'Settings',
  only_visible: 'Show only visible',
  search_ph: 'Search classes…',
  departments: 'Departments / Classes',
  overview_hint: 'Overview of groups across the school',
  col_name: 'Name',
  col_students: 'Students',
  col_staff: 'Staff',
  col_visible: 'Visible',
  col_actions: 'Actions',
  visible_yes: 'Yes',
  visible_no: 'No',
  hide: 'Hide',
  show: 'Show',
  empty: 'No classes match your filters.',
  recent_activity: 'Recent activity',
  quick_tips: 'Quick tips',
  act_added_class: 'Added class: {name}',
  act_invited: 'Invited new staff member: {name}',
  act_visibility_off: 'Set {name} to hidden',
  act_export: 'Exported monthly report',
  tip_roles: 'Use roles to limit access (RBAC).',
  tip_visibility: 'Toggle visibility per class before publishing.',
  tip_exports: 'Export data and audit trails anytime.',

  // Announcements
  announcements_title: 'Create Announcement',
  announcements_list: 'School Announcements',
  view_all_announcements: 'View All Announcements',

  // Modal
  class_name: 'Class Name',
  class_name_placeholder: 'Enter class name',
  class_description: 'Description',
  class_description_placeholder: 'Enter class description (optional)',
  class_capacity: 'Capacity',
  class_capacity_placeholder: 'Enter max students',
  organization: 'Organization',
  select_organization: 'Select organization',
  cancel: 'Cancel',
  create_class: 'Create Class',

  // Staff Modal
  staff_name: 'Full Name',
  staff_name_placeholder: 'Enter full name',
  staff_email: 'Email',
  staff_email_placeholder: 'Enter email address',
  staff_role: 'Role',
  staff_phone: 'Phone',
  staff_phone_placeholder: 'Enter phone number (optional)',
  staff_address: 'Address',
  staff_address_placeholder: 'Enter address',
  staff_education_level: 'Education Level',
  staff_education_level_placeholder: 'e.g. B.Ed, M.Ed',
  staff_union_membership: 'Union Membership',
  role_teacher: 'Teacher',
  role_assistant: 'Assistant',
  role_specialist: 'Specialist',
  invite_staff_btn: 'Send Invitation',
  staff_created_success: 'Staff member created successfully:',
  invitation_sent: 'Invitation has been sent.',
  staff_creation_error: 'Error creating staff member',
  assign_to_class: 'Assign to Class (Optional)',
  no_class_assigned: 'No class assigned',
  class_assignment_note: 'Teacher will be assigned to this class',
  sending: 'Sending...',
  remove_staff_member: 'Remove Staff Member',
  remove_staff_confirm: 'Are you sure you want to remove this staff member? This action cannot be undone.',
  remove: 'Remove',
  class_created: 'Class Created!',
  class_created_subtitle: 'Successfully added to your dashboard',
  class_is_ready: 'Class is Ready',
  class_created_message: 'has been created and is now visible in your dashboard.',
  class_details: 'Class Details',
  name: 'Name',
  status: 'Status',
  active: 'Active',
  staff: 'Staff',
  done: 'Done',
  staff_invited_success: 'Staff Invited Successfully!',
  invitation_sent_to: 'Invitation sent to',
  account_created_email_sent: 'Account Created & Email Sent',
  invitation_email_sent: 'An invitation email has been sent to',
  with_login_credentials: 'with login credentials.',
  login_credentials: 'Login Credentials',
  password: 'Password',
  copy: 'Copy',
  copy_all_credentials: 'Copy All Credentials',
  manage_staff: 'Manage Staff',
  staff_management: 'Staff Management',
  active_staff_members: 'Active Staff Members',
  pending_invitations: 'Pending Invitations',
  joined: 'Joined',
  sent: 'Sent',
  expires: 'Expires',
  actions: 'Actions',
  inactive: 'Inactive',
  delete: 'Delete',
  loading: 'Loading...',
  no_staff_members: 'No staff members yet',
  no_pending_invitations: 'No pending invitations',
  close: 'Close',

  // Guardian translations
  guardians: 'Guardians',
  create_guardian: 'Create Guardian',
  edit_guardian: 'Edit Guardian',
  delete_guardian: 'Delete Guardian',
  delete_guardian_confirm: 'Are you sure you want to delete this guardian?',
  no_guardians: 'No guardians yet',
  error_loading_guardians: 'Error loading guardians',
  error_creating_guardian: 'Error creating guardian',
  error_updating_guardian: 'Error updating guardian',

  // Student translations
  students: 'Students',
  create_student: 'Create Student',
  edit_student: 'Edit Student',
  delete_student: 'Delete Student',
  delete_student_confirm: 'Are you sure you want to delete this student?',
  student_name: 'Name',
  student_class: 'Class',
  student_guardians: 'Guardians',
  student_dob: 'Date of Birth',
  student_gender: 'Gender',
  no_students: 'No students yet',
  error_loading_students: 'Error loading students',
  error_creating_student: 'Error creating student',
  error_updating_student: 'Error updating student',
  student_age_requirement: 'Student must be between 0-18 years old',

  // Student form specific translations
  student_first_name_placeholder: 'Enter first name',
  student_last_name_placeholder: 'Enter last name',
  student_medical_notes_placeholder: 'Enter medical notes (optional)',
  student_allergies_placeholder: 'Enter allergies (optional)',
  student_emergency_contact_placeholder: 'Enter emergency contact (optional)',
  gender_unknown: 'Unknown',
  gender_male: 'Male',
  gender_female: 'Female',
  gender_other: 'Other',
  no_guardians_available: 'No guardians available',

  // Common form fields (only unique keys)
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  dob: 'Date of Birth',
  gender: 'Gender',
  class: 'Class',
  medical_notes: 'Medical Notes',
  allergies: 'Allergies',
  emergency_contact: 'Emergency Contact',
  first_name_placeholder: 'Enter first name',
  last_name_placeholder: 'Enter last name',
  email_placeholder: 'Enter email address',
  phone_placeholder: 'Enter phone number',
  status_placeholder: 'Select status',

  // Common form actions
  create: 'Create',
  update: 'Update',
  creating: 'Creating...',
  updating: 'Updating...',

};

const isText = {
  staff_ssn: 'Kennitala',
  staff_ssn_placeholder: 'Sláðu inn kennitölu',
  edit: 'Breyta',
  edit_staff: 'Breyta starfsmanni',
  title: 'Stjórnandayfirlit',
  subtitle: 'Sýsla með hópa, starfsfólk og sýnileika.',
  kpi_students: 'Heildarfjöldi nemenda',
  kpi_staff: 'Heildarfjöldi starfsmanna',
  kpi_classes: 'Hópar',
  kpi_link_student: 'Tengja nemanda',
  kpi_guardians: 'Heildarfjöldi forráðamanna',
  kpi_menus: 'Matseðillar',
  kpi_stories: 'Sögur',
  kpi_announcements: 'Tilkynningar',
  classes_management: 'Hópastjórnun',
  add_class: 'Bæta við hóp',
  invite_staff: 'Bjóða starfsmanni',
  refresh: 'Endurnýja',
  export: 'Flytja út',
  settings: 'Stillingar',
  only_visible: 'Sýna aðeins sýnilega',
  search_ph: 'Leita að hópum…',
  departments: 'Deildir / Hópar',
  overview_hint: 'Yfirsýn yfir hópa í skólanum',
  col_name: 'Nafn',
  col_students: 'Nemendur',
  col_staff: 'Starfsmenn',
  col_visible: 'Sýnileg',
  col_actions: 'Aðgerðir',
  visible_yes: 'Já',
  visible_no: 'Nei',
  hide: 'Gera ósýnilegt',
  show: 'Gera sýnilegt',
  empty: 'Engir hópar passa við síur.',
  recent_activity: 'Nýlegar aðgerðir',
  quick_tips: 'Flýtiráð',
  act_added_class: 'Bætt við hóp: {name}',
  act_invited: 'Boð sent til starfsmanns: {name}',
  act_visibility_off: 'Hópur {name} gerður ósýnilegur',
  act_export: 'Útflutningur á mánaðarskýrslu',
  tip_roles: 'Notaðu hlutverk til að stýra aðgengi (RBAC).',
  tip_visibility: 'Kveiktu/slökktu á sýnileika á hópum áður en birt er.',
  tip_exports: 'Flyttu út gögn og atvikaskrár hvenær sem er.',

  // Announcements
  announcements_title: 'Búa til tilkynningu',
  announcements_list: 'Tilkynningar skóla',
  view_all_announcements: 'Skoða allar tilkynningar',

  // Modal
  class_name: 'Nafn hóps',
  class_name_placeholder: 'Sláðu inn nafn hóps',
  class_description: 'Lýsing',
  class_description_placeholder: 'Sláðu inn lýsingu hóps (valfrjálst)',
  class_capacity: 'Fjöldi',
  class_capacity_placeholder: 'Sláðu inn hámarksfjölda nemenda',
  organization: 'Stofnun',
  select_organization: 'Veldu stofnun',
  cancel: 'Hætta við',
  create_class: 'Búa til hóp',

  // Staff Modal
  staff_name: 'Fullt nafn',
  staff_name_placeholder: 'Sláðu inn fullt nafn',
  staff_email: 'Netfang',
  staff_email_placeholder: 'Sláðu inn netfang',
  staff_role: 'Hlutverk',
  staff_phone: 'Sími',
  staff_phone_placeholder: 'Sláðu inn símanúmer (valfrjálst)',
  staff_address: 'Heimilisfang',
  staff_address_placeholder: 'Sláðu inn heimilisfang',
  staff_education_level: 'Menntun',
  staff_education_level_placeholder: 't.d. B.Ed, M.Ed',
  staff_union_membership: 'Stéttarfélagsaðild',
  role_teacher: 'Kennari',
  role_assistant: 'Aðstoðarkennari',
  role_specialist: 'Sérfræðingur',
  invite_staff_btn: 'Senda boð',
  staff_created_success: 'Starfsmaður búinn til:',
  invitation_sent: 'Boð hefur verið sent.',
  staff_creation_error: 'Villa við að búa til starfsmann',
  assign_to_class: 'Úthluta til hóps (valfrjálst)',
  no_class_assigned: 'Enginn hópur úthlutaður',
  class_assignment_note: 'Kennari verður úthlutaður til þessa hóps',
  sending: 'Sendi...',
  remove_staff_member: 'Fjarlægja starfsmann',
  remove_staff_confirm: 'Ertu viss um að þú viljir fjarlægja þennan starfsmann? Þessa aðgerð er ekki hægt að afturkalla.',
  remove: 'Fjarlægja',
  class_created: 'Hópur búinn til!',
  class_created_subtitle: 'Bætt við yfirlitið þitt',
  class_is_ready: 'Hópurinn er tilbúinn',
  class_created_message: 'hefur verið búinn til og er nú sýnilegur í yfirlitinu þínu.',
  class_details: 'Upplýsingar um hóp',
  name: 'Nafn',
  status: 'Staða',
  active: 'Virkur',
  students: 'Nemendur',
  staff: 'Starfsmenn',
  done: 'Lokið',
  staff_invited_success: 'Starfsmaður boðinn með góðum árangri!',
  invitation_sent_to: 'Boð sent til',
  account_created_email_sent: 'Aðgangur búinn til og tölvupóstur sentur',
  invitation_email_sent: 'Boð hefur verið sent til',
  with_login_credentials: 'með innskráningarskilyrðum.',
  login_credentials: 'Innskráningarskilyrði',
  email: 'Netfang',
  password: 'Lykilorð',
  copy: 'Afrita',
  copy_all_credentials: 'Afrita öll skilyrði',
  manage_staff: 'Sýsla með starfsfólk',
  staff_management: 'Sýsla með starfsfólk',
  active_staff_members: 'Virkir starfsmenn',
  pending_invitations: 'Bíðandi boð',
  joined: 'Gekk til liðs',
  sent: 'Sent',
  expires: 'Rennur út',
  actions: 'Aðgerðir',
  inactive: 'Óvirkur',
  delete: 'Eyða',
  loading: 'Hleður...',
  no_staff_members: 'Engir starfsmenn enn',
  no_pending_invitations: 'Engin bíðandi boð',
  close: 'Loka',

  // Guardian translations
  guardians: 'Forráðamenn',
  create_guardian: 'Búa til forráðamann',
  edit_guardian: 'Breyta forráðamanni',
  delete_guardian: 'Eyða forráðamanni',
  delete_guardian_confirm: 'Ertu viss um að þú viljir eyða þessum forráðamanni?',
  no_guardians: 'Engir forráðamenn enn',
  error_loading_guardians: 'Villa við að hlaða forráðamönnum',
  error_creating_guardian: 'Villa við að búa til forráðamann',
  error_updating_guardian: 'Villa við að uppfæra forráðamann',

  // Student translations
  student: 'Nemendur',
  create_student: 'Búa til nemanda',
  edit_student: 'Breyta nemanda',
  delete_student: 'Eyða nemanda',
  delete_student_confirm: 'Ertu viss um að þú viljir eyða þessum nemanda?',
  student_name: 'Nafn',
  student_class: 'Hópur',
  student_guardians: 'Forráðamenn',
  student_dob: 'Fæðingardagur',
  student_gender: 'Kyn',
  no_students: 'Engir nemendur enn',
  error_loading_students: 'Villa við að hlaða nemendum',
  error_creating_student: 'Villa við að búa til nemanda',
  error_updating_student: 'Villa við að uppfæra nemanda',
  student_age_requirement: 'Nemandi verður að vera á aldrinum 0-18 ára',

  // Student form specific translations
  student_first_name_placeholder: 'Sláðu inn fornafn',
  student_last_name_placeholder: 'Sláðu inn eftirnafn',
  student_medical_notes_placeholder: 'Sláðu inn læknisfræðilegar athugasemdir (valfrjálst)',
  student_allergies_placeholder: 'Sláðu inn ofnæmi (valfrjálst)',
  student_emergency_contact_placeholder: 'Sláðu inn neyðarsamband (valfrjálst)',
  gender_unknown: 'Óþekkt',
  gender_male: 'Karl',
  gender_female: 'Kona',
  gender_other: 'Annað',
  no_guardians_available: 'Engir forráðamenn tiltækir',

  // Common form fields (only unique keys)
  first_name: 'Fornafn',
  last_name: 'Eftirnafn',
  phone: 'Sími',
  dob: 'Fæðingardagur',
  gender: 'Kyn',
  class: 'Hópur',
  medical_notes: 'Læknisfræðilegar athugasemdir',
  allergies: 'Ofnæmi',
  emergency_contact: 'Neyðarsamband',
  first_name_placeholder: 'Sláðu inn fornafn',
  last_name_placeholder: 'Sláðu inn eftirnafn',
  email_placeholder: 'Sláðu inn netfang',
  phone_placeholder: 'Sláðu inn símanúmer',
  status_placeholder: 'Veldu staðu',

  // Common form actions
  create: 'Búa til',
  update: 'Uppfæra',
  creating: 'Býr til...',
  updating: 'Uppfærir...',

};
