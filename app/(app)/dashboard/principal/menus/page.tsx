'use client';

import  { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Plus, Calendar, Utensils, Edit, Trash2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { MenuFormModal } from '@/app/components/shared/MenuFormModal';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import EmptyState from '@/app/components/EmptyState';

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
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);

  // Ref to prevent concurrent calls to loadMenus
  const isLoadingRef = useRef(false);

  // Language handled by context



  const loadMenus = useCallback(async () => {
    // Prevent concurrent calls
    if (isLoadingRef.current) {
      return;
    }

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
      isLoadingRef.current = true;
      setLoadingMenus(true);
      setError(null);
      try {
        // For principals: show all menus (server handles org_id from auth)
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
        isLoadingRef.current = false;
      }
    }
  }, []);

  // Consolidated effect: Load menus on mount, handle updates, and manage event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Helper to check and handle menu updates
    const checkAndLoadMenus = () => {
      const menuUpdated = localStorage.getItem('menu_data_updated');
      if (menuUpdated === 'true') {
        localStorage.removeItem('menu_data_updated');
        loadMenus();
        return true;
      }
      return false;
    };

    // Event handlers - only reload if there's an update flag
    const handleFocus = () => {
      checkAndLoadMenus();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAndLoadMenus();
      }
    };

    const handleMenuUpdated = () => {
      checkAndLoadMenus();
    };

    // Initial load: check for updates first, then load if needed
    const hasUpdate = checkAndLoadMenus();
    if (!hasUpdate) {
      loadMenus();
    }

    // Set up event listeners (only once, no duplicates)
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('menu-updated', handleMenuUpdated);

    // Cleanup
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('menu-updated', handleMenuUpdated);
    };
  }, [loadMenus]);

  // Handle pathname changes (when navigating back to this page)
  useEffect(() => {
    if (pathname === '/dashboard/principal/menus' && typeof window !== 'undefined') {
      const menuUpdated = localStorage.getItem('menu_data_updated');
      if (menuUpdated === 'true') {
        localStorage.removeItem('menu_data_updated');
        loadMenus();
      }
    }
  }, [pathname, loadMenus]);

  function openDeleteMenuModal(id: string) {
    setMenuToDelete(id);
    setIsDeleteMenuModalOpen(true);
    setDeleteMenuError(null);
  }

  function openAddMenuModal() {
    setEditingMenu(null);
    setIsMenuModalOpen(true);
  }

  function openEditMenuModal(menu: Menu) {
    setEditingMenu(menu);
    setIsMenuModalOpen(true);
  }

  function closeMenuModal() {
    setIsMenuModalOpen(false);
    setEditingMenu(null);
  }

  function handleMenuSuccess() {
    closeMenuModal();
    loadMenus();
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





  function PrincipalMenusContent() {
    return (
      <>
        <PageHeader
          title={t.tile_menus || 'Menus'}
          subtitle="Manage daily menus"
          headingLevel="h1"
          backHref="/dashboard/principal"
          showBackButton={true}
          rightActions={
            <div className="flex items-center gap-2 sm:gap-ds-sm flex-wrap">
              <div className="hidden sm:block">
                <ProfileSwitcher />
              </div>
              <button
                onClick={openAddMenuModal}
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-3 sm:px-4 py-1.5 sm:py-2 text-ds-small text-white transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{t.add_menu}</span>
                <span className="sm:hidden">{t.add || 'Add'}</span>
              </button>
            </div>
          }
        />

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-3 sm:px-4 py-2 sm:py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Menus Table with Filter */}
        <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          {/* Date Filter Section */}
          <div className="mb-ds-md pb-ds-md border-b border-slate-200 dark:border-slate-700">
            <div className="flex flex-col gap-2 sm:gap-ds-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-mint-600 dark:text-slate-400 flex-shrink-0" />
                <span className="text-ds-small font-medium text-slate-700 dark:text-slate-300">{t.filter_by_date}</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-ds-sm">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="flex-1 rounded-ds-md border border-slate-300 px-3 sm:px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                />
                {selectedDate && (
                  <button
                    onClick={() => {
                      setSelectedDate('');
                      setCurrentPage(1);
                    }}
                    className="rounded-ds-md border border-slate-300 px-3 sm:px-4 py-2 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 whitespace-nowrap"
                  >
                    {t.clear_filter}
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Table Section */}
          {paginatedMenus.length === 0 ? (
            <EmptyState
              icon={Utensils}
              title={t.no_menus_title || 'No Menus Found'}
              description={t.no_menus_description || 'No menus available. Create a menu to get started.'}
            />
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {paginatedMenus.map((menu) => (
                  <div key={menu.id} className="rounded-ds-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-ds-tiny text-slate-500 dark:text-slate-400 mb-1">
                          {menu.created_at ? new Date(menu.created_at).toLocaleString(lang === 'is' ? 'is-IS' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        <button
                          onClick={() => openEditMenuModal(menu)}
                          className="p-1.5 rounded-ds-sm border border-slate-300 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600"
                          title={t.edit}
                        >
                          <Edit className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                        </button>
                        <button
                          onClick={() => openDeleteMenuModal(menu.id)}
                          className="p-1.5 rounded-ds-sm border border-red-300 text-red-600 hover:bg-red-50 transition-colors dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                          title={t.delete}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-ds-tiny font-medium text-slate-600 dark:text-slate-400">{t.breakfast}: </span>
                        <span className="text-ds-small text-black dark:text-slate-300">{menu.breakfast || '—'}</span>
                      </div>
                      <div>
                        <span className="text-ds-tiny font-medium text-slate-600 dark:text-slate-400">{t.lunch}: </span>
                        <span className="text-ds-small text-black dark:text-slate-300">{menu.lunch || '—'}</span>
                      </div>
                      <div>
                        <span className="text-ds-tiny font-medium text-slate-600 dark:text-slate-400">{t.snack}: </span>
                        <span className="text-ds-small text-black dark:text-slate-300">{menu.snack || '—'}</span>
                      </div>
                      {menu.notes && (
                        <div>
                          <span className="text-ds-tiny font-medium text-slate-600 dark:text-slate-400">{t.notes}: </span>
                          <span className="text-ds-small text-black dark:text-slate-300">{menu.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto -mx-3 sm:mx-0 rounded-ds-md">
                <table className="w-full min-w-[640px] text-ds-small border-collapse rounded-ds-md">
                  <thead className="bg-mint-500 text-white dark:bg-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 sm:px-4 text-left rounded-tl-ds-md whitespace-nowrap text-ds-small font-medium">{t.created_date || 'Created'}</th>
                      <th className="py-2.5 px-3 sm:px-4 text-left whitespace-nowrap text-ds-small font-medium">{t.breakfast}</th>
                      <th className="py-2.5 px-3 sm:px-4 text-left whitespace-nowrap text-ds-small font-medium hidden lg:table-cell">{t.lunch}</th>
                      <th className="py-2.5 px-3 sm:px-4 text-left whitespace-nowrap text-ds-small font-medium hidden xl:table-cell">{t.snack}</th>
                      <th className="py-2.5 px-3 sm:px-4 text-left whitespace-nowrap text-ds-small font-medium hidden xl:table-cell">{t.notes}</th>
                      <th className="py-2.5 px-3 sm:px-4 text-center rounded-tr-ds-md whitespace-nowrap text-ds-small font-medium">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {paginatedMenus.map((menu) => (
                      <tr key={menu.id} className="hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-3 px-3 sm:px-4 text-black dark:text-slate-300">
                          <div className="min-w-[140px]">
                            {menu.created_at ? new Date(menu.created_at).toLocaleString(lang === 'is' ? 'is-IS' : 'en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '—'}
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-black dark:text-slate-300 max-w-[180px]">
                          <div className="truncate" title={menu.breakfast || undefined}>
                            {menu.breakfast || '—'}
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-black dark:text-slate-300 max-w-[180px] hidden lg:table-cell">
                          <div className="truncate" title={menu.lunch || undefined}>
                            {menu.lunch || '—'}
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-black dark:text-slate-300 max-w-[180px] hidden xl:table-cell">
                          <div className="truncate" title={menu.snack || undefined}>
                            {menu.snack || '—'}
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-black dark:text-slate-300 max-w-[220px] hidden xl:table-cell">
                          <div className="truncate" title={menu.notes || undefined}>
                            {menu.notes || '—'}
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:px-4">
                          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                            <button
                              onClick={() => openEditMenuModal(menu)}
                              className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2 py-1.5 text-ds-tiny hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                              title={t.edit}
                            >
                              <Edit className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="hidden sm:inline">{t.edit}</span>
                            </button>
                            <button
                              onClick={() => openDeleteMenuModal(menu.id)}
                              className="inline-flex items-center gap-1 rounded-ds-sm border border-red-300 px-2 py-1.5 text-ds-tiny text-red-600 hover:bg-red-50 transition-colors dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                              title={t.delete}
                            >
                              <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="hidden sm:inline">{t.delete}</span>
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
                <div className="mt-4 sm:mt-6 w-full flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-2">
                  <div className="text-ds-small text-slate-600 dark:text-slate-400 order-2 sm:order-1">
                    {t.page || 'Page'} {currentPage} {t.of || 'of'} {totalPages}
                  </div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5 sm:gap-2 order-1 sm:order-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex items-center justify-center rounded-ds-md border border-slate-400 px-3 sm:px-4 py-2 text-ds-small font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 min-w-[80px]"
                    >
                      {t.prev || 'Prev'}
                    </button>
                    <div className="flex gap-1 sm:gap-1.5 flex-wrap justify-center max-w-full">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first page, last page, current page, and pages around current
                        const showPage = 
                          page === 1 || 
                          page === totalPages || 
                          (page >= currentPage - 1 && page <= currentPage + 1);
                        
                        if (!showPage && page === currentPage - 2 && currentPage > 3) {
                          return <span key={`ellipsis-start-${page}`} className="px-2 text-slate-400">...</span>;
                        }
                        if (!showPage && page === currentPage + 2 && currentPage < totalPages - 2) {
                          return <span key={`ellipsis-end-${page}`} className="px-2 text-slate-400">...</span>;
                        }
                        if (!showPage) return null;
                        
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`inline-flex items-center justify-center rounded-ds-md px-3 py-2 text-ds-small font-medium transition-colors min-w-[40px] ${
                              currentPage === page 
                                ? 'bg-mint-500 text-white border border-mint-500 dark:bg-slate-700 dark:border-slate-600' 
                                : 'border border-slate-400 hover:bg-mint-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center justify-center rounded-ds-md border border-slate-400 px-3 sm:px-4 py-2 text-ds-small font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 min-w-[80px]"
                    >
                      {t.next || 'Next'}
                    </button>
                  </div>
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

        {/* Add/Edit Menu Modal */}
        <MenuFormModal
          isOpen={isMenuModalOpen}
          onClose={closeMenuModal}
          onSuccess={handleMenuSuccess}
          initialData={editingMenu}
        />
      </>
    );
  }

    return (
      <PrincipalPageLayout>
        <PrincipalMenusContent />
      </PrincipalPageLayout>
    );
  }


