'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Calendar, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { ActivityLog } from '@/app/components/shared/ActivityLog';
import { ActivityModal } from '@/app/components/shared/ActivityModal';
import EmptyState from '@/app/components/EmptyState';
import type { DailyLogWithRelations } from '@/lib/types/daily-logs';

function PrincipalDailyLogsPageContent() {
  const { t, lang } = useLanguage();
  const { sidebarRef } = usePrincipalPageLayout();
  const [activities, setActivities] = useState<DailyLogWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<DailyLogWithRelations | null>(null);

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

  const handleDelete = () => {
    loadActivities();
  };

  const handleModalSuccess = () => {
    loadActivities();
  };

  return (
    <>
      <PageHeader
        title={t.activity_log || 'Activity Log'}
        subtitle={(t as any).activity_log_subtitle || 'View and manage daily activity logs'}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
        rightActions={
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small font-medium text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Plus className="h-4 w-4" />
            {t.add_activity || 'Add Activity'}
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-ds-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-ds-small text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && activities.length === 0 && (
        <div className="rounded-ds-lg border border-slate-200 bg-white p-8 shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          <EmptyState
            lang={lang}
            icon={Calendar}
            title={t.no_activities || 'No activities recorded yet'}
            description={(t as any).no_activities_description || 'There are no activity logs available at this time. Click "Add Activity" to create your first activity log.'}
          />
        </div>
      )}

      {/* Activity Log - Only render when there are activities or loading */}
      {(loading || activities.length > 0) && (
        <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
          <ActivityLog
            activities={activities}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canEdit={true}
            canDelete={true}
            loading={loading}
            onRefresh={loadActivities}
          />
        </div>
      )}

      <ActivityModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingActivity(null);
        }}
        onSuccess={handleModalSuccess}
        initialData={editingActivity}
      />
    </>
  );
}

export default function PrincipalDailyLogsPage() {
  return (
    <PrincipalPageLayout>
      <PrincipalDailyLogsPageContent />
    </PrincipalPageLayout>
  );
}

