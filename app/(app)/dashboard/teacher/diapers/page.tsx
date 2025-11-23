'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';
import { useRouter } from 'next/navigation';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Camera, Timer, Users, Plus, Send, Paperclip, Bell, X, Search, ChevronLeft, ChevronRight, Edit, Trash2, Link as LinkIcon, Mail, Utensils, Menu, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrentUserOrgId } from '@/lib/hooks/useCurrentUserOrgId';
import { useTeacherStudents } from '@/lib/hooks/useTeacherStudents';
import type { Student, TeacherClass } from '@/lib/types/attendance';
import type { HealthLog, HealthLogWithRelations, HealthLogFormData } from '@/lib/types/health-logs';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { HealthLogFormModal } from '@/app/components/shared/HealthLogFormModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Small helpers
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

// Diapers Page Header Component
function DiapersPageHeader({ title }: { title: string }) {
  const { sidebarRef } = useTeacherPageLayout();
  
  return (
    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={() => sidebarRef.current?.open()}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        <ProfileSwitcher />
      </div>
    </div>
  );
}

export default function TeacherDiapersPage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();

  return (
    <TeacherPageLayout>
      {/* Content Header */}
      <DiapersPageHeader title={t.di_title} />
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{t.di_hint}</p>
      {/* Diapers Panel */}
      <section>
        <DiaperPanel t={t} />
      </section>
    </TeacherPageLayout>
  );
}

/* -------------------- Debounce Hook -------------------- */

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/* -------------------- Student Search Dropdown -------------------- */

