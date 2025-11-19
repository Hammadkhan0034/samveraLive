'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { deleteAnnouncement } from '@/lib/server-actions';

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author_id: string;
  class_id?: string | null;
  class_name?: string | null;
}

// Translations removed - using centralized translations from @/lib/translations

export default function AnnouncementsPage() {
  const { t, lang } = useLanguage();
  const { user } = useRequireAuth(['principal', 'admin', 'teacher']);
  const router = useRouter();

  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const userRole = userMetadata?.role || userMetadata?.activeRole || 'principal';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false); // Start with false to avoid showing loading initially
  const [error, setError] = useState<string | null>(null);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);

  // Delete modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async (showLoading = false) => {
    if (!orgId) return;
    
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.set('userId', user?.id || '');
      params.set('userRole', userRole);
      params.set('limit', '100'); // Load more for management page
      
      const res = await fetch(`/api/announcements?${params.toString()}&t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err.error || `Failed with ${res.status}`);
      }
      
      const { announcements: data } = await res.json();
      const normalized: Announcement[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        created_at: row.created_at,
        author_id: row.author_id,
        class_id: row.class_id ?? undefined,
        class_name: row.class_name || null,
      }));
      
      setAnnouncements(normalized);
      
      // Cache the data for instant loading next time
      try {
        const cacheKey = `announcements_page_${orgId}_${user?.id || 'all'}_${userRole || 'all'}`;
        if (typeof window !== 'undefined' && cacheKey) {
          localStorage.setItem(cacheKey, JSON.stringify(normalized));
        }
      } catch {
        // ignore cache errors
      }
    } catch (err: any) {
      console.error('Failed to load announcements:', err);
      setError(err.message || t.error_loading);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [orgId, user?.id, userRole, t]);

  useEffect(() => {
    // Load from cache first for instant display
    if (orgId && user?.id) {
      const cacheKey = `announcements_page_${orgId}_${user.id}_${userRole || 'all'}`;
      if (typeof window !== 'undefined' && cacheKey) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached) as Announcement[];
            if (Array.isArray(parsed)) {
              setAnnouncements(parsed);
              setHydratedFromCache(true);
            }
          }
        } catch {
          // ignore cache errors
        }
      }
      
      // Load fresh data in background without showing loading
      loadAnnouncements(false);
    }
  }, [orgId, user?.id, userRole, loadAnnouncements]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      loadAnnouncements(false); // Refresh silently in background
    };
    
    window.addEventListener('announcements-refresh', handleRefresh);
    return () => {
      window.removeEventListener('announcements-refresh', handleRefresh);
    };
  }, [loadAnnouncements]);

  const handleOpenCreateModal = () => {
    router.push('/dashboard/add-announcement');
  };

  const handleOpenEditModal = (announcement: Announcement) => {
    router.push(`/dashboard/add-announcement?id=${encodeURIComponent(announcement.id)}`);
  };

  const handleOpenDeleteModal = (announcement: Announcement) => {
    setAnnouncementToDelete(announcement);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setAnnouncementToDelete(null);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!announcementToDelete) return;
    
    setDeleting(true);
    setDeleteError(null);
    
    try {
      await deleteAnnouncement(announcementToDelete.id);
      
      // Remove from local state
      setAnnouncements(prev => prev.filter(a => a.id !== announcementToDelete.id));
      
      // Trigger refresh event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('announcements-refresh'));
      }
      
      handleCloseDeleteModal();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete announcement');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canEditOrDelete = (announcement: Announcement) => {
    if (!user?.id) return false;
    const userRoles = userMetadata?.roles || [];
    const isAdmin = Array.isArray(userRoles) ? userRoles.includes('admin') : false;
    const isAuthor = announcement.author_id === user.id;
    return isAdmin || isAuthor;
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 mt-14 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {t.announcements || 'Announcements'}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.announcements_subtitle || 'View and manage school announcements'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <Plus className="h-4 w-4" />
              {t.add_announcement}
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            <p>{error}</p>
            <button
              onClick={() => loadAnnouncements(true)}
              className="mt-2 text-sm underline hover:no-underline"
            >
              {t.try_again}
            </button>
          </div>
        )}

        {/* Loading State - Only show if we don't have cached data */}
        {loading && !error && !hydratedFromCache && announcements.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-center text-slate-600 dark:text-slate-400">{t.loading}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && announcements.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-center text-slate-600 dark:text-slate-400">{t.empty}</p>
          </div>
        )}

        {/* Announcements Table - Show if we have announcements (from cache or fresh load) */}
        {!error && announcements.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black text-white dark:bg-black sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      {t.col_title}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      {t.col_scope}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      {t.col_created}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-white">
                      {t.col_actions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {announcements.map((announcement) => {
                    const canEdit = canEditOrDelete(announcement);
                    return (
                      <tr
                        key={announcement.id}
                        className="h-12 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-6 py-2">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {announcement.title}
                          </div>
                          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            {truncateText(announcement.body)}
                          </div>
                        </td>
                        <td className="px-6 py-2">
                          {announcement.class_id ? (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                              {announcement.class_name || 'Class'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-300">
                              {t.org_wide}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-2 text-sm text-slate-600 dark:text-slate-400">
                          {formatDate(announcement.created_at)}
                        </td>
                        <td className="px-6 py-2 text-right">
                          {canEdit && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEditModal(announcement)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span className="text-sm">{t.edit}</span>
                              </button>
                              <button
                                onClick={() => handleOpenDeleteModal(announcement)}
                                className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="text-sm">{t.delete}</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={handleCloseDeleteModal}
          onConfirm={handleDelete}
          title={t.delete_announcement}
          message={t.delete_announcement_confirm}
          loading={deleting}
          error={deleteError}
          confirmButtonText={t.delete_confirm}
          cancelButtonText={t.cancel}
        />
      </main>
    </div>
  );
}

