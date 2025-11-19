'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { ArrowLeft, Plus, Calendar, Utensils, Edit, Trash2, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';

type Lang = 'is' | 'en';

interface Menu {
  id?: string;
  org_id: string;
  class_id?: string | null;
  day: string;
  breakfast?: string | null;
  lunch?: string | null;
  snack?: string | null;
  notes?: string | null;
  is_public?: boolean;
}

export default function MenusPage() {
  const { t, lang } = useLanguage();
  const { user, loading, isSigningIn } = useRequireAuth();
  const router = useRouter();

  // Get org_id and class_id from user metadata
  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const classId = userMetadata?.class_id;

  const [menus, setMenus] = useState<Menu[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [menuForm, setMenuForm] = useState<Menu>({
    org_id: orgId || '',
    class_id: classId || null,
    day: selectedDate,
    breakfast: '',
    lunch: '',
    snack: '',
    notes: '',
    is_public: true,
  });

  // Language handled by context


  // Load menus when orgId or selectedDate changes
  useEffect(() => {
    if (orgId) {
      loadMenus();
    }
  }, [orgId, selectedDate, classId]);

  async function loadMenus() {
    if (!orgId) return;
    
    setLoadingMenus(true);
    setError(null);
    try {
      const url = `/api/menus?orgId=${orgId}&day=${selectedDate}${classId ? `&classId=${classId}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setMenus(json.menus || []);
    } catch (e: any) {
      console.error('❌ Error loading menus:', e.message);
      setError(e.message);
    } finally {
      setLoadingMenus(false);
    }
  }

  function openCreateModal() {
    setEditingMenu(null);
    setMenuForm({
      org_id: orgId || '',
      class_id: classId || null,
      day: selectedDate,
      breakfast: '',
      lunch: '',
      snack: '',
      notes: '',
      is_public: true,
    });
    setIsModalOpen(true);
  }

  function openEditModal(menu: Menu) {
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
    setIsModalOpen(true);
  }

  async function submitMenu() {
    if (!orgId || !menuForm.day) {
      setError(t.missing_fields || 'Missing required fields');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const url = editingMenu ? '/api/menus' : '/api/menus';
      const method = editingMenu ? 'PUT' : 'POST';
      const body = editingMenu 
        ? { id: editingMenu.id, ...menuForm }
        : menuForm;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      setIsModalOpen(false);
      await loadMenus();
    } catch (e: any) {
      console.error('❌ Error submitting menu:', e.message);
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteMenu(id: string) {
    if (!confirm(t.delete_confirm || 'Are you sure you want to delete this menu?')) return;

    setError(null);
    try {
      const res = await fetch(`/api/menus?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      await loadMenus();
    } catch (e: any) {
      console.error('❌ Error deleting menu:', e.message);
      setError(e.message);
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
              Loading menus page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const todayMenu = menus.find(m => m.day === selectedDate);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <ArrowLeft className="h-4 w-4" /> {t.back}
              </button>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Plus className="h-4 w-4" /> {t.add_menu}
              </button>
            </div>
          </div>

          {/* Date Selector */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-4">
              <Calendar className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              <label className="flex-1">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t.select_date}</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                />
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Menu Display */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            {loadingMenus ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
                  <p className="text-slate-600 dark:text-slate-400">{t.loading}</p>
                </div>
              </div>
            ) : todayMenu ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {t.menu_for} {new Date(selectedDate).toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(todayMenu)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                      <Edit className="h-4 w-4" /> {t.edit}
                    </button>
                    <button
                      onClick={() => deleteMenu(todayMenu.id!)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" /> {t.delete}
                    </button>
                  </div>
                </div>

                {todayMenu.breakfast && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <Utensils className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-amber-900 dark:text-amber-100">{t.breakfast}</div>
                      <div className="text-sm text-amber-700 dark:text-amber-300">{todayMenu.breakfast}</div>
                    </div>
                  </div>
                )}

                {todayMenu.lunch && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                    <Utensils className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-900 dark:text-blue-100">{t.lunch}</div>
                      <div className="text-sm text-blue-700 dark:text-blue-300">{todayMenu.lunch}</div>
                    </div>
                  </div>
                )}

                {todayMenu.snack && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                    <Utensils className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-green-900 dark:text-green-100">{t.snack}</div>
                      <div className="text-sm text-green-700 dark:text-green-300">{todayMenu.snack}</div>
                    </div>
                  </div>
                )}

                {todayMenu.notes && (
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t.notes}</div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">{todayMenu.notes}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Utensils className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-500 mb-4" />
                <p className="text-slate-600 dark:text-slate-400">{t.no_menu}</p>
              </div>
            )}
          </div>

          {/* Menu Form Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {editingMenu ? t.edit_menu : t.add_menu}
                  </h2>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t.date}
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

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={submitMenu}
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
                      onClick={() => setIsModalOpen(false)}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}

// Translations removed - using centralized translations from @/lib/translations

