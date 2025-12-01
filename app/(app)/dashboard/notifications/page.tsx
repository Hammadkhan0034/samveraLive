'use client';

import React, { useState, useEffect, useTransition, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { getPaginatedNotifications, deleteNotification, deleteAllNotifications } from '@/lib/server-actions';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import Loading from '@/app/components/shared/Loading';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import type { Notification } from '@/lib/services/notifications';

function NotificationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  
  const currentPage = parseInt(searchParams?.get('page') || '1', 10);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const isInitialLoadRef = useRef(true);
  const previousPageRef = useRef(currentPage);
  const [isPageLoading, setIsPageLoading] = useState(false);

  // Load notifications
  useEffect(() => {
    if (authLoading) return;
    
    // Clear notifications immediately when page changes (except on initial load)
    if (!isInitialLoadRef.current && previousPageRef.current !== currentPage) {
      setNotifications([]);
      setIsPageLoading(true);
    } else if (isInitialLoadRef.current) {
      // Show loading skeleton on initial load
      setIsPageLoading(true);
      isInitialLoadRef.current = false;
    }
    
    previousPageRef.current = currentPage;
    
    const loadNotifications = async () => {
      try {
        setError(null);
        const result = await getPaginatedNotifications(currentPage, 10);
        setNotifications(result.notifications);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load notifications';
        setError(errorMessage);
        console.error('Error loading notifications:', err);
      } finally {
        setLoading(false);
        setIsPageLoading(false);
      }
    };

    loadNotifications();
  }, [currentPage, authLoading]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    startTransition(() => {
      router.push(`/dashboard/notifications?page=${newPage}`);
    });
  };

  // Handle delete click
  const handleDeleteClick = (notification: Notification) => {
    setNotificationToDelete(notification);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!notificationToDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteNotification(notificationToDelete.id);
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationToDelete.id));
      setTotalCount(prev => prev - 1);
      
      // If current page becomes empty and not first page, go to previous page
      if (notifications.length === 1 && currentPage > 1) {
        router.push(`/dashboard/notifications?page=${currentPage - 1}`);
      } else {
        // Reload current page
        const result = await getPaginatedNotifications(currentPage, 10);
        setNotifications(result.notifications);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
      }
      
      setIsDeleteModalOpen(false);
      setNotificationToDelete(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete notification';
      setDeleteError(errorMessage);
      console.error('Error deleting notification:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle delete all
  const handleDeleteAllClick = () => {
    setIsDeleteAllModalOpen(true);
    setDeleteError(null);
  };

  // Handle delete all confirmation
  const handleDeleteAllConfirm = async () => {
    try {
      setIsDeletingAll(true);
      setDeleteError(null);
      await deleteAllNotifications();
      
      // Clear all notifications
      setNotifications([]);
      setTotalCount(0);
      setTotalPages(1);
      
      // Go to first page
      router.push('/dashboard/notifications?page=1');
      
      setIsDeleteAllModalOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete all notifications';
      setDeleteError(errorMessage);
      console.error('Error deleting all notifications:', err);
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Format date (show date only, not time)
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  if (authLoading) {
    return <Loading fullScreen text={t.loading_notifications || 'Loading notifications...'} />;
  }

  return (
    <div className="min-h-screen bg-mint-100 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Back Button */}
        <div className="mb-ds-md mt-14 flex items-center justify-between">
          <div className="flex items-center gap-ds-sm">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-ds-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-ds-small text-slate-700 hover:bg-mint-50 transition-colors dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.back || 'Back'}
            </button>
            <h1 className="text-ds-h1 font-semibold text-slate-900 dark:text-slate-100">
              {t.notifications_title || 'Notifications'}
            </h1>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={handleDeleteAllClick}
              className="inline-flex items-center gap-2 rounded-ds-md border border-red-300 dark:border-red-700 px-3 py-2 text-ds-small text-red-600 hover:bg-red-50 transition-colors dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
              {t.delete_all || 'Delete All'}
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Notifications Table */}
        {isPageLoading ? (
          <LoadingSkeleton type="table" rows={10} className="rounded-ds-md" />
        ) : (
          <div className="rounded-ds-lg border border-slate-200 bg-white shadow-ds-card dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
            {notifications.length === 0 ? (
            <div className="px-6 py-12 text-center text-ds-small text-slate-500 dark:text-slate-400">
              {t.no_notifications_found || 'No notifications found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-mint-500 dark:bg-slate-800">
                    <tr>
                      <th className="px-6 py-2.5 text-left text-ds-tiny font-medium text-white uppercase tracking-wider rounded-tl-ds-md">
                        {t.notification_title || 'Title'}
                      </th>
                      <th className="px-6 py-2.5 text-left text-ds-tiny font-medium text-white uppercase tracking-wider">
                        {t.notification_message || 'Message'}
                      </th>
                      <th className="px-6 py-2.5 text-left text-ds-tiny font-medium text-white uppercase tracking-wider">
                        {t.notification_date || 'Date'}
                      </th>
                      <th className="px-6 py-2.5 text-right text-ds-tiny font-medium text-white uppercase tracking-wider rounded-tr-ds-md">
                        {t.notification_actions || 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {notifications.map((notification) => (
                      <tr
                        key={notification.id}
                        className={`hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors ${
                          !notification.is_read
                            ? 'bg-mint-50/50 dark:bg-slate-900/50'
                            : ''
                        }`}
                      >
                        <td className="px-6 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {!notification.is_read && (
                              <div className="h-2 w-2 rounded-ds-full bg-mint-500 flex-shrink-0" />
                            )}
                            <span
                              className={`text-ds-small ${
                                !notification.is_read
                                  ? 'font-semibold text-slate-900 dark:text-slate-100'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {notification.title}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-2">
                          <p className="text-ds-small text-slate-600 dark:text-slate-400 line-clamp-2 max-w-md">
                            {notification.body || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap">
                          <p className="text-ds-small text-slate-600 dark:text-slate-400">
                            {formatDate(notification.created_at)}
                          </p>
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleDeleteClick(notification)}
                            className="inline-flex items-center gap-1 rounded-ds-sm px-3 py-1.5 text-ds-small border border-red-400 text-red-600 hover:bg-red-50 transition-colors dark:text-red-400 dark:hover:bg-red-900/20"
                            title={t.delete_notification || 'Delete notification'}
                          >
                            <Trash2 className="h-4 w-4" />
                            {t.delete || 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || isPending}
                      className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small hover:bg-mint-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                      {t.prev || 'Prev'}
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          disabled={isPending}
                          className={`inline-flex items-center rounded-ds-md px-3 py-1.5 text-ds-small transition-colors ${
                            currentPage === page
                              ? 'bg-mint-500 text-white border border-mint-500'
                              : 'border border-slate-400 hover:bg-mint-50 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-slate-200'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || isPending}
                      className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small hover:bg-mint-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                      {t.next || 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setNotificationToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={t.delete_notification || 'Delete Notification'}
        message={`${t.delete_notification_confirm || 'Are you sure you want to delete this notification'} "${notificationToDelete?.title}"? ${t.delete_notification_confirm?.includes('cannot be undone') ? '' : 'This action cannot be undone.'}`}
        loading={isDeleting}
        error={deleteError}
        confirmButtonText={t.delete || 'Delete'}
        cancelButtonText={t.cancel || 'Cancel'}
      />

      {/* Delete All Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteAllModalOpen}
        onClose={() => {
          setIsDeleteAllModalOpen(false);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteAllConfirm}
        title={t.delete_all_notifications || 'Delete All Notifications'}
        message={t.delete_all_confirm || 'Are you sure you want to delete all notifications? This action cannot be undone.'}
        loading={isDeletingAll}
        error={deleteError}
        confirmButtonText={t.delete || 'Delete'}
        cancelButtonText={t.cancel || 'Cancel'}
      />
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-mint-100 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-ds-md mt-14 flex items-center gap-ds-sm">
            <div className="h-10 w-20 animate-pulse bg-mint-200 dark:bg-slate-700 rounded-ds-md"></div>
            <div className="h-8 w-48 animate-pulse bg-mint-200 dark:bg-slate-700 rounded-ds-md"></div>
          </div>
          <LoadingSkeleton type="table" rows={10} className="rounded-ds-md" />
        </div>
      </div>
    }>
      <NotificationsPageContent />
    </Suspense>
  );
}