function StudentSearchDropdown({
  value,
  onChange,
  students,
  isLoading,
  placeholder,
  required = false,
}: {
  value: string | null;
  onChange: (studentId: string | null) => void;
  students: Student[];
  isLoading: boolean;
  placeholder: string;
  required?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounced(searchQuery, 250);

  // Get selected student - use useMemo to ensure it updates when students or value changes
  const selectedStudent = useMemo(() => {
    if (!value || students.length === 0) return undefined;
    return students.find(s => String(s.id) === String(value));
  }, [students, value]);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!debouncedQuery.trim()) return students;
    
    const query = debouncedQuery.toLowerCase();
    return students.filter((student) => {
      const firstName = (student.users?.first_name || student.first_name || '').toLowerCase();
      const lastName = (student.users?.last_name || student.last_name || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      const className = (student.classes?.name || '').toLowerCase();
      
      return fullName.includes(query) || 
             firstName.includes(query) || 
             lastName.includes(query) ||
             className.includes(query);
    });
  }, [students, debouncedQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isOpen && !target.closest('.student-search-dropdown')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (student: Student) => {
    onChange(student.id);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onChange(null);
    setSearchQuery('');
    setIsOpen(false);
  };

  return (
    <div className="student-search-dropdown relative">
      <div className="relative">
        {selectedStudent ? (
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-700">
            <span className="flex-1 text-sm text-slate-900 dark:text-slate-200">
              {`${selectedStudent.users?.first_name || selectedStudent.first_name || ''} ${selectedStudent.users?.last_name || selectedStudent.last_name || ''}`.trim() || 'Unknown Student'}
              {selectedStudent.classes?.name && (
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                  ({selectedStudent.classes.name})
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2 pr-8 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              placeholder={isLoading ? 'Loading students...' : placeholder}
              required={required}
            />
            <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        )}
      </div>

      {isOpen && !selectedStudent && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {isLoading && (
            <div className="p-3 text-sm text-slate-500 dark:text-slate-400">Loading students...</div>
          )}
          {!isLoading && filteredStudents.length === 0 && (
            <div className="p-3 text-sm text-slate-500 dark:text-slate-400">
              {searchQuery.trim() ? 'No students found' : 'No students available'}
            </div>
          )}
          {!isLoading && filteredStudents.length > 0 && (
            <div className="py-1">
              {filteredStudents.map((student) => {
                const firstName = student.users?.first_name || student.first_name || '';
                const lastName = student.users?.last_name || student.last_name || '';
                const fullName = `${firstName} ${lastName}`.trim();
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(student);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">{fullName || 'Unknown'}</div>
                    {student.classes?.name && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">{student.classes.name}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------- Health Logs Panel -------------------- */

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
  const { session } = useAuth();
  const { orgId } = useCurrentUserOrgId();
  const { lang } = useLanguage();

  // Teacher classes state
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

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

  // Load teacher classes
  const loadTeacherClasses = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      setLoadingClasses(true);
      const response = await fetch(`/api/teacher-classes?userId=${session.user.id}&t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (response.ok && data.classes) {
        setTeacherClasses(data.classes as TeacherClass[]);
      } else {
        setTeacherClasses([]);
      }
    } catch (error) {
      console.error('Error loading teacher classes:', error);
      setTeacherClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }, [session?.user?.id]);

  // Load health logs
  const loadHealthLogs = useCallback(async () => {
    if (!orgId || !session?.user?.id) return;
    try {
      setLoadingLogs(true);
      setError(null);
      const response = await fetch(
        `/api/health-logs?orgId=${orgId}&recordedBy=${session.user.id}`,
        { cache: 'no-store' }
      );
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
  }, [orgId, session?.user?.id]);

  // Load data on mount
  useEffect(() => {
    loadTeacherClasses();
  }, [loadTeacherClasses]);

  useEffect(() => {
    if (orgId && session?.user?.id) {
      loadHealthLogs();
    }
  }, [orgId, session?.user?.id, loadHealthLogs]);

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
    data: HealthLogFormData & { id?: string; org_id?: string; recorded_by?: string }
  ) {
    if (!orgId || !session?.user?.id) {
      setLogError('Missing organization or user information');
      return;
    }

    setSubmittingLog(true);
    setLogError(null);

    try {
      const url = '/api/health-logs';
      const method = editingLog ? 'PUT' : 'POST';

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
            org_id: orgId,
            student_id: data.student_id,
            type: data.type,
            recorded_at: data.recorded_at,
            temperature_celsius: data.temperature_celsius,
            notes: data.notes,
            severity: data.severity,
            data: data.data || {},
            recorded_by: session.user.id,
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
          {t.di_title || 'Health Logs'}
        </h2>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Plus className="h-4 w-4" /> {lang === 'is' ? 'Bæta við skráningu' : 'Add Log'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {loadingLogs ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : healthLogs.length === 0 ? (
        <div className="text-center py-12">
          <Baby className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-500 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            {lang === 'is'
              ? 'Engar heilsuskráningar fundust. Smelltu á "Bæta við skráningu" til að búa til eina.'
              : 'No health logs found. Click "Add Log" to create one.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-black">
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Dagsetning/Tími' : 'Date/Time'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {t.child || 'Child'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {t.di_type || 'Type'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {t.notes || 'Notes'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {t.actions || 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {healthLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-2 px-4 text-sm text-slate-900 dark:text-slate-100">
                    <span suppressHydrationWarning>
                      {formatHealthLogDate(log.recorded_at, lang)}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {getStudentName(log)}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {HEALTH_LOG_TYPE_LABELS[log.type]?.[lang] || log.type}
                    {log.temperature_celsius && (
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        ({log.temperature_celsius}°C)
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
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
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[13px] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        title={t.edit || 'Edit'}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        {t.edit || 'Edit'}
                      </button>
                      <button
                        onClick={() => openDeleteModal(log.id)}
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

      {orgId && session?.user?.id && (
        <HealthLogFormModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSubmit={handleLogSubmit}
          initialData={editingLog}
          orgId={orgId}
          classes={teacherClasses}
          userId={session.user.id}
          loading={submittingLog}
          error={logError}
        />
      )}
    </div>
  );
}

// Translations removed - using centralized translations from @/lib/translations

