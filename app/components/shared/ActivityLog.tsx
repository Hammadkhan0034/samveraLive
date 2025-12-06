'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Edit, Trash2, Calendar, User, Plus, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/hooks/useAuth';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { ActivityModal } from '@/app/components/shared/ActivityModal';
import { PageHeader } from '@/app/components/shared/PageHeader';
import EmptyState from '@/app/components/EmptyState';
import type { DailyLogWithRelations } from '@/lib/types/daily-logs';

export interface ActivityLogProps {
  /**
   * Whether the current user can edit activities
   */
  canEdit?: boolean;
  /**
   * Whether the current user can delete activities
   */
  canDelete?: boolean;
  /**
   * Custom className for the container
   */
  className?: string;
  /**
   * Whether to show the mobile menu button in the header
   */
  showMobileMenu?: boolean;
  /**
   * Callback for mobile menu button click
   */
  onMobileMenuClick?: () => void;
}

export function ActivityLog({
  canEdit = true,
  canDelete = true,
  className = '',
  showMobileMenu = false,
  onMobileMenuClick,
}: ActivityLogProps) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [activities, setActivities] = useState<DailyLogWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<DailyLogWithRelations | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<DailyLogWithRelations | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/daily-logs?kind=activity&t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err.error || `Failed with ${res.status}`);
      }

      const { dailyLogs } = await res.json();
      setActivities(dailyLogs || []);
    } catch (err: any) {
      console.error('Failed to load activities:', err);
      setError(err.message || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleAddClick = () => {
    setEditingActivity(null);
    setIsModalOpen(true);
  };

  const handleEdit = (activity: DailyLogWithRelations) => {
    setEditingActivity(activity);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    loadActivities();
  };

  const handleDeleteClick = (activity: DailyLogWithRelations) => {
    setActivityToDelete(activity);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!activityToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/daily-logs?id=${activityToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err.error || `Failed with ${res.status}`);
      }

      setIsDeleteModalOpen(false);
      setActivityToDelete(null);
      loadActivities();
    } catch (err: any) {
      console.error('Failed to delete activity:', err);
      setDeleteError(err.message || 'Failed to delete activity');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleNoteExpansion = (activityId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  };

  const truncateNote = (note: string, maxLength: number = 100) => {
    if (note.length <= maxLength) return note;
    return note.substring(0, maxLength) + '...';
  };

  const addActivityButton = (
    <button
      onClick={handleAddClick}
      className="flex items-center gap-2 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small font-medium text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
      aria-label={t.add_activity || 'Add Activity'}
    >
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">{t.add_activity || 'Add Activity'}</span>
      <span className="sm:hidden">{t.add || 'Add'}</span>
    </button>
  );

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title={t.activity_log || 'Activity Log'}
        subtitle={(t as any).activity_log_subtitle || 'View and manage daily activity logs'}
        headingLevel="h1"
        showMobileMenu={showMobileMenu}
        onMobileMenuClick={onMobileMenuClick}
        rightActions={addActivityButton}
      />

      {/* Error Display */}
      {error && (
        <div className="mb-ds-sm rounded-ds-md border border-red-200 bg-red-50 p-ds-sm dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-ds-md">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-ds-small font-medium text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={`rounded-ds-lg border border-slate-200 bg-white shadow-ds-card dark:border-slate-700 dark:bg-slate-800 ${className}`}>
          <div className="overflow-x-auto p-ds-md">
            <table className="w-full min-w-[640px] border-collapse text-ds-small">
              <thead className="sticky top-0 bg-mint-500 text-white z-10">
                <tr>
                  <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-md whitespace-nowrap">
                    Image
                  </th>
                  <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 whitespace-nowrap">
                    Note
                  </th>
                  <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 whitespace-nowrap">
                    Creator
                  </th>
                  <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 whitespace-nowrap">
                    Date/Time
                  </th>
                  <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-md whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="text-left py-2 px-2 sm:px-ds-md">
                      <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-ds-md animate-pulse"></div>
                    </td>
                    <td className="text-left py-2 px-2 sm:px-ds-md">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse"></div>
                    </td>
                    <td className="text-left py-2 px-2 sm:px-ds-md">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse"></div>
                    </td>
                    <td className="text-left py-2 px-2 sm:px-ds-md">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 animate-pulse"></div>
                    </td>
                    <td className="text-left py-2 px-2 sm:px-ds-md">
                      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16 animate-pulse"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && activities.length === 0 && (
        <div className={`rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800 ${className}`}>
          <EmptyState
            lang={lang}
            icon={Calendar}
            title={t.no_activities || 'No activities recorded yet'}
            description={(t as any).no_activities_description || 'There are no activity logs available at this time. Click "Add Activity" to create your first activity log.'}
          />
        </div>
      )}

      {/* Activities Table */}
      {!loading && activities.length > 0 && (
        <div className={`rounded-ds-lg border border-slate-200 bg-white shadow-ds-card dark:border-slate-700 dark:bg-slate-800 ${className}`}>
          <div className="overflow-x-auto p-ds-md">
            <table className="w-full min-w-[640px] border-collapse text-ds-small">
              <thead className="sticky top-0 bg-mint-500 text-white z-10">
                <tr>
                  <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-md whitespace-nowrap">
                    Image
                  </th>
                  <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 whitespace-nowrap">
                    Note
                  </th>
                  <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 whitespace-nowrap">
                    Creator
                  </th>
                  <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 whitespace-nowrap">
                    Date/Time
                  </th>
                  <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-md whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
            <tbody>
              {activities.map((activity) => {
                const isNoteExpanded = expandedNotes.has(activity.id);
                const noteTruncated = activity.note ? truncateNote(activity.note) : null;
                const shouldTruncate = activity.note && activity.note.length > 100;

                return (
                  <tr
                    key={activity.id}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="text-left py-2 px-2 sm:px-ds-md">
                      {activity.image ? (
                        <img
                          src={activity.image}
                          alt="Activity"
                          className="h-12 w-12 object-cover rounded-ds-md border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => window.open(activity.image || '', '_blank')}
                          title="Click to view full image"
                        />
                      ) : (
                        <span className="text-ds-text-muted dark:text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-left py-2 px-2 sm:px-ds-md text-ds-small text-ds-text-primary dark:text-slate-100 max-w-md">
                      {activity.note ? (
                        <div>
                          <p className="whitespace-pre-wrap">
                            {isNoteExpanded ? activity.note : noteTruncated}
                          </p>
                          {shouldTruncate && (
                            <button
                              onClick={() => toggleNoteExpansion(activity.id)}
                              className="mt-1 text-mint-600 dark:text-mint-400 hover:underline text-ds-tiny flex items-center gap-1"
                            >
                              {isNoteExpanded ? (
                                <>
                                  <ChevronUp className="h-3 w-3" />
                                  Show less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  Show more
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-ds-text-muted dark:text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-left py-2 px-2 sm:px-ds-md text-ds-small text-ds-text-primary dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                        <span>{activity.creator_name}</span>
                      </div>
                    </td>
                    <td className="text-left py-2 px-2 sm:px-ds-md text-ds-small text-ds-text-primary dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                        <span>{formatDate(activity.recorded_at)}</span>
                      </div>
                    </td>
                    <td className="text-left py-2 px-2 sm:px-ds-md">
                      {(canEdit || canDelete) && (
                        <div className="flex items-center gap-ds-xs flex-wrap">
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(activity)}
                              className="inline-flex items-center gap-1 rounded-ds-sm border border-input-stroke bg-input-fill px-2 py-1 text-ds-small text-ds-text-primary hover:bg-mint-50 hover:border-mint-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
                              title={t.edit || 'Edit'}
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{t.edit || 'Edit'}</span>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteClick(activity)}
                              className="inline-flex items-center gap-1 rounded-ds-sm border border-red-300 px-2 py-1 text-ds-small text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                              title={t.delete || 'Delete'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{t.delete || 'Delete'}</span>
                            </button>
                          )}
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

      {/* Activity Modal */}
      <ActivityModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingActivity(null);
        }}
        onSuccess={handleModalSuccess}
        initialData={editingActivity}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setActivityToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={t.delete_activity || 'Delete Activity'}
        message={t.delete_activity_confirmation || 'Are you sure you want to delete this activity? This action cannot be undone.'}
        loading={deleting}
        error={deleteError}
        confirmButtonText={t.delete || 'Delete'}
        cancelButtonText={t.cancel || 'Cancel'}
      />
    </>
  );
}

