'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Utensils, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';

type Lang = 'is' | 'en';

interface Menu {
  id: string;
  org_id: string;
  class_id?: string | null;
  day: string;
  breakfast?: string | null;
  lunch?: string | null;
  snack?: string | null;
  notes?: string | null;
  is_public?: boolean;
  created_at: string;
  updated_at?: string;
}

export default function MenusViewPage() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { user, loading, isSigningIn } = useRequireAuth();
  const { signOut } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Get org_id and class_id from user metadata
  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const classId = userMetadata?.class_id;

  // Initialize from cache immediately if available to avoid loading state
  const [menus, setMenus] = useState<Menu[]>(() => {
    // Load from cache synchronously during initialization
    if (typeof window !== 'undefined') {
      try {
        // Try to get user from session storage or a global variable if available
        // We'll update this in useEffect when user is available
        const cachedUserId = sessionStorage.getItem('current_user_id');
        const cachedOrgId = sessionStorage.getItem('current_org_id');
        if (cachedUserId && cachedOrgId) {
          const cacheKey = `parent_menus_${cachedUserId}_${cachedOrgId}`;
          const cached = localStorage.getItem(cacheKey);
          const cacheTime = localStorage.getItem(`${cacheKey}_time`);
          if (cached && cacheTime) {
            const cachedMenus = JSON.parse(cached);
            const age = Date.now() - parseInt(cacheTime);
            if (cachedMenus && Array.isArray(cachedMenus) && age < 10 * 60 * 1000 && cachedMenus.length > 0) {
              return cachedMenus;
            }
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    return [];
  });
  const [hydratedFromCache, setHydratedFromCache] = useState(() => {
    // Check if we loaded from cache during initialization
    if (typeof window !== 'undefined') {
      try {
        const cachedUserId = sessionStorage.getItem('current_user_id');
        const cachedOrgId = sessionStorage.getItem('current_org_id');
        if (cachedUserId && cachedOrgId) {
          const cacheKey = `parent_menus_${cachedUserId}_${cachedOrgId}`;
          const cached = localStorage.getItem(cacheKey);
          const cacheTime = localStorage.getItem(`${cacheKey}_time`);
          if (cached && cacheTime) {
            const cachedMenus = JSON.parse(cached);
            const age = Date.now() - parseInt(cacheTime);
            if (cachedMenus && Array.isArray(cachedMenus) && age < 10 * 60 * 1000 && cachedMenus.length > 0) {
              return true;
            }
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    return false;
  });
  const [loadingMenus, setLoadingMenus] = useState(false); // Start with false - will load from cache immediately
  const [loadingLinkedStudents, setLoadingLinkedStudents] = useState(false); // Start with false
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [derivedClassId, setDerivedClassId] = useState<string | null>(null);
  const [linkedStudentClasses, setLinkedStudentClasses] = useState<Array<{ classId: string; className?: string }>>([]);

  // Derive class_id from linked students if not in metadata
  useEffect(() => {
    async function deriveClass() {
      try {
        if (!user?.id || !orgId) return;
        const relRes = await fetch(`/api/guardian-students?guardianId=${user.id}`);
        const relJson = await relRes.json();
        const relationships = relJson.relationships || [];
        const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);
        if (studentIds.length === 0) return;
        const studentsRes = await fetch(`/api/students?orgId=${orgId}`);
        const studentsJson = await studentsRes.json();
        const allStudents = studentsJson.students || [];
        const classPairs: Array<{ classId: string; className?: string }> = [];
        for (const s of allStudents) {
          if (studentIds.includes(s.id)) {
            const cid = s.class_id || s.classes?.id;
            if (cid && !classPairs.find(c => c.classId === cid)) {
              classPairs.push({ classId: cid, className: s.classes?.name });
            }
          }
        }
        if (classPairs.length > 0) setLinkedStudentClasses(classPairs);
        if (!classId && classPairs.length > 0) setDerivedClassId(classPairs[0].classId);
      } catch (e) {
        // ignore
      }
    }
    deriveClass();
  }, [user?.id, orgId, classId]);
  const [linkedStudents, setLinkedStudents] = useState<Array<{ id: string; class_id: string | null }>>(() => {
    // Load from cache synchronously during initialization
    if (typeof window !== 'undefined') {
      try {
        const cachedUserId = sessionStorage.getItem('current_user_id');
        if (cachedUserId) {
          const cached = localStorage.getItem(`parent_linked_students_${cachedUserId}`);
          if (cached) {
            const cachedData = JSON.parse(cached);
            const cacheTime = localStorage.getItem(`parent_linked_students_time_${cachedUserId}`);
            if (cacheTime && Date.now() - parseInt(cacheTime) < 10 * 60 * 1000 && Array.isArray(cachedData)) {
              return cachedData;
            }
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    return [];
  });

  // Store user and org IDs in sessionStorage for cache lookup
  useEffect(() => {
    if (user?.id && orgId && typeof window !== 'undefined') {
      sessionStorage.setItem('current_user_id', user.id);
      sessionStorage.setItem('current_org_id', orgId);
    }
  }, [user?.id, orgId]);

  // Get all linked students and their classes - load from cache immediately, then refresh in background
  useEffect(() => {
    async function getLinkedStudents() {
      if (!user?.id || !orgId) {
        return;
      }

      // Check if we already have linked students from cache (initialized in useState)
      // If yes, only fetch fresh data in background
      const hasCachedStudents = linkedStudents.length > 0;

      async function fetchFreshData() {
        if (!user?.id) return;
        try {
          const relRes = await fetch(`/api/guardian-students?guardianId=${user.id}`);
          const relJson = await relRes.json();
          const relationships = relJson.relationships || [];
          const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);
          if (studentIds.length === 0) {
            // Only update if different from current state
            if (linkedStudents.length > 0) {
              setLinkedStudents([]);
            }
            if (typeof window !== 'undefined') {
              localStorage.setItem(`parent_linked_students_${user.id}`, JSON.stringify([]));
              localStorage.setItem(`parent_linked_students_time_${user.id}`, Date.now().toString());
            }
            return;
          }
          const studentsRes = await fetch(`/api/students?orgId=${orgId}`);
          const studentsJson = await studentsRes.json();
          const allStudents = studentsJson.students || [];
          const linked = allStudents
            .filter((s: any) => studentIds.includes(s.id))
            .map((s: any) => ({
              id: s.id,
              class_id: s.class_id || s.classes?.id || null
            }));
          
          // Only update if different
          const currentIds = new Set<string>(linkedStudents.map((s: { id: string; class_id: string | null }) => s.id));
          const newIds = new Set<string>(linked.map((s: { id: string; class_id: string | null }) => s.id));
          const isDifferent = currentIds.size !== newIds.size || 
            Array.from<string>(currentIds).some((id: string) => !newIds.has(id)) ||
            Array.from<string>(newIds).some((id: string) => !currentIds.has(id));
          
          if (isDifferent || linkedStudents.length === 0) {
            setLinkedStudents(linked);
          }
          
          // Always update cache
          if (typeof window !== 'undefined') {
            localStorage.setItem(`parent_linked_students_${user.id}`, JSON.stringify(linked));
            localStorage.setItem(`parent_linked_students_time_${user.id}`, Date.now().toString());
          }
        } catch (e) {
          console.error('Error getting linked students:', e);
          // Keep cached data on error
        }
      }

      // If we have cached students, only refresh in background
      // Otherwise fetch immediately
      if (hasCachedStudents) {
        fetchFreshData();
      } else {
        await fetchFreshData();
      }
    }
    getLinkedStudents();
  }, [user?.id, orgId]); // Removed linkedStudents from dependencies to prevent re-renders

  // Language handled by context


  const loadMenus = useCallback(async () => {
    if (!orgId || !user?.id) {
      return;
    }

    // Check cache first for instant display
    const cacheKey = `parent_menus_${user.id}_${orgId}`;
    let cachedMenus: Menu[] | null = null;
    let fromCache = false;
    
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(`${cacheKey}_time`);
      
      if (cached && cacheTime) {
        try {
          cachedMenus = JSON.parse(cached);
          const age = Date.now() - parseInt(cacheTime);
          // Use cache if less than 10 minutes old
          if (cachedMenus && Array.isArray(cachedMenus) && age < 10 * 60 * 1000 && cachedMenus.length > 0) {
            setMenus(cachedMenus);
            fromCache = true;
            // Fetch fresh data in background without showing loading
            // Only update if data is actually different to prevent blinking
            fetchFreshMenus(cachedMenus);
            return;
          }
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }
    }

    // No cache, fetch immediately (but silently in background)
    await fetchFreshMenus(null);

    async function fetchFreshMenus(existingMenus: Menu[] | null) {
      setError(null);
      try {
        let allMenus: Menu[] = [];
        
        // Get unique class IDs from linked students
        const classIds = Array.from(new Set(linkedStudents.map(s => s.class_id).filter((id): id is string => Boolean(id))));
        
        if (classIds.length > 0) {
          // Fetch menus for each class in parallel
          const menuPromises = classIds.map((cid) => 
            fetch(`/api/menus?orgId=${orgId}&classId=${cid}`, { cache: 'no-store' })
              .then(res => res.json())
              .then(json => json.menus || [])
              .catch(() => [])
          );
          // Also get org-wide menus (class_id null)
          menuPromises.push(
            fetch(`/api/menus?orgId=${orgId}`, { cache: 'no-store' })
              .then(res => res.json())
              .then(json => (json.menus || []).filter((m: Menu) => !m.class_id))
              .catch(() => [])
          );
          
          const menuArrays = await Promise.all(menuPromises);
          allMenus = menuArrays.flat();
          // Remove duplicates by id
          const uniqueMenus = new Map();
          allMenus.forEach(menu => uniqueMenus.set(menu.id, menu));
          allMenus = Array.from(uniqueMenus.values());
        } else if (classId) {
          // Fallback to metadata classId if no linked students
          const res = await fetch(`/api/menus?orgId=${orgId}&classId=${classId}`, { cache: 'no-store' });
          const json = await res.json();
          allMenus = json.menus || [];
        } else {
          // Get org-wide menus only
          const res = await fetch(`/api/menus?orgId=${orgId}`, { cache: 'no-store' });
          const json = await res.json();
          allMenus = (json.menus || []).filter((m: Menu) => !m.class_id);
        }
        
        // Only update state if menus are actually different to prevent blinking
        if (existingMenus) {
          // Compare menus to see if they're different
          const existingIds = new Set(existingMenus.map(m => m.id));
          const newIds = new Set(allMenus.map(m => m.id));
          
          // Check if sets are different
          const isDifferent = existingIds.size !== newIds.size || 
            Array.from(existingIds).some(id => !newIds.has(id)) ||
            Array.from(newIds).some(id => !existingIds.has(id));
          
          // Also check if menu content changed (for same IDs)
          let contentChanged = false;
          if (!isDifferent) {
            for (const menu of allMenus) {
              const existing = existingMenus.find(m => m.id === menu.id);
              if (existing && (
                existing.day !== menu.day ||
                existing.breakfast !== menu.breakfast ||
                existing.lunch !== menu.lunch ||
                existing.snack !== menu.snack ||
                existing.notes !== menu.notes
              )) {
                contentChanged = true;
                break;
              }
            }
          }
          
          // Only update if menus are actually different
          if (isDifferent || contentChanged) {
            setMenus(allMenus);
          }
          // If same, don't update - prevents blinking
        } else {
          // No existing menus, update normally
          setMenus(allMenus);
        }
        
        // Always update cache
        if (typeof window !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify(allMenus));
          localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
        }
      } catch (e: any) {
        console.error('❌ Error loading menus:', e);
        const errorMessage = e.message || 'Failed to load menus. Please try again.';
        setError(errorMessage);
        // Keep cached menus on error
      }
    }
  }, [orgId, classId, linkedStudents, user?.id]);

  // Hydrate from cache instantly on mount if available
  useEffect(() => {
    if (orgId && user?.id) {
      try {
        const cacheKey = `parent_menus_${user.id}_${orgId}`;
        const cached = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(`${cacheKey}_time`);
        if (cached && cacheTime) {
          const cachedMenus = JSON.parse(cached);
          const age = Date.now() - parseInt(cacheTime);
          if (cachedMenus && Array.isArray(cachedMenus) && age < 10 * 60 * 1000 && cachedMenus.length > 0) {
            setMenus(cachedMenus);
            setHydratedFromCache(true);
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
  }, [orgId, user?.id]);

  // Load menus when orgId and user are available - use cache immediately, refresh in background
  // Use a ref to track if we've already loaded menus to prevent duplicate calls
  const menusLoadedRef = useRef(false);
  
  useEffect(() => {
    if (orgId && user?.id && !menusLoadedRef.current) {
      menusLoadedRef.current = true;
      loadMenus();
    }
  }, [orgId, user?.id]); // Removed loadMenus from dependencies to prevent re-renders

  // Listen for menu updates and refresh instantly
  useEffect(() => {
    const handleMenuUpdate = () => {
      // Check if menu was updated
      if (typeof window !== 'undefined') {
        const menuUpdated = localStorage.getItem('menu_data_updated');
        if (menuUpdated === 'true') {
          // Clear the flag
          localStorage.removeItem('menu_data_updated');
          // Refresh menus instantly
          if (orgId && user?.id) {
            loadMenus();
          }
        }
      }
    };

    // Listen for window focus (when user returns from another page)
    const handleFocus = () => handleMenuUpdate();
    // Listen for visibility change (when tab becomes visible)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleMenuUpdate();
      }
    };
    // Listen for custom menu update event
    const handleCustomEvent = () => handleMenuUpdate();

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('menu-updated', handleCustomEvent);
      // Also check immediately in case page is already focused
      handleMenuUpdate();

      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('menu-updated', handleCustomEvent);
      };
    }
  }, [orgId, user?.id, loadMenus]);


  // Filter menus by selected date
  const [menusForDate, setMenusForDate] = useState<Array<{ className?: string; menu: Menu }>>([]);

  useEffect(() => {
    if (!orgId) return;
    const finalClassIds: string[] = [];
    if (classId) finalClassIds.push(classId);
    linkedStudentClasses.forEach(c => { if (!finalClassIds.includes(c.classId)) finalClassIds.push(c.classId); });

    const mw: Array<{ className?: string; menu: Menu }> = [];
    (menus || []).forEach((m: any) => {
      if (m.day === selectedDate) {
        let className: string | undefined = undefined;
        const cp = linkedStudentClasses.find(c => c.classId === m.class_id);
        if (cp) className = cp.className;
        mw.push({ className, menu: m });
      }
    });
    setMenusForDate(mw);
  }, [menus, selectedDate, classId, linkedStudentClasses, orgId]);
  
  // Get class names for menus
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  
  useEffect(() => {
    async function loadClassNames() {
      if (!orgId || menusForDate.length === 0) return;
      try {
        const classesRes = await fetch(`/api/classes?orgId=${orgId}`, { cache: 'no-store' });
        const classesData = await classesRes.json();
        const classes = classesData.classes || classesData || [];
        const neededIds = Array.from(new Set((menus || []).map((m: any) => m.class_id).filter((id: any): id is string => Boolean(id))));
        if (neededIds.length === 0) return;
        const names: Record<string, string> = {};
        classes.forEach((cls: any) => {
          if (neededIds.includes(cls.id)) {
            names[cls.id] = cls.name || 'Unknown Class';
          }
        });
        setClassNames(names);
      } catch (e) {
        console.error('Error loading class names:', e);
      }
    }
    loadClassNames();
  }, [orgId, menusForDate, menus]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    if (!mounted) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading && !user && isSigningIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              {t.loading}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // menuForDate removed; we use menusForDate list

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">

        {/* Main Content */}
        <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 mt-10">
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {lang === 'is' ? 'Til baka' : 'Back'}
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {t.title}
            </h1>
          </div>
          {/* Date Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t.select_date}
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-auto rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            />
          </div>

          {/* Menu Display */}
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          ) : menusForDate.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 shadow-sm dark:border-slate-700 dark:bg-slate-800 text-center">
              <Utensils className="w-16 h-16 mx-auto text-slate-400 dark:text-slate-500 mb-4" />
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty_menu}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menusForDate
                .slice()
                .sort((a, b) => {
                  const an = (a.className || 'zzzz').toLowerCase();
                  const bn = (b.className || 'zzzz').toLowerCase();
                  if (an < bn) return -1; if (an > bn) return 1; return 0;
                })
                .map((entry, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  {entry.className && (
                    <div className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">{entry.className}</div>
                  )}
                  <div className="space-y-4">
                    {entry.menu.breakfast && (
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                            08:30 - {t.breakfast}
                          </div>
                          <div className="text-sm text-amber-700 dark:text-amber-300">{entry.menu.breakfast}</div>
                        </div>
                      </div>
                    )}
                    {entry.menu.lunch && (
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                            12:00 - {t.lunch}
                          </div>
                          <div className="text-sm text-blue-700 dark:text-blue-300">{entry.menu.lunch}</div>
                        </div>
                      </div>
                    )}
                    {entry.menu.snack && (
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                            14:00 - {t.snack}
                          </div>
                          <div className="text-sm text-green-700 dark:text-green-300">{entry.menu.snack}</div>
                        </div>
                      </div>
                    )}
                    {entry.menu.notes && (
                      <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{t.notes}</div>
                        <div className="text-sm text-slate-700 dark:text-slate-300">{entry.menu.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
      </main>
    </div>
  );
}

const enText = {
  title: "Today's Menu",
  select_date: 'Select Date',
  loading: 'Loading...',
  empty_menu: 'No menu available for this date',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  notes: 'Notes',
  all_classes: 'All Classes',
  back: 'Back',
};

const isText = {
  title: 'Matseðill dagsins',
  select_date: 'Veldu dagsetningu',
  loading: 'Hleður...',
  empty_menu: 'Enginn matseðill tiltækur fyrir þessa dagsetningu',
  breakfast: 'Morgunmatur',
  lunch: 'Hádegismatur',
  snack: 'Snakk',
  notes: 'Athugasemdir',
  all_classes: 'Allar bekkir',
  back: 'Til baka',
};

