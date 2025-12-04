'use client';

import  { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Plus, Calendar, Utensils, Edit, Trash2, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { MenuFormModal } from '@/app/components/shared/MenuFormModal';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';

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
              onClick={openAddMenuModal}
              className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-4 py-2 text-ds-small text-white transition-colors"
            >
              <Plus className="h-4 w-4" /> {t.add_menu}
            </button>
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
                              onClick={() => openEditMenuModal(menu)}
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


