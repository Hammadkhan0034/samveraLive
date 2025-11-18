'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Plus, Calendar, Utensils, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import TeacherLayout from '@/app/components/shared/TeacherLayout';

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
  created_at?: string;
  updated_at?: string;
}

export default function MenusListPage() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { user, loading, isSigningIn } = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Get org_id from user metadata
  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const classId = userMetadata?.class_id;

  // Initialize from cache immediately if available to avoid loading state
  const [menus, setMenus] = useState<Menu[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedUserId = sessionStorage.getItem('current_user_id');
        const cachedOrgId = sessionStorage.getItem('current_org_id');
        if (cachedUserId && cachedOrgId) {
          const cacheKey = `menus_list_${cachedUserId}_${cachedOrgId}`;
          const cached = localStorage.getItem(cacheKey);
          const cacheTime = localStorage.getItem(`${cacheKey}_time`);
          if (cached && cacheTime) {
            const cachedMenus = JSON.parse(cached);
            const age = Date.now() - parseInt(cacheTime);
            if (cachedMenus && Array.isArray(cachedMenus) && age < 5 * 60 * 1000 && cachedMenus.length > 0) {
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
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isDeleteMenuModalOpen, setIsDeleteMenuModalOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState<string | null>(null);
  const [deletingMenu, setDeletingMenu] = useState(false);
  const [deleteMenuError, setDeleteMenuError] = useState<string | null>(null);

  // Language handled by context


  // Store user and org IDs in sessionStorage for cache lookup
  useEffect(() => {
    if (user?.id && orgId && typeof window !== 'undefined') {
      sessionStorage.setItem('current_user_id', user.id);
      sessionStorage.setItem('current_org_id', orgId);
    }
  }, [user?.id, orgId]);

  const loadMenus = useCallback(async () => {
    if (!orgId || !user?.id) {
      return;
    }

    // Check cache first for instant display
    const cacheKey = `menus_list_${user.id}_${orgId}`;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(`${cacheKey}_time`);
      
      if (cached && cacheTime) {
        try {
          const cachedMenus = JSON.parse(cached);
          const age = Date.now() - parseInt(cacheTime);
          // Use cache if less than 5 minutes old
          if (age < 5 * 60 * 1000 && cachedMenus && Array.isArray(cachedMenus) && cachedMenus.length > 0) {
            setMenus(cachedMenus);
            // Fetch fresh data in background
            fetchFreshMenus(cachedMenus);
            return;
          }
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }
    }

    // No cache, fetch immediately
    await fetchFreshMenus(null);

    async function fetchFreshMenus(existingMenus: Menu[] | null) {
      setLoadingMenus(true);
      setError(null);
      try {
      // Determine user role
      const role = (userMetadata?.role || userMetadata?.user_role || userMetadata?.app_role || '').toString().toLowerCase();
      const isTeacher = role === 'teacher' || (userMetadata?.roles && Array.isArray(userMetadata.roles) && userMetadata.roles.includes('teacher'));
      
      let allMenus: Menu[] = [];
      
      if (isTeacher && user?.id) {
        // For teachers: get all menus for their assigned classes
        try {
          const teacherClassesRes = await fetch(`/api/teacher-classes?userId=${user.id}&t=${Date.now()}`, { cache: 'no-store' });
          const teacherClassesData = await teacherClassesRes.json();
          const teacherClasses = teacherClassesData.classes || [];
          
          console.log('📚 Teacher classes:', teacherClasses);
          
          // If teacher has assigned classes, get menus for each class
          if (teacherClasses.length > 0) {
            const classIds = teacherClasses.map((c: any) => c.id);
            console.log('📋 Fetching menus for class IDs:', classIds);
            
            // Fetch menus for each class - Filter by createdBy to show only menus created by this teacher
            const menuPromises = classIds.map((cid: string) => 
              fetch(`/api/menus?orgId=${orgId}&classId=${cid}&createdBy=${user.id}`, { cache: 'no-store' })
                .then(res => res.json())
                .then(json => {
                  const menus = json.menus || [];
                  console.log(`✅ Found ${menus.length} menu(s) created by teacher for class ${cid}`);
                  return menus;
                })
                .catch((err) => {
                  console.error(`❌ Error fetching menus for class ${cid}:`, err);
                  return [];
                })
            );
            // Also get org-wide menus (class_id null) created by this teacher
            menuPromises.push(
              fetch(`/api/menus?orgId=${orgId}&createdBy=${user.id}`, { cache: 'no-store' })
                .then(res => res.json())
                .then(json => {
                  const orgMenus = (json.menus || []).filter((m: Menu) => !m.class_id);
                  console.log(`✅ Found ${orgMenus.length} org-wide menu(s) created by teacher`);
                  return orgMenus;
                })
                .catch((err) => {
                  console.error('❌ Error fetching org-wide menus:', err);
                  return [];
                })
            );
            
            const menuArrays = await Promise.all(menuPromises);
            allMenus = menuArrays.flat();
            console.log(`📊 Total menus before deduplication: ${allMenus.length}`);
            
            // Remove duplicates by id
            const uniqueMenus = new Map();
            allMenus.forEach(menu => uniqueMenus.set(menu.id, menu));
            allMenus = Array.from(uniqueMenus.values());
            
            console.log(`📊 Total unique menus after deduplication: ${allMenus.length}`);
          } else {
            // No classes assigned, show org-wide menus created by this teacher only
            const res = await fetch(`/api/menus?orgId=${orgId}&createdBy=${user.id}`, { cache: 'no-store' });
            const json = await res.json();
            allMenus = (json.menus || []).filter((m: Menu) => !m.class_id);
          }
        } catch (e) {
          console.error('❌ Error loading teacher classes for menus:', e);
          // Fallback to org-wide menus created by this teacher
          const res = await fetch(`/api/menus?orgId=${orgId}&createdBy=${user.id}`, { cache: 'no-store' });
          const json = await res.json();
          allMenus = json.menus || [];
        }
      } else {
        // For principals or others: show all menus
        const url = `/api/menus?orgId=${orgId}${classId ? `&classId=${classId}` : ''}`;
        const res = await fetch(url, { 
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          const errorText = await res.text();
          let errorJson;
          try {
            errorJson = JSON.parse(errorText);
          } catch {
            throw new Error(`Failed to load menus: ${res.status} ${res.statusText}`);
          }
          throw new Error(errorJson.error || `Failed to load menus: ${res.status}`);
        }

        const json = await res.json();
        allMenus = json.menus || [];
      }
      
        // Only update if menus are actually different to prevent blinking
        if (existingMenus) {
          const existingIds = new Set(existingMenus.map(m => m.id));
          const newIds = new Set(allMenus.map(m => m.id));
          const isDifferent = existingIds.size !== newIds.size || 
            Array.from<string>(existingIds).some((id: string) => !newIds.has(id)) ||
            Array.from<string>(newIds).some((id: string) => !existingIds.has(id));
          
          if (isDifferent) {
            setMenus(allMenus);
          }
        } else {
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
        if (!existingMenus) {
          setMenus([]);
        }
      } finally {
        setLoadingMenus(false);
      }
    }
  }, [orgId, classId, user?.id, userMetadata]);

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

    // Listen for window focus (when user returns from edit page)
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

  // Also listen for pathname changes (when navigating back from edit page)
  useEffect(() => {
    if (pathname === '/dashboard/menus-list') {
      // Check if menu was updated when we navigate to this page
      if (typeof window !== 'undefined') {
        const menuUpdated = localStorage.getItem('menu_data_updated');
        if (menuUpdated === 'true') {
          localStorage.removeItem('menu_data_updated');
          if (orgId && user?.id) {
            loadMenus();
          }
        }
      }
    }
  }, [pathname, orgId, user?.id, loadMenus]);

  // Load menus when orgId is available
  useEffect(() => {
    if (orgId) {
      loadMenus();
    }
  }, [orgId, loadMenus]);

  // Reload menus when returning from add-menu page or when page becomes visible
  useEffect(() => {
    if (!orgId) return;

    const handleFocus = () => {
      // Check if menu was just created/updated
      if (typeof window !== 'undefined') {
        const menuUpdated = localStorage.getItem('menu_data_updated');
        if (menuUpdated === 'true') {
          localStorage.removeItem('menu_data_updated');
          loadMenus();
          return;
        }
      }
      loadMenus();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Check if menu was just created/updated
        if (typeof window !== 'undefined') {
          const menuUpdated = localStorage.getItem('menu_data_updated');
          if (menuUpdated === 'true') {
            localStorage.removeItem('menu_data_updated');
            loadMenus();
            return;
          }
        }
        loadMenus();
      }
    };
    
    // Check on mount if menu was just created
    if (typeof window !== 'undefined') {
      const menuUpdated = localStorage.getItem('menu_data_updated');
      if (menuUpdated === 'true') {
        localStorage.removeItem('menu_data_updated');
        loadMenus();
      }
    }
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [orgId, loadMenus]);

  function openDeleteMenuModal(id: string) {
    setMenuToDelete(id);
    setIsDeleteMenuModalOpen(true);
    setDeleteMenuError(null);
  }

  async function confirmDeleteMenu() {
    if (!menuToDelete) return;
    
    setDeletingMenu(true);
    setDeleteMenuError(null);
    
    try {
      const res = await fetch(`/api/menus?id=${menuToDelete}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      
      setIsDeleteMenuModalOpen(false);
      setMenuToDelete(null);
      await loadMenus();
    } catch (e: any) {
      console.error('❌ Error deleting menu:', e.message);
      setDeleteMenuError(e.message);
    } finally {
      setDeletingMenu(false);
    }
  }


  // Filter menus by selected date
  const filteredMenus = menus.filter(m => !selectedDate || m.day === selectedDate);
  const totalPages = Math.ceil(filteredMenus.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMenus = filteredMenus.slice(startIndex, startIndex + itemsPerPage);

  // Only show loading if we're actually loading and don't have a user yet
  if (loading && !user && isSigningIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading menus page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Check if user is a teacher
  const role = (userMetadata?.role || userMetadata?.user_role || userMetadata?.app_role || userMetadata?.activeRole || '').toString().toLowerCase();
  const isTeacher = role === 'teacher' || (userMetadata?.roles && Array.isArray(userMetadata.roles) && userMetadata.roles.includes('teacher'));

  const content = (
      <div className="h-full bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          {/* Header with Back button */}
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {lang === 'is' ? 'Til baka' : 'Back'}
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => router.push('/dashboard/add-menu')}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Plus className="h-4 w-4" /> {t.add_menu}
              </button>
            </div>
          </div>

          {/* Date Filter */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.filter_by_date}</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                />
                {selectedDate && (
                  <button
                    onClick={() => {
                      setSelectedDate('');
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 whitespace-nowrap"
                  >
                    {t.clear_filter}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Menus Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            {paginatedMenus.length === 0 ? (
              <div className="text-center py-12">
                <Utensils className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-500 mb-4" />
                <p className="text-slate-600 dark:text-slate-400">{t.no_menus}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg">
                  <table className="w-full text-sm border-collapse rounded-lg">
                    <thead className="bg-black text-white dark:bg-slate-800">
                      <tr>
                        <th className="py-2 px-4 text-left">{t.created_date || 'Created'}</th>
                        <th className="py-2 px-4 text-left">{t.breakfast}</th>
                        <th className="py-2 px-4 text-left">{t.lunch}</th>
                        <th className="py-2 px-4 text-left">{t.snack}</th>
                        <th className="py-2 px-4 text-left">{t.notes}</th>
                        <th className="py-2 px-4 text-center">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    
                      {paginatedMenus.map((menu) => (
                        <tr key={menu.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="py-3 px-4 text-black dark:text-slate-300">
                            {menu.created_at ? new Date(menu.created_at).toLocaleString(lang === 'is' ? 'is-IS' : 'en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '—'}
                          </td>
                          <td className="py-3 px-4 text-black dark:text-slate-300">{menu.breakfast || '—'}</td>
                          <td className="py-3 px-4 text-black dark:text-slate-300">{menu.lunch || '—'}</td>
                          <td className="py-3 px-4 text-black dark:text-slate-300">{menu.snack || '—'}</td>
                          <td className="py-3 px-4 text-black dark:text-slate-300">{menu.notes || '—'}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => router.push(`/dashboard/add-menu?id=${menu.id}`)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                              >
                                <Edit className="h-3 w-3" /> {t.edit}
                              </button>
                              <button
                                onClick={() => openDeleteMenuModal(menu.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="h-3 w-3" /> {t.delete}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {t.prev}
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm ${currentPage === page ? 'bg-white text-black border border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600' : 'border border-slate-400 dark:border-slate-600 dark:text-slate-200'}`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {t.next}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

        {/* Delete Menu Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={isDeleteMenuModalOpen}
          onClose={() => {
            setIsDeleteMenuModalOpen(false);
            setMenuToDelete(null);
            setDeleteMenuError(null);
          }}
          onConfirm={confirmDeleteMenu}
          title={t.delete_menu || 'Delete Menu'}
          message={t.delete_confirm || 'Are you sure you want to delete this menu? This action cannot be undone.'}
          loading={deletingMenu}
          error={deleteMenuError}
          confirmButtonText={t.delete}
          cancelButtonText={t.cancel}
        />
        </div>
      </div>
  );

  if (isTeacher) {
    return <TeacherLayout hideHeader={true}>{content}</TeacherLayout>;
  }

  return content;
}

const enText = {
  title: 'Menus',
  subtitle: 'Manage daily menus for your organization.',
  back: 'Back',
  add_menu: 'Add Menu',
  edit: 'Edit',
  delete: 'Delete',
  loading: 'Loading...',
  date: 'Date',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  notes: 'Notes',
  actions: 'Actions',
  no_menus: 'No menus found. Click "Add Menu" to create one.',
  filter_by_date: 'Filter by Date',
  clear_filter: 'Clear Filter',
  delete_confirm: 'Are you sure you want to delete this menu?',
  delete_menu: 'Delete Menu',
  cancel: 'Cancel',
  prev: 'Prev',
  next: 'Next',
  created_date: 'Created Date',
};

const isText = {
  title: 'Matseðillar',
  subtitle: 'Sýsla með daglegar matseðla fyrir stofnunina þína.',
  back: 'Til baka',
  add_menu: 'Bæta við matseðli',
  edit: 'Breyta',
  delete: 'Eyða',
  loading: 'Hleður...',
  date: 'Dagsetning',
  breakfast: 'Morgunmatur',
  lunch: 'Hádegismatur',
  snack: 'Kvöldmatur',
  notes: 'Athugasemdir',
  actions: 'Aðgerðir',
  no_menus: 'Engir matseðillar fundust. Smelltu á "Bæta við matseðli" til að búa til einn.',
  filter_by_date: 'Sía eftir dagsetningu',
  clear_filter: 'Hreinsa síu',
  delete_confirm: 'Ertu viss um að þú viljir eyða þessum matseðli?',
  delete_menu: 'Eyða matseðli',
  cancel: 'Hætta við',
  prev: 'Fyrri',
  next: 'Næst',
  created_date: 'Búið til',
};

