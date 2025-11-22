'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Utensils, Plus, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useTeacherOrgId } from '@/lib/hooks/useTeacherOrgId';
import TeacherSidebar from '@/app/components/shared/TeacherSidebar';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { MenuFormModal, type MenuFormData } from '@/app/components/shared/MenuFormModal';
import Loading from '@/app/components/shared/Loading';
import type { MenuWithClass, Menu } from '@/lib/types/menus';
import type { TeacherClass } from '@/lib/types/attendance';

function formatMenuDate(dateString: string | undefined, lang: 'is' | 'en'): string {
  if (!dateString) return '—';
  
  if (typeof window === 'undefined') return '';
  
  const date = new Date(dateString);
  const locale = lang === 'is' ? 'is-IS' : 'en-US';
  
  if (dateString.includes('T')) {
    return date.toLocaleDateString(locale, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  return date.toLocaleDateString(locale);
}

export default function TeacherMenusPage() {
  const { lang, t } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();
  const { user, loading: authLoading, isSigningIn } = useRequireAuth('teacher');
  const { orgId: finalOrgId } = useTeacherOrgId();

  const [menus, setMenus] = useState<MenuWithClass[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState<string | null>(null);
  const [deletingMenu, setDeletingMenu] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [submittingMenu, setSubmittingMenu] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const loadCachedData = useCallback((userId: string) => {
    if (typeof window === 'undefined') return { menus: null, classes: null };
    
    try {
      const cachedMenus = localStorage.getItem(`teacher_menus_cache_${userId}`);
      const cachedClasses = localStorage.getItem('teacher_classes_cache');
      
      return {
        menus: cachedMenus ? JSON.parse(cachedMenus) : null,
        classes: cachedClasses ? JSON.parse(cachedClasses) : null,
      };
    } catch {
      return { menus: null, classes: null };
    }
  }, []);

  const fetchTeacherClasses = useCallback(async (userId: string): Promise<TeacherClass[]> => {
    try {
      const res = await fetch(`/api/teacher-classes?userId=${userId}&t=${Date.now()}`, { 
        cache: 'no-store' 
      });
      const data = await res.json();
      const classes = (data.classes || []) as TeacherClass[];
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('teacher_classes_cache', JSON.stringify(classes));
      }
      
      return classes;
    } catch (error) {
      console.warn('⚠️ Error loading teacher classes:', error);
      return [];
    }
  }, []);

  const fetchMenus = useCallback(async (
    orgId: string, 
    userId: string, 
    classes: TeacherClass[]
  ): Promise<MenuWithClass[]> => {
    try {
      const res = await fetch(`/api/menus?orgId=${orgId}&createdBy=${userId}`, { 
        cache: 'no-store' 
      });
      const json = await res.json();
      
      if (res.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
        throw new Error('Rate limit');
      }
      
      if (!res.ok) {
        throw new Error(json.error || `Failed with ${res.status}`);
      }
      
      const allMenus: MenuWithClass[] = (json.menus || []).map((m: MenuWithClass) => ({
        ...m,
        classes: m.class_id ? (classes.find(c => c.id === m.class_id) || null) : null
      }));
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(`teacher_menus_cache_${userId}`, JSON.stringify(allMenus));
      }
      
      return allMenus;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('rate limit') || error.message.includes('429'))) {
        setError('Request rate limit reached. Please wait a moment and refresh.');
        console.warn('⚠️ Rate limit reached, using cached data');
        throw error;
      }
      throw error;
    }
  }, []);

  const loadMenus = useCallback(async () => {
    if (!finalOrgId || !session?.user?.id) return;
    
    const cached = loadCachedData(session.user.id);
    if (cached.menus && Array.isArray(cached.menus)) {
      setMenus(cached.menus);
    }
    
    try {
      setLoadingMenus(true);
      setError(null);
      
      let classes: TeacherClass[] = [];
      if (cached.classes && Array.isArray(cached.classes)) {
        classes = cached.classes;
        setTeacherClasses(cached.classes);
      } else {
        classes = await fetchTeacherClasses(session.user.id);
        if (classes.length > 0) {
          setTeacherClasses(classes);
        }
      }
      
      const allMenus = await fetchMenus(finalOrgId, session.user.id, classes);
      setMenus(allMenus);
    } catch (error) {
      console.error('❌ Error loading menus:', error);
      if (error instanceof Error) {
        setError(error.message || 'Failed to load menus');
      } else {
        setError('Failed to load menus');
      }
    } finally {
      setLoadingMenus(false);
    }
  }, [finalOrgId, session?.user?.id, loadCachedData, fetchTeacherClasses, fetchMenus]);

  useEffect(() => {
    if (finalOrgId && session?.user?.id) {
      loadMenus();
    }
  }, [finalOrgId, session?.user?.id, loadMenus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleMenuUpdate = () => {
      if (session?.user?.id) {
        localStorage.removeItem(`teacher_menus_cache_${session.user.id}`);
      }
      if (finalOrgId && session?.user?.id) {
        loadMenus();
      }
    };
    
    window.addEventListener('menu-updated', handleMenuUpdate);
    
    if (session?.user?.id) {
      const menuUpdated = localStorage.getItem('menu_data_updated');
      if (menuUpdated === 'true') {
        localStorage.removeItem('menu_data_updated');
        handleMenuUpdate();
      }
    }
    
    return () => {
      window.removeEventListener('menu-updated', handleMenuUpdate);
    };
  }, [finalOrgId, session?.user?.id, loadMenus]);

  function openDeleteModal(menuId: string) {
    setMenuToDelete(menuId);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  }

  function closeDeleteModal() {
    setIsDeleteModalOpen(false);
    setMenuToDelete(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!menuToDelete) return;
    
    setDeletingMenu(true);
    setDeleteError(null);
    
    try {
      const res = await fetch(`/api/menus?id=${menuToDelete}`, {
        method: 'DELETE',
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || `Failed to delete menu: ${res.status}`);
      }
      
      setMenus(prev => {
        const updated = prev.filter(m => m.id !== menuToDelete);
        
        if (typeof window !== 'undefined' && session?.user?.id) {
          localStorage.setItem(`teacher_menus_cache_${session.user.id}`, JSON.stringify(updated));
        }
        
        return updated;
      });
      
      closeDeleteModal();
    } catch (error) {
      if (error instanceof Error) {
        setDeleteError(error.message);
      } else {
        setDeleteError('Failed to delete menu');
      }
    } finally {
      setDeletingMenu(false);
    }
  }

  function openMenuModal(menu?: MenuWithClass) {
    if (menu) {
      // Convert MenuWithClass to Menu for editing
      const menuForEdit: Menu = {
        id: menu.id,
        org_id: menu.org_id,
        class_id: menu.class_id,
        day: menu.day,
        breakfast: menu.breakfast,
        lunch: menu.lunch,
        snack: menu.snack,
        notes: menu.notes,
        is_public: menu.is_public,
        created_at: menu.created_at,
        updated_at: menu.updated_at,
      };
      setEditingMenu(menuForEdit);
    } else {
      setEditingMenu(null);
    }
    setMenuError(null);
    setIsMenuModalOpen(true);
  }

  function closeMenuModal() {
    setIsMenuModalOpen(false);
    setEditingMenu(null);
    setMenuError(null);
  }

  async function handleMenuSubmit(data: MenuFormData & { id?: string; created_by?: string | null }) {
    if (!finalOrgId || !session?.user?.id) {
      setMenuError('Missing organization or user information');
      return;
    }

    setSubmittingMenu(true);
    setMenuError(null);

    try {
      const url = '/api/menus';
      const method = editingMenu ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed with ${res.status}`);
      }

      // Set flag to trigger refresh on menus-list and menus-view pages
      if (typeof window !== 'undefined') {
        localStorage.setItem('menu_data_updated', 'true');
        // Dispatch custom event for instant update
        window.dispatchEvent(new Event('menu-updated'));
      }

      // Refresh menus list
      if (finalOrgId && session.user.id) {
        await loadMenus();
      }

      closeMenuModal();
    } catch (error) {
      console.error('❌ Error submitting menu:', error);
      if (error instanceof Error) {
        setMenuError(error.message);
      } else {
        setMenuError('Failed to submit menu');
      }
      throw error; // Re-throw so modal can handle it
    } finally {
      setSubmittingMenu(false);
    }
  }

  if (authLoading || (isSigningIn && !user)) {
    return <Loading fullScreen text="Loading menus page..." />;
  }

  if (!authLoading && !isSigningIn && !user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden md:pt-14">
      <div className="flex flex-1 overflow-hidden h-full">
        <TeacherSidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.tile_menus || 'Menus'}</h2>
                  <button
                    onClick={() => openMenuModal()}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    <Plus className="h-4 w-4" /> {lang === 'is' ? 'Bæta við matseðli' : 'Add Menu'}
                  </button>
                </div>
                {error && (
                  <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                    {error}
                  </div>
                )}
                {loadingMenus ? (
                  <LoadingSkeleton type="table" rows={5} />
                ) : menus.length === 0 ? (
                  <div className="text-center py-12">
                    <Utensils className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-500 mb-4" />
                    <p className="text-slate-600 dark:text-slate-400">{lang === 'is' ? 'Engir matseðillar fundust. Smelltu á "Bæta við matseðli" til að búa til einn.' : 'No menus found. Click "Add Menu" to create one.'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-black">
                          <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                            {lang === 'is' ? 'Dagur' : 'Date'}
                          </th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                            {lang === 'is' ? 'Hópur' : 'Class'}
                          </th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                            {lang === 'is' ? 'Morgunmatur' : 'Breakfast'}
                          </th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                            {lang === 'is' ? 'Hádegismatur' : 'Lunch'}
                          </th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                            {lang === 'is' ? 'Kvöldmatur' : 'Snack'}
                          </th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                            {lang === 'is' ? 'Athugasemdir' : 'Notes'}
                          </th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                            {t.actions || 'Actions'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {menus.map((menu) => (
                          <tr key={menu.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="py-2 px-4 text-sm text-slate-900 dark:text-slate-100">
                              <span suppressHydrationWarning>
                                {formatMenuDate(menu.day || menu.created_at, lang)}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                              {menu.classes?.name || (menu.class_id ? `Class ${menu.class_id.substring(0, 8)}...` : lang === 'is' ? 'Allir hópar' : 'All Classes')}
                            </td>
                            <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                              {menu.breakfast || '—'}
                            </td>
                            <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                              {menu.lunch || '—'}
                            </td>
                            <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                              {menu.snack || '—'}
                            </td>
                            <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                              {menu.notes ? (
                                <span className="line-clamp-2" title={menu.notes}>{menu.notes}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openMenuModal(menu)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[13px] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                  title={t.edit || 'Edit'}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                  {t.edit || 'Edit'}
                                </button>
                                <button
                                  onClick={() => openDeleteModal(menu.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-[13px] text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                                  title={t.delete || 'Delete'}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  {t.delete || 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <DeleteConfirmationModal
                  isOpen={isDeleteModalOpen}
                  onClose={closeDeleteModal}
                  onConfirm={confirmDelete}
                  title={lang === 'is' ? 'Eyða matseðli' : 'Delete Menu'}
                  message={lang === 'is' ? 'Ertu viss um að þú viljir eyða þessum matseðli? Þessa aðgerð er ekki hægt að afturkalla.' : 'Are you sure you want to delete this menu? This action cannot be undone.'}
                  loading={deletingMenu}
                  error={deleteError}
                  confirmButtonText={t.delete || 'Delete'}
                  cancelButtonText={t.cancel || 'Cancel'}
                />

                {finalOrgId && session?.user?.id && (
                  <MenuFormModal
                    isOpen={isMenuModalOpen}
                    onClose={closeMenuModal}
                    onSubmit={handleMenuSubmit}
                    initialData={editingMenu}
                    orgId={finalOrgId}
                    classes={teacherClasses.map(c => ({ id: c.id, name: c.name }))}
                    userId={session.user.id}
                    loading={submittingMenu}
                    error={menuError}
                  />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

