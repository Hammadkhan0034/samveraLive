'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Calendar, Utensils, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';

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

export default function TeacherMenusPage() {
  const { lang, t } = useLanguage();
  const pathname = usePathname();

  // Initialize from cache immediately if available to avoid loading state
  const [menus, setMenus] = useState<Menu[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cacheKey = 'teacher_menus_list';
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

  const loadMenus = useCallback(async () => {
    // Check cache first for instant display
    const cacheKey = 'teacher_menus_list';
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
        // For teachers: API automatically filters by created_by (handled in menus_handler.ts)
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
        const allMenus: Menu[] = json.menus || [];
      
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
  }, []);

  // Listen for menu updates and refresh instantly
  useEffect(() => {
    const handleMenuUpdate = () => {
      // Check if menu was updated
      if (typeof window !== 'undefined') {
        const menuUpdated = localStorage.getItem('menu_data_updated');
        if (menuUpdated === 'true') {
          localStorage.removeItem('menu_data_updated');
          loadMenus();
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
  }, [loadMenus]);

  // Also listen for pathname changes (when navigating back from edit page)
  useEffect(() => {
    if (pathname === '/dashboard/teacher/menus') {
      // Check if menu was updated when we navigate to this page
      if (typeof window !== 'undefined') {
        const menuUpdated = localStorage.getItem('menu_data_updated');
        if (menuUpdated === 'true') {
          localStorage.removeItem('menu_data_updated');
          loadMenus();
        }
      }
    }
  }, [pathname, loadMenus]);

  // Load menus when user is available
  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  // Reload menus when returning from add-menu page or when page becomes visible
  useEffect(() => {
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
  }, [loadMenus]);

  // Filter menus by selected date
  const filteredMenus = menus.filter(m => !selectedDate || m.day === selectedDate);
  const totalPages = Math.ceil(filteredMenus.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMenus = filteredMenus.slice(startIndex, startIndex + itemsPerPage);

  function TeacherMenusContent() {
    const { sidebarRef } = useTeacherPageLayout();

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
              <p className="mt-1 text-ds-small text-slate-600 dark:text-slate-400">View daily menus</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Menus Table with Filter */}
        <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          {/* Date Filter Section */}
          <div className="mb-ds-md pb-ds-md border-b border-slate-200 dark:border-slate-700">
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
          {/* Table Section */}
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
                      <th className="py-2 px-4 text-left rounded-tr-ds-md">{t.notes}</th>
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
      </>
    );
  }

  return (
    <TeacherPageLayout>
      <TeacherMenusContent />
    </TeacherPageLayout>
  );
}

