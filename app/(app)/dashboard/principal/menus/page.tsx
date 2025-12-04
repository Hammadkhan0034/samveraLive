'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Plus, Calendar, Utensils, Edit, Trash2, ArrowLeft, Menu } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import TeacherLayout from '@/app/components/shared/TeacherLayout';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import Loading from '@/app/components/shared/Loading';

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

export default function PrincipalMenusPage() {
  const { lang, t } = useLanguage();
  const { user, loading, isSigningIn, session } = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize from cache immediately if available to avoid loading state
  const [menus, setMenus] = useState<Menu[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cacheKey = 'menus_list';
        const cached = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(`${cacheKey}_time`);
        if (cached && cacheTime) {
          const cachedMenus = JSON.parse(cached);
          const age = Date.now() - parseInt(cacheTime);
          if (cachedMenus && Array.isArray(cachedMenus) && age < 5 * 60 * 1000 && cachedMenus.length > 0) {
            return cachedMenus;
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



  const loadMenus = useCallback(async () => {
   

    // Check cache first for instant display
    const cacheKey = 'menus_list';
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
      const metadataForRole = user?.user_metadata || session?.user?.user_metadata;
      const role = (metadataForRole?.role || metadataForRole?.user_role || metadataForRole?.app_role || '').toString().toLowerCase();
      const isTeacher = role === 'teacher' || (metadataForRole?.roles && Array.isArray(metadataForRole.roles) && metadataForRole.roles.includes('teacher'));
      
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
            
            // Fetch menus for each class - Server will automatically filter by created_by for teachers
            const menuPromises = classIds.map((cid: string) => 
              fetch(`/api/menus?classId=${cid}`, { cache: 'no-store' })
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
              fetch(`/api/menus`, { cache: 'no-store' })
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
            const res = await fetch(`/api/menus`, { cache: 'no-store' });
            const json = await res.json();
            allMenus = (json.menus || []).filter((m: Menu) => !m.class_id);
          }
        } catch (e) {
          console.error('❌ Error loading teacher classes for menus:', e);
          // Fallback to org-wide menus created by this teacher
          const res = await fetch(`/api/menus`, { cache: 'no-store' });
          const json = await res.json();
          allMenus = json.menus || [];
        }
      } else {
        // For principals or others: show all menus (server handles org_id from auth)
        const res = await fetch(`/api/menus`, { 
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
  }, [user?.id, user?.user_metadata, session?.user?.user_metadata]);

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
          if (user?.id) {
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
  }, [user?.id, loadMenus]);

  // Also listen for pathname changes (when navigating back from edit page)
  useEffect(() => {
    if (pathname === '/dashboard/principal/menus') {
      // Check if menu was updated when we navigate to this page
      if (typeof window !== 'undefined') {
        const menuUpdated = localStorage.getItem('menu_data_updated');
        if (menuUpdated === 'true') {
          localStorage.removeItem('menu_data_updated');
          if (user?.id) {
            loadMenus();
          }
        }
      }
    }
  }, [pathname, user?.id, loadMenus]);

  // Load menus when user is available
  useEffect(() => {
    if (user?.id) {
      loadMenus();
    }
  }, [user?.id, loadMenus]);

  // Reload menus when returning from add-menu page or when page becomes visible
  useEffect(() => {
    if (!user?.id) return;

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
  }, [user?.id, loadMenus]);

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
    return <Loading fullScreen text="Loading menus page..." />;
  }

  if (!user) return null;

  // Check if user is a teacher or principal
  const userMetadata = user?.user_metadata || session?.user?.user_metadata;
  const role = (userMetadata?.role || userMetadata?.user_role || userMetadata?.app_role || userMetadata?.activeRole || '').toString().toLowerCase();
  const isTeacher = role === 'teacher' || (userMetadata?.roles && Array.isArray(userMetadata.roles) && userMetadata.roles.includes('teacher'));
  const isPrincipal = role === 'principal' || (userMetadata?.roles && Array.isArray(userMetadata.roles) && userMetadata.roles.includes('principal'));

  // Content for teacher layout (with gradient background and back button)
  const teacherContent = (
      <div className="min-h-screen bg-mint-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-0 md:px-6">
          {/* Header with Back button */}
          <div className="mb-ds-md flex items-center gap-3 flex-wrap mt-16">
            <button
              onClick={() => router.push('/dashboard/principal')}
              className="inline-flex items-center gap-2 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {lang === 'is' ? 'Til baka' : 'Back'}
            </button>
            <h1 className="text-ds-h1 font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.tile_menus || 'Menus'}</h1>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => router.push('/dashboard/add-menu')}
                className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-4 py-2 text-ds-small text-white transition-colors"
              >
                <Plus className="h-4 w-4" /> {t.add_menu}
              </button>
            </div>
          </div>

          {/* Date Filter */}
          <div className="mb-ds-md rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col gap-ds-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-mint-600 dark:text-slate-400" />
                <span className="text-ds-small font-medium text-slate-700 dark:text-slate-300">{t.filter_by_date}</span>
              </div>
              <div className="flex items-center gap-ds-sm">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="flex-1 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                />
                {selectedDate && (
                  <button
                    onClick={() => {
                      setSelectedDate('');
                      setCurrentPage(1);
                    }}
                    className="rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 whitespace-nowrap"
                  >
                    {t.clear_filter}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Menus Table */}
          <div className="rounded-ds-lg border border-slate-200 bg-white pt-6 px-6 pb-0 shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
            {paginatedMenus.length === 0 ? (
              <div className="text-center py-12">
                <Utensils className="h-12 w-12 mx-auto text-mint-400 dark:text-slate-500 mb-4" />
                <p className="text-slate-600 dark:text-slate-400">{t.no_menus}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-ds-md">
                  <table className="w-full text-ds-small border-collapse rounded-ds-md">
                    <thead className="bg-mint-500 text-white dark:bg-slate-800">
                      <tr>
                        <th className="py-2 px-4 text-left rounded-tl-ds-md">{t.created_date || 'Created'}</th>
                        <th className="py-2 px-4 text-left">{t.breakfast}</th>
                        <th className="py-2 px-4 text-left">{t.lunch}</th>
                        <th className="py-2 px-4 text-left">{t.snack}</th>
                        <th className="py-2 px-4 text-left">{t.notes}</th>
                        <th className="py-2 px-4 text-center rounded-tr-ds-md">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">

                      {paginatedMenus.map((menu) => (
                        <tr key={menu.id} className="hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors">
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
                                className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2 py-1 text-ds-tiny hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                              >
                                <Edit className="h-3 w-3" /> {t.edit}
                              </button>
                              <button
                                onClick={() => openDeleteMenuModal(menu.id)}
                                className="inline-flex items-center gap-1 rounded-ds-sm border border-red-300 px-2 py-1 text-ds-tiny text-red-600 hover:bg-red-50 transition-colors dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
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
                  <div className="mt-4 mb-0 pb-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {t.prev}
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`inline-flex items-center rounded-ds-md px-3 py-1.5 text-ds-small transition-colors ${currentPage === page ? 'bg-mint-500 text-white border border-mint-500' : 'border border-slate-400 hover:bg-mint-50 dark:border-slate-600 dark:text-slate-200'}`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
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

  // Content for principal layout (matching students/guardians page structure)
  function PrincipalMenusContent() {
    const { sidebarRef } = usePrincipalPageLayout();

    return (
      <>
        {/* Content Header */}
        <div className="mb-ds-sm flex flex-col gap-ds-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-ds-sm">
            {/* Mobile menu button */}
            <button
              onClick={() => sidebarRef.current?.open()}
              className="md:hidden p-2 rounded-ds-md hover:bg-mint-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-ds-h1 font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.tile_menus || 'Menus'}</h2>
              <p className="mt-1 text-ds-small text-slate-600 dark:text-slate-400">Manage daily menus</p>
            </div>
          </div>

          <div className="flex items-center gap-ds-sm">
            <ProfileSwitcher />
            <button
              onClick={() => router.push('/dashboard/add-menu')}
              className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-4 py-2 text-ds-small text-white transition-colors"
            >
              <Plus className="h-4 w-4" /> {t.add_menu}
            </button>
          </div>
        </div>

        {/* Date Filter */}
        <div className="mb-ds-md rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-ds-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-mint-600 dark:text-slate-400" />
              <span className="text-ds-small font-medium text-slate-700 dark:text-slate-300">{t.filter_by_date}</span>
            </div>
            <div className="flex items-center gap-ds-sm">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="flex-1 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              />
              {selectedDate && (
                <button
                  onClick={() => {
                    setSelectedDate('');
                    setCurrentPage(1);
                  }}
                  className="rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 whitespace-nowrap"
                >
                  {t.clear_filter}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Menus Table */}
        <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          {paginatedMenus.length === 0 ? (
            <div className="text-center py-12">
              <Utensils className="h-12 w-12 mx-auto text-mint-400 dark:text-slate-500 mb-4" />
              <p className="text-slate-600 dark:text-slate-400">{t.no_menus}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-ds-md">
                <table className="w-full text-ds-small border-collapse rounded-ds-md">
                  <thead className="bg-mint-500 text-white dark:bg-slate-800">
                    <tr>
                      <th className="py-2 px-4 text-left rounded-tl-ds-md">{t.created_date || 'Created'}</th>
                      <th className="py-2 px-4 text-left">{t.breakfast}</th>
                      <th className="py-2 px-4 text-left">{t.lunch}</th>
                      <th className="py-2 px-4 text-left">{t.snack}</th>
                      <th className="py-2 px-4 text-left">{t.notes}</th>
                      <th className="py-2 px-4 text-center rounded-tr-ds-md">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">

                    {paginatedMenus.map((menu) => (
                      <tr key={menu.id} className="hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors">
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
                              className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2 py-1 text-ds-tiny hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                              <Edit className="h-3 w-3" /> {t.edit}
                            </button>
                            <button
                              onClick={() => openDeleteMenuModal(menu.id)}
                              className="inline-flex items-center gap-1 rounded-ds-sm border border-red-300 px-2 py-1 text-ds-tiny text-red-600 hover:bg-red-50 transition-colors dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
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
                <div className="mt-4 w-full flex justify-end gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  >
                    {t.prev}
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`inline-flex items-center rounded-ds-md px-3 py-1.5 text-ds-small transition-colors ${currentPage === page ? 'bg-mint-500 text-white border border-mint-500' : 'border border-slate-400 hover:bg-mint-50 dark:border-slate-600 dark:text-slate-200'}`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
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
      </>
    );
  }

  // Wrap with appropriate layout based on user role
  if (isTeacher) {
    return <TeacherLayout hideHeader={true}>{teacherContent}</TeacherLayout>;
  }

  if (isPrincipal) {
    return (
      <PrincipalPageLayout>
        <PrincipalMenusContent />
      </PrincipalPageLayout>
    );
  }

  // Fallback for other roles (return teacher content without layout)
  return teacherContent;
}

// Translations removed - using centralized translations from @/lib/translations

