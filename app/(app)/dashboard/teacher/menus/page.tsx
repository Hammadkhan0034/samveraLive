'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Timer, Users, MessageSquare, Camera, Link as LinkIcon, Utensils, Plus, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar, { TeacherSidebarRef } from '@/app/components/shared/TeacherSidebar';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import Loading from '@/app/components/shared/Loading';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Translations removed - using centralized translations from @/lib/translations

export default function TeacherMenusPage() {
  const { lang, t } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, isSigningIn } = useRequireAuth('teacher');
  const sidebarRef = useRef<TeacherSidebarRef>(null);

  // Try to get org_id from multiple possible locations
  const userMetadata = session?.user?.user_metadata;
  const orgIdFromMetadata = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  
  // If no org_id in metadata, we need to get it from the database
  const [dbOrgId, setDbOrgId] = useState<string | null>(null);
  
  // Fetch org_id from database if not in metadata
  useEffect(() => {
    if (session?.user?.id && !orgIdFromMetadata) {
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
  }, [session?.user?.id, orgIdFromMetadata]);
  
  // Final org_id to use
  const finalOrgId = orgIdFromMetadata || dbOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

  // Menu state
  const [menus, setMenus] = useState<Array<{ id: string; org_id: string; class_id?: string | null; day: string; breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null; created_at?: string; classes?: { id: string; name: string } }>>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState<string | null>(null);
  const [deletingMenu, setDeletingMenu] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<Array<{ id: string; name: string }>>([]);

  // Load menus on mount
  useEffect(() => {
    if (finalOrgId && session?.user?.id) {
      loadMenus();
    }
  }, [finalOrgId, session?.user?.id]);

  // Listen for menu updates (when menu is created/edited from add-menu page)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleMenuUpdate = () => {
      // Clear cache and reload
      if (session?.user?.id) {
        localStorage.removeItem(`teacher_menus_cache_${session.user.id}`);
      }
      if (finalOrgId && session?.user?.id) {
        loadMenus();
      }
    };
    
    window.addEventListener('menu-updated', handleMenuUpdate);
    
    // Also check localStorage flag on mount
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
  }, [finalOrgId, session?.user?.id]);

  async function loadMenus() {
    if (!finalOrgId || !session?.user?.id) return;
    
    // Load cached data first
    if (typeof window !== 'undefined') {
      try {
        const cachedMenus = localStorage.getItem(`teacher_menus_cache_${session.user.id}`);
        const cachedClasses = localStorage.getItem('teacher_classes_cache');
        if (cachedMenus) {
          const parsed = JSON.parse(cachedMenus);
          if (Array.isArray(parsed)) setMenus(parsed);
        }
        if (cachedClasses) {
          const parsed = JSON.parse(cachedClasses);
          if (Array.isArray(parsed)) setTeacherClasses(parsed);
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    
    try {
      setLoadingMenus(true);
      setError(null);
      
      // Load teacher classes (use cache if available)
      let classes: any[] = [];
      if (teacherClasses.length === 0) {
        try {
          const teacherClassesRes = await fetch(`/api/teacher-classes?userId=${session.user.id}&t=${Date.now()}`, { cache: 'no-store' });
          const teacherClassesData = await teacherClassesRes.json();
          classes = teacherClassesData.classes || [];
          setTeacherClasses(classes);
          
          // Cache classes
          if (typeof window !== 'undefined') {
            localStorage.setItem('teacher_classes_cache', JSON.stringify(classes));
          }
        } catch (e: any) {
          console.warn('⚠️ Error loading teacher classes:', e.message);
          // Continue with cached classes if available
          classes = teacherClasses;
        }
      } else {
        classes = teacherClasses;
      }
      
      // Optimize: Use single API call to get all menus for the user
      // Instead of multiple calls per class, fetch all at once
      let allMenus: any[] = [];
      try {
        const res = await fetch(`/api/menus?orgId=${finalOrgId}&createdBy=${session.user.id}`, { cache: 'no-store' });
        const json = await res.json();
        
        if (res.ok && json.menus) {
          allMenus = (json.menus || []).map((m: any) => ({
            ...m,
            classes: m.class_id ? (classes.find((c: any) => c.id === m.class_id) || null) : null
          }));
        } else if (res.status === 429) {
          // Rate limit error
          setError('Too many requests. Please wait a moment and try again.');
          // Use cached data if available
          return;
        } else {
          throw new Error(json.error || `Failed with ${res.status}`);
        }
      } catch (fetchError: any) {
        if (fetchError.message?.includes('rate limit') || fetchError.message?.includes('429')) {
          setError('Request rate limit reached. Please wait a moment and refresh.');
          console.warn('⚠️ Rate limit reached, using cached data');
          return;
        }
        throw fetchError;
      }
      
      setMenus(allMenus);
      
      // Cache menus
      if (typeof window !== 'undefined') {
        localStorage.setItem(`teacher_menus_cache_${session.user.id}`, JSON.stringify(allMenus));
      }
    } catch (e: any) {
      console.error('❌ Error loading menus:', e);
      setError(e.message || 'Failed to load menus');
    } finally {
      setLoadingMenus(false);
    }
  }

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
      
      // Remove from local state
      setMenus(prev => prev.filter(m => m.id !== menuToDelete));
      
      // Update cache
      if (typeof window !== 'undefined' && session?.user?.id) {
        const updatedMenus = menus.filter(m => m.id !== menuToDelete);
        localStorage.setItem(`teacher_menus_cache_${session.user.id}`, JSON.stringify(updatedMenus));
      }
      
      closeDeleteModal();
    } catch (e: any) {
      setDeleteError(e.message);
    } finally {
      setDeletingMenu(false);
    }
  }

  // Define tiles array (excluding menus as it's handled separately)
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [], [t, lang]);

  // Show loading state while checking authentication
  if (authLoading || (isSigningIn && !user)) {
    return <Loading fullScreen text="Loading menus page..." />;
  }

  // Safety check: if user is still not available after loading, don't render
  if (!authLoading && !isSigningIn && !user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden md:pt-14">
      <div className="flex flex-1 overflow-hidden h-full">
        <TeacherSidebar
          ref={sidebarRef}
          pathname={pathname}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
            {/* Menus Panel */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.tile_menus || 'Menus'}</h2>
                  <button
                    onClick={() => router.push('/dashboard/add-menu')}
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
                              {menu.day ? (
                                <span suppressHydrationWarning>
                                  {typeof window !== 'undefined' ? new Date(menu.day).toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', {
                                    weekday: 'short',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  }) : ''}
                                </span>
                              ) : (
                                menu.created_at ? (
                                  <span suppressHydrationWarning>
                                    {typeof window !== 'undefined' ? new Date(menu.created_at).toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US') : ''}
                                  </span>
                                ) : (
                                  '—'
                                )
                              )}
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
                                  onClick={() => router.push(`/dashboard/add-menu?id=${menu.id}`)}
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

                {/* Delete Confirmation Modal */}
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
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

