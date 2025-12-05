'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Utensils } from 'lucide-react';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import GuardianPageLayout, { useGuardianPageLayout } from '@/app/components/shared/GuardianPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';

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

function GuardianMenusContent() {
  const { lang, t } = useLanguage();
  const { sidebarRef } = useGuardianPageLayout();
  const { user } = useRequireAuth();

  // Get org_id and class_id from user metadata
  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const classId = userMetadata?.class_id;

  // Initialize from cache immediately if available
  const [menus, setMenus] = useState<Menu[]>(() => {
    if (typeof window !== 'undefined' && orgId) {
      try {
        const cacheKey = `parent_menus_${orgId}`;
        const cached = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(`${cacheKey}_time`);
        if (cached && cacheTime) {
          const cachedMenus = JSON.parse(cached);
          const age = Date.now() - parseInt(cacheTime);
          if (cachedMenus && Array.isArray(cachedMenus) && age < 10 * 60 * 1000 && cachedMenus.length > 0) {
            return cachedMenus;
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    return [];
  });

  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [linkedStudentClasses, setLinkedStudentClasses] = useState<Array<{ classId: string; className?: string }>>([]);
  const [linkedStudents, setLinkedStudents] = useState<Array<{ id: string; class_id: string | null }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('parent_linked_students');
        if (cached) {
          const cachedData = JSON.parse(cached);
          const cacheTime = localStorage.getItem('parent_linked_students_time');
          if (cacheTime && Date.now() - parseInt(cacheTime) < 10 * 60 * 1000 && Array.isArray(cachedData)) {
            return cachedData;
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    return [];
  });

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
        const studentsRes = await fetch(`/api/students`);
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
      } catch (e) {
        // ignore
      }
    }
    deriveClass();
  }, [user?.id, orgId, classId]);

  // Get all linked students and their classes
  useEffect(() => {
    async function getLinkedStudents() {
      if (!user?.id || !orgId) {
        return;
      }

      const hasCachedStudents = linkedStudents.length > 0;

      async function fetchFreshData() {
        if (!user?.id) return;
        try {
          const relRes = await fetch(`/api/guardian-students?guardianId=${user.id}`);
          const relJson = await relRes.json();
          const relationships = relJson.relationships || [];
          const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);
          if (studentIds.length === 0) {
            if (linkedStudents.length > 0) {
              setLinkedStudents([]);
            }
            if (typeof window !== 'undefined') {
              localStorage.setItem('parent_linked_students', JSON.stringify([]));
              localStorage.setItem('parent_linked_students_time', Date.now().toString());
            }
            return;
          }
          const studentsRes = await fetch(`/api/students`);
          const studentsJson = await studentsRes.json();
          const allStudents = studentsJson.students || [];
          const linked = allStudents
            .filter((s: any) => studentIds.includes(s.id))
            .map((s: any) => ({
              id: s.id,
              class_id: s.class_id || s.classes?.id || null
            }));
          
          const currentIds = new Set<string>(linkedStudents.map((s: { id: string; class_id: string | null }) => s.id));
          const newIds = new Set<string>(linked.map((s: { id: string; class_id: string | null }) => s.id));
          const isDifferent = currentIds.size !== newIds.size || 
            Array.from<string>(currentIds).some((id: string) => !newIds.has(id)) ||
            Array.from<string>(newIds).some((id: string) => !currentIds.has(id));
          
          if (isDifferent || linkedStudents.length === 0) {
            setLinkedStudents(linked);
          }
          
          if (typeof window !== 'undefined') {
            localStorage.setItem('parent_linked_students', JSON.stringify(linked));
            localStorage.setItem('parent_linked_students_time', Date.now().toString());
          }
        } catch (e) {
          console.error('Error getting linked students:', e);
        }
      }

      if (hasCachedStudents) {
        fetchFreshData();
      } else {
        await fetchFreshData();
      }
    }
    getLinkedStudents();
  }, [user?.id, orgId]);

  const loadMenus = useCallback(async () => {
    if (!orgId || !user?.id) {
      return;
    }

    const cacheKey = `parent_menus_${orgId}`;
    
    async function fetchFreshMenus(existingMenus: Menu[] | null) {
      setError(null);
      try {
        let allMenus: Menu[] = [];
        
        const classIds = Array.from(new Set(linkedStudents.map(s => s.class_id).filter((id): id is string => Boolean(id))));
        
        if (classIds.length > 0) {
          const menuPromises = classIds.map((cid) => 
            fetch(`/api/menus?classId=${cid}`, { cache: 'no-store' })
              .then(res => res.json())
              .then(json => json.menus || [])
              .catch(() => [])
          );
          menuPromises.push(
            fetch(`/api/menus`, { cache: 'no-store' })
              .then(res => res.json())
              .then(json => (json.menus || []).filter((m: Menu) => !m.class_id))
              .catch(() => [])
          );
          
          const menuArrays = await Promise.all(menuPromises);
          allMenus = menuArrays.flat();
          const uniqueMenus = new Map();
          allMenus.forEach(menu => uniqueMenus.set(menu.id, menu));
          allMenus = Array.from(uniqueMenus.values());
        } else if (classId) {
          const res = await fetch(`/api/menus?classId=${classId}`, { cache: 'no-store' });
          const json = await res.json();
          allMenus = json.menus || [];
        } else {
          const res = await fetch(`/api/menus`, { cache: 'no-store' });
          const json = await res.json();
          allMenus = (json.menus || []).filter((m: Menu) => !m.class_id);
        }
        
        if (existingMenus) {
          const existingIds = new Set(existingMenus.map(m => m.id));
          const newIds = new Set(allMenus.map(m => m.id));
          
          const isDifferent = existingIds.size !== newIds.size || 
            Array.from(existingIds).some(id => !newIds.has(id)) ||
            Array.from(newIds).some(id => !existingIds.has(id));
          
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
          
          if (isDifferent || contentChanged) {
            setMenus(allMenus);
          }
        } else {
          setMenus(allMenus);
        }
        
        if (typeof window !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify(allMenus));
          localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
        }
      } catch (e: any) {
        console.error('Error loading menus:', e);
        const errorMessage = e.message || 'Failed to load menus. Please try again.';
        setError(errorMessage);
      }
    }

    // Check cache first
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(`${cacheKey}_time`);
      
      if (cached && cacheTime) {
        try {
          const cachedMenus = JSON.parse(cached);
          const age = Date.now() - parseInt(cacheTime);
          if (cachedMenus && Array.isArray(cachedMenus) && age < 10 * 60 * 1000 && cachedMenus.length > 0) {
            setMenus(cachedMenus);
            fetchFreshMenus(cachedMenus);
            return;
          }
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }
    }

    await fetchFreshMenus(null);
  }, [orgId, classId, linkedStudents, user]);

  // Load menus when orgId and user are available
  useEffect(() => {
    if (orgId && user?.id) {
      loadMenus();
    }
  }, [orgId, user?.id, loadMenus]);

  // Listen for menu updates
  useEffect(() => {
    const handleMenuUpdate = () => {
      if (typeof window !== 'undefined') {
        const menuUpdated = localStorage.getItem('menu_data_updated');
        if (menuUpdated === 'true') {
          localStorage.removeItem('menu_data_updated');
          if (orgId && user?.id) {
            loadMenus();
          }
        }
      }
    };

    const handleFocus = () => handleMenuUpdate();
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleMenuUpdate();
      }
    };
    const handleCustomEvent = () => handleMenuUpdate();

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('menu-updated', handleCustomEvent);
      handleMenuUpdate();

      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('menu-updated', handleCustomEvent);
      };
    }
  }, [orgId, user?.id, loadMenus]);

  // Filter menus by selected date
  const menusForDate = useMemo(() => {
    if (!orgId) return [];
    const mw: Array<{ className?: string; menu: Menu }> = [];
    (menus || []).forEach((m: any) => {
      if (m.day === selectedDate) {
        let className: string | undefined = undefined;
        const cp = linkedStudentClasses.find(c => c.classId === m.class_id);
        if (cp) className = cp.className;
        mw.push({ className, menu: m });
      }
    });
    return mw;
  }, [menus, selectedDate, linkedStudentClasses, orgId]);

  return (
    <>
      <PageHeader
        title={t.menu || 'Menu'}
        subtitle={t.select_date || 'Select a date to view menus'}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
        rightActions={
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          />
        }
      />

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <strong>{t.error || 'Error'}:</strong> {error}
        </div>
      )}

      {/* Menu Display */}
      {menusForDate.length === 0 ? (
        <div className="rounded-ds-lg border border-slate-200 bg-white p-12 shadow-ds-card dark:border-slate-700 dark:bg-slate-800 text-center">
          <Utensils className="w-16 h-16 mx-auto text-mint-400 dark:text-slate-500 mb-4" />
          <p className="text-ds-small text-slate-500 dark:text-slate-400">{t.empty_menu || 'No menu available for this date'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-ds-sm">
          {menusForDate
            .slice()
            .sort((a, b) => {
              const an = (a.className || 'zzzz').toLowerCase();
              const bn = (b.className || 'zzzz').toLowerCase();
              if (an < bn) return -1; if (an > bn) return 1; return 0;
            })
            .map((entry, idx) => (
            <div key={idx} className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
              {entry.className && (
                <div className="mb-ds-sm text-ds-small font-medium text-slate-700 dark:text-slate-300">{entry.className}</div>
              )}
              <div className="space-y-4">
                {entry.menu.breakfast && (
                  <div className="flex items-start gap-4 p-4 rounded-ds-md bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-3 h-3 rounded-ds-full bg-amber-500"></div>
                    </div>
                    <div className="flex-1">
                      <div className="text-ds-small font-semibold text-amber-900 dark:text-amber-100 mb-1">
                        08:30 - {t.breakfast || 'Breakfast'}
                      </div>
                      <div className="text-ds-small text-amber-700 dark:text-amber-300">{entry.menu.breakfast}</div>
                    </div>
                  </div>
                )}
                {entry.menu.lunch && (
                  <div className="flex items-start gap-4 p-4 rounded-ds-md bg-pale-blue border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-3 h-3 rounded-ds-full bg-blue-500"></div>
                    </div>
                    <div className="flex-1">
                      <div className="text-ds-small font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        12:00 - {t.lunch || 'Lunch'}
                      </div>
                      <div className="text-ds-small text-blue-700 dark:text-blue-300">{entry.menu.lunch}</div>
                    </div>
                  </div>
                )}
                {entry.menu.snack && (
                  <div className="flex items-start gap-4 p-4 rounded-ds-md bg-mint-50 border border-mint-200 dark:bg-green-900/20 dark:border-green-800">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-3 h-3 rounded-ds-full bg-mint-500"></div>
                    </div>
                    <div className="flex-1">
                      <div className="text-ds-small font-semibold text-mint-900 dark:text-green-100 mb-1">
                        14:00 - {t.snack || 'Snack'}
                      </div>
                      <div className="text-ds-small text-mint-700 dark:text-green-300">{entry.menu.snack}</div>
                    </div>
                  </div>
                )}
                {entry.menu.notes && (
                  <div className="mt-4 p-4 rounded-ds-md bg-slate-50 border border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                    <div className="text-ds-tiny font-medium text-slate-500 dark:text-slate-400 mb-2">{t.notes || 'Notes'}</div>
                    <div className="text-ds-small text-slate-700 dark:text-slate-300">{entry.menu.notes}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function GuardianMenusPageContent() {
  return (
    <GuardianPageLayout>
      <GuardianMenusContent />
    </GuardianPageLayout>
  );
}

export default function GuardianMenusPage() {
  return (
    <Suspense fallback={
      <GuardianPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSkeleton type="cards" rows={3} />
        </div>
      </GuardianPageLayout>
    }>
      <GuardianMenusPageContent />
    </Suspense>
  );
}
