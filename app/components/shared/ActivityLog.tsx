'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Edit, Trash2, Calendar, User, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/hooks/useAuth';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import type { DailyLogWithRelations } from '@/lib/types/daily-logs';

export interface ActivityLogProps {
  /**
   * Array of activity log entries to display
   */
  activities: DailyLogWithRelations[];
  /**
   * Callback when an activity is edited
   */
  onEdit?: (activity: DailyLogWithRelations) => void;
  /**
   * Callback when an activity is deleted
   */
  onDelete?: (activityId: string) => void;
  /**
   * Whether the current user can edit activities
   */
  canEdit?: boolean;
  /**
   * Whether the current user can delete activities
   */
  canDelete?: boolean;
  /**
   * Whether to show loading state
   */
  loading?: boolean;
  /**
   * Custom className for the container
   */
  className?: string;
  /**
   * Callback to refresh the activities list
   */
  onRefresh?: () => void;
}

export function ActivityLog({
  activities,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
  loading = false,
  className = '',
  onRefresh,
}: ActivityLogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<DailyLogWithRelations | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteClick = (activity: DailyLogWithRelations) => {
    setActivityToDelete(activity);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!activityToDelete || !onDelete) return;

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

      onDelete(activityToDelete.id);
      setIsDeleteModalOpen(false);
      setActivityToDelete(null);
      
      if (onRefresh) {
        onRefresh();
      }
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

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-ds-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
          >
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
            <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Calendar className="mx-auto h-12 w-12 text-slate-400 mb-4" />
        <p className="text-ds-small text-slate-600 dark:text-slate-400">
          {t.no_activities || 'No activities recorded yet'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`space-y-4 ${className}`}>
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="rounded-ds-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-ds-tiny sm:text-ds-small text-slate-600 dark:text-slate-400">
                    {formatDate(activity.recorded_at)}
                  </span>
                  {activity.classes && (
                    <>
                      <span className="text-slate-400">•</span>
                      <span className="text-ds-tiny sm:text-ds-small text-slate-600 dark:text-slate-400">
                        {activity.classes.name}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-ds-tiny sm:text-ds-small text-slate-600 dark:text-slate-400">
                    {activity.creator_name}
                  </span>
                </div>
              </div>
              {(canEdit || canDelete) && (
                <div className="flex items-center gap-2">
                  {canEdit && onEdit && (
                    <button
                      onClick={() => onEdit(activity)}
                      className="p-2 rounded-ds-md hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                      title={t.edit || 'Edit'}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteClick(activity)}
                      className="p-2 rounded-ds-md hover:bg-red-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 transition-colors"
                      title={t.delete || 'Delete'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {activity.note && (
              <p className="text-ds-small sm:text-ds-body text-slate-700 dark:text-slate-300 mb-3 whitespace-pre-wrap">
                {activity.note}
              </p>
            )}

            {activity.image && (
              <div className="mt-3">
                <img
                  src={activity.image}
                  alt="Activity"
                  className="w-full h-48 sm:h-64 object-cover rounded-ds-md border border-slate-200 dark:border-slate-700"
                />
              </div>
            )}
          </div>
        ))}
      </div>

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

