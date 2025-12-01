'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Camera, Timer, Users, Plus, Send, Paperclip, Bell, X, Search, ChevronLeft, ChevronRight, Edit, Trash2, Link as LinkIcon, Mail, Utensils, Menu, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { HealthLog, HealthLogWithRelations, HealthLogFormData } from '@/lib/types/health-logs';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { HealthLogFormModal } from '@/app/components/shared/HealthLogFormModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';


// Small helpers

// Diapers Page Header Component
function DiapersPageHeader({ title }: { title: string }) {
  const { sidebarRef } = useTeacherPageLayout();

  return (
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
        <h2 className="text-ds-h2 font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
      </div>
      <div className="flex items-center gap-ds-sm">
        <ProfileSwitcher />
      </div>
    </div>
  );
}

export default function TeacherDiapersPage() {
  const { t } = useLanguage();

  return (
    <TeacherPageLayout>
      {/* Content Header */}
      <DiapersPageHeader title={t.di_title} />
      <p className="mb-ds-sm text-ds-small text-slate-600 dark:text-slate-400">{t.di_hint}</p>
      {/* Diapers Panel */}
      <section>
        <DiaperPanel t={t} />
      </section>
    </TeacherPageLayout>
  );
}


const HEALTH_LOG_TYPE_LABELS: Record<string, { en: string; is: string }> = {
  diaper_wet: { en: 'Diaper - Wet', is: 'Bleyja - Vot' },
  diaper_dirty: { en: 'Diaper - Dirty', is: 'Bleyja - Skítug' },
  diaper_mixed: { en: 'Diaper - Mixed', is: 'Bleyja - Blanda' },
  temperature: { en: 'Temperature', is: 'Hitastig' },
  medication: { en: 'Medication', is: 'Lyf' },
  nap: { en: 'Nap', is: 'Svefn' },
  symptom: { en: 'Symptom', is: 'Einkenni' },
  injury: { en: 'Injury', is: 'Meiðsli' },
  meal: { en: 'Meal', is: 'Máltíð' },
  other: { en: 'Other', is: 'Annað' },
};

