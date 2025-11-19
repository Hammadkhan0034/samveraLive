'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { ArrowLeft, Save, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';

type Lang = 'is' | 'en';

interface MenuForm {
  org_id: string;
  class_id?: string | null;
  day: string;
  breakfast?: string | null;
  lunch?: string | null;
  snack?: string | null;
  notes?: string | null;
  is_public?: boolean;
}

function AddMenuPageContent() {
  const { t } = useLanguage();
  const { user, loading, isSigningIn } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get org_id and class_id from user metadata
  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const classId = userMetadata?.class_id;

  const [menuForm, setMenuForm] = useState<MenuForm>({
    org_id: orgId || '',
    class_id: null, // Always null by default - org-wide menu
    day: new Date().toISOString().split('T')[0],
    breakfast: '',
    lunch: '',
    snack: '',
    notes: '',
    is_public: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMenu, setEditingMenu] = useState<any>(null);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Language handled by context


  // Load classes for the organization
  useEffect(() => {
    if (!orgId) return;
    
    const loadClasses = async () => {
      setLoadingClasses(true);
      try {
        const res = await fetch(`/api/classes?orgId=${orgId}`, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.classes) {
          setClasses(json.classes.map((c: any) => ({ id: c.id, name: c.name })));
        }
      } catch (e) {
        console.error('Error loading classes:', e);
      } finally {
        setLoadingClasses(false);
      }
    };

    loadClasses();
  }, [orgId]);

  // Load menu for editing if id is present
  useEffect(() => {
    const id = searchParams?.get('id');
    if (!id || !orgId) {
      setEditingMenu(null);
      return;
    }

    const loadMenu = async () => {
      try {
        const res = await fetch(`/api/menus?orgId=${orgId}&day=${menuForm.day}${classId ? `&classId=${classId}` : ''}`, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.menus) {
          const menu = json.menus.find((m: any) => m.id === id);
          if (menu) {
            setEditingMenu(menu);
            setMenuForm({
              org_id: menu.org_id,
              class_id: menu.class_id || null,
              day: menu.day,
              breakfast: menu.breakfast || '',
              lunch: menu.lunch || '',
              snack: menu.snack || '',
              notes: menu.notes || '',
              is_public: menu.is_public !== undefined ? menu.is_public : true,
            });
          }
        }
      } catch (e) {
        console.error('Error loading menu:', e);
      }
    };

    loadMenu();
  }, [searchParams, orgId, classId, menuForm.day]);

  async function submitMenu(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !menuForm.day) {
      setError(t.missing_fields || 'Missing required fields');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const url = '/api/menus';
      const method = editingMenu ? 'PUT' : 'POST';
      // Ensure class_id is null if not provided
      const finalClassId = menuForm.class_id && menuForm.class_id.trim() !== '' ? menuForm.class_id : null;
      const body = editingMenu 
        ? { id: editingMenu.id, ...menuForm, class_id: finalClassId }
        : { ...menuForm, class_id: finalClassId, created_by: user?.id || null };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      // Set flag to trigger refresh on menus-list and menus-view pages
      if (typeof window !== 'undefined') {
        localStorage.setItem('menu_data_updated', 'true');
        // Dispatch custom event for instant update
        window.dispatchEvent(new Event('menu-updated'));
      }

      // Redirect back to teacher dashboard with menus tab active
      router.push('/dashboard/teacher?tab=menus');
    } catch (e: any) {
      console.error('❌ Error submitting menu:', e.message);
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }


  // Only show loading if we're actually loading and don't have a user yet
  if (loading && !user && isSigningIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading add menu page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">

        <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 ml-20">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-3 mt-14 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard/teacher?tab=menus')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <ArrowLeft className="h-4 w-4" /> {t.back}
              </button>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {editingMenu ? t.edit_menu : t.add_menu || 'Add Menu'}
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Menu Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <form onSubmit={submitMenu} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.date} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={menuForm.day}
                  onChange={(e) => setMenuForm({ ...menuForm, day: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.class_label || 'Class'} ({t.optional || 'Optional'})
                </label>
                <select
                  value={menuForm.class_id || ''}
                  onChange={(e) => setMenuForm({ ...menuForm, class_id: e.target.value || null })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  disabled={loadingClasses}
                >
                  <option value="">{t.all_classes || 'All Classes (Org-wide)'}</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
                {loadingClasses && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.loading_classes || 'Loading classes...'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.breakfast}
                </label>
                <input
                  type="text"
                  value={menuForm.breakfast || ''}
                  onChange={(e) => setMenuForm({ ...menuForm, breakfast: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  placeholder={t.breakfast_placeholder}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.lunch}
                </label>
                <input
                  type="text"
                  value={menuForm.lunch || ''}
                  onChange={(e) => setMenuForm({ ...menuForm, lunch: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  placeholder={t.lunch_placeholder}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.snack}
                </label>
                <input
                  type="text"
                  value={menuForm.snack || ''}
                  onChange={(e) => setMenuForm({ ...menuForm, snack: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  placeholder={t.snack_placeholder}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.notes}
                </label>
                <textarea
                  value={menuForm.notes || ''}
                  onChange={(e) => setMenuForm({ ...menuForm, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  placeholder={t.notes_placeholder}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={menuForm.is_public !== false}
                  onChange={(e) => setMenuForm({ ...menuForm, is_public: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_public" className="text-sm text-slate-700 dark:text-slate-300">
                  {t.is_public}
                </label>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {t.saving}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {t.save}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/teacher?tab=menus')}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
      </main>
    </div>
  );
}

// Translations removed - using centralized translations from @/lib/translations

export default function AddMenuPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <AddMenuPageContent />
    </Suspense>
  );
}