function formatHealthLogDate(dateString: string | undefined, lang: 'is' | 'en'): string {
  if (!dateString) return '—';
  if (typeof window === 'undefined') return '';
  const date = new Date(dateString);
  const locale = lang === 'is' ? 'is-IS' : 'en-US';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStudentName(log: HealthLogWithRelations): string {
  const student = log.students;
  if (!student) return 'Unknown Student';
  const firstName = student.users?.first_name || student.first_name || '';
  const lastName = student.users?.last_name || student.last_name || '';
  return `${firstName} ${lastName}`.trim() || 'Unknown Student';
}

function DiaperPanel({ t }: { t: typeof enText | typeof isText }) {
  const { lang } = useLanguage();

  // Health logs state
  const [healthLogs, setHealthLogs] = useState<HealthLogWithRelations[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<HealthLog | null>(null);
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  // Delete modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  const [deletingLog, setDeletingLog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filter state
  const [selectedFilterType, setSelectedFilterType] = useState<string>('all');

  // Load health logs with optional type filter
  const loadHealthLogs = useCallback(async (filterType?: string) => {
    try {
      setLoadingLogs(true);
      setError(null);
      // Build URL with type filter if provided and not 'all'
      const url = filterType && filterType !== 'all'
        ? `/api/health-logs?type=${encodeURIComponent(filterType)}`
        : '/api/health-logs';
      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data.healthLogs) {
        setHealthLogs(data.healthLogs as HealthLogWithRelations[]);
      } else {
        setError(data.error || 'Failed to load health logs');
        setHealthLogs([]);
      }
    } catch (error) {
      console.error('Error loading health logs:', error);
      setError('Failed to load health logs');
      setHealthLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  // Load data on mount and when filter changes
  useEffect(() => {
    loadHealthLogs(selectedFilterType);
  }, [selectedFilterType, loadHealthLogs]);

  // Modal handlers
  function openModal(log?: HealthLog) {
    if (log) {
      setEditingLog(log);
    } else {
      setEditingLog(null);
    }
    setLogError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingLog(null);
    setLogError(null);
  }

  async function handleLogSubmit(
    data: HealthLogFormData & { id?: string }
  ) {
    setSubmittingLog(true);
    setLogError(null);

    try {
      const url = '/api/health-logs';
      const method = editingLog ? 'PUT' : 'POST';

      // org_id and recorded_by are now set server-side from authenticated user
      const payload = editingLog
        ? {
            id: editingLog.id,
            student_id: data.student_id,
            type: data.type,
            recorded_at: data.recorded_at,
            temperature_celsius: data.temperature_celsius,
            notes: data.notes,
            severity: data.severity,
            data: data.data || {},
          }
        : {
            student_id: data.student_id,
            type: data.type,
            recorded_at: data.recorded_at,
            temperature_celsius: data.temperature_celsius,
            notes: data.notes,
            severity: data.severity,
            data: data.data || {},
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed with ${res.status}`);
      }

      // Refresh logs list
      await loadHealthLogs();
      closeModal();
    } catch (error) {
      console.error('❌ Error submitting health log:', error);
      if (error instanceof Error) {
        setLogError(error.message);
      } else {
        setLogError('Failed to submit health log');
      }
      throw error;
    } finally {
      setSubmittingLog(false);
    }
  }

  // Delete handlers
  function openDeleteModal(logId: string) {
    setLogToDelete(logId);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  }

  function closeDeleteModal() {
    setIsDeleteModalOpen(false);
    setLogToDelete(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!logToDelete) return;
    setDeletingLog(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/health-logs?id=${logToDelete}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed to delete health log: ${res.status}`);
      }
      setHealthLogs((prev) => prev.filter((log) => log.id !== logToDelete));
      closeDeleteModal();
    } catch (error) {
      if (error instanceof Error) {
        setDeleteError(error.message);
      } else {
        setDeleteError('Failed to delete health log');
      }
    } finally {
      setDeletingLog(false);
    }
  }

  return (
    <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-col gap-ds-sm sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">
          {t.di_title || 'Health Logs'}
        </h2>
        <div className="flex items-center gap-ds-sm">
          <select
            value={selectedFilterType}
            onChange={(e) => setSelectedFilterType(e.target.value)}
            className="rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <option value="all">{lang === 'is' ? 'Allt' : 'All'}</option>
            {Object.entries(HEALTH_LOG_TYPE_LABELS).map(([type, labels]) => (
              <option key={type} value={type}>
                {lang === 'is' ? labels.is : labels.en}
              </option>
            ))}
          </select>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Plus className="h-4 w-4" /> {lang === 'is' ? 'Bæta við skráningu' : 'Add Log'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {loadingLogs ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : healthLogs.length === 0 ? (
        <div className="text-center py-12">
          <Baby className="h-12 w-12 mx-auto text-mint-400 dark:text-slate-500 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            {selectedFilterType === 'all'
              ? lang === 'is'
                ? 'Engar heilsuskráningar fundust. Smelltu á "Bæta við skráningu" til að búa til eina.'
                : 'No health logs found. Click "Add Log" to create one.'
              : lang === 'is'
                ? 'Engar heilsuskráningar fundust fyrir valda gerð.'
                : 'No health logs found for the selected type.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-ds-md border border-slate-200 dark:border-slate-700">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-mint-500">
                <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Dagsetning/Tími' : 'Date/Time'}
                </th>
                <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                  {t.child || 'Child'}
                </th>
                <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                  {t.di_type || 'Type'}
                </th>
                <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                  {t.notes || 'Notes'}
                </th>
                <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                  {t.actions || 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {healthLogs.map((log) => (
                <tr key={log.id} className="hover:bg-mint-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="py-2 px-4 text-ds-small text-slate-900 dark:text-slate-100">
                    <span suppressHydrationWarning>
                      {formatHealthLogDate(log.recorded_at, lang)}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                    {getStudentName(log)}
                  </td>
                  <td className="py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                    {HEALTH_LOG_TYPE_LABELS[log.type]?.[lang] || log.type}
                    {log.temperature_celsius && (
                      <span className="ml-2 text-ds-tiny text-slate-500 dark:text-slate-400">
                        ({log.temperature_celsius}°C)
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                    {log.notes ? (
                      <span className="line-clamp-2" title={log.notes}>
                        {log.notes}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openModal(log)}
                        className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2 py-1 text-ds-tiny hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        title={t.edit || 'Edit'}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        {t.edit || 'Edit'}
                      </button>
                      <button
                        onClick={() => openDeleteModal(log.id)}
                        className="inline-flex items-center gap-1 rounded-ds-sm border border-red-300 px-2 py-1 text-ds-tiny text-red-600 hover:bg-red-50 transition-colors dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
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
        title={lang === 'is' ? 'Eyða heilsuskráningu' : 'Delete Health Log'}
        message={
          lang === 'is'
            ? 'Ertu viss um að þú viljir eyða þessari heilsuskráningu? Þessa aðgerð er ekki hægt að afturkalla.'
            : 'Are you sure you want to delete this health log? This action cannot be undone.'
        }
        loading={deletingLog}
        error={deleteError}
        confirmButtonText={t.delete || 'Delete'}
        cancelButtonText={t.cancel || 'Cancel'}
      />

      <HealthLogFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleLogSubmit}
        initialData={editingLog}
        loading={submittingLog}
        error={logError}
      />
    </div>
  );
}

// Translations removed - using centralized translations from @/lib/translations

