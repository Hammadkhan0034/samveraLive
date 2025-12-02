'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useTeacherStudents } from '@/lib/hooks/useTeacherStudents';
import type { HealthLog, HealthLogFormData, HealthLogType } from '@/lib/types/health-logs';
import type { Student } from '@/lib/types/attendance';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';

type Lang = 'is' | 'en';

// Debounce hook
function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// Student Search Dropdown component
function StudentSearchDropdownWrapper({
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

  const selectedStudent = useMemo(() => {
    if (!value || students.length === 0) return undefined;
    return students.find((s) => String(s.id) === String(value));
  }, [students, value]);

  const filteredStudents = useMemo(() => {
    if (!debouncedQuery.trim()) return students;
    const query = debouncedQuery.toLowerCase();
    return students.filter((student) => {
      const firstName = (student.users?.first_name || student.first_name || '').toLowerCase();
      const lastName = (student.users?.last_name || student.last_name || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      const className = (student.classes?.name || '').toLowerCase();
      return (
        fullName.includes(query) ||
        firstName.includes(query) ||
        lastName.includes(query) ||
        className.includes(query)
      );
    });
  }, [students, debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isOpen && !target.closest('.student-search-dropdown')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
          <div className="mt-1 flex items-center gap-2 rounded-ds-md border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-700">
            <span className="flex-1 text-ds-small text-slate-900 dark:text-slate-200">
              {`${selectedStudent.users?.first_name || selectedStudent.first_name || ''} ${selectedStudent.users?.last_name || selectedStudent.last_name || ''}`.trim() ||
                'Unknown Student'}
              {selectedStudent.classes?.name && (
                <span className="ml-2 text-ds-tiny text-slate-500 dark:text-slate-400">
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
              className="mt-1 w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] p-2 pr-8 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              placeholder={isLoading ? 'Loading students...' : placeholder}
              required={required}
            />
            <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        )}
      </div>

      {isOpen && !selectedStudent && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-ds-md border border-slate-200 bg-white shadow-ds-md dark:border-slate-700 dark:bg-slate-800">
          {isLoading && (
            <div className="p-3 text-ds-small text-slate-500 dark:text-slate-400">Loading students...</div>
          )}
          {!isLoading && filteredStudents.length === 0 && (
            <div className="p-3 text-ds-small text-slate-500 dark:text-slate-400">
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
                    className="w-full px-3 py-2 text-left text-ds-small hover:bg-mint-50 dark:hover:bg-slate-700"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {fullName || 'Unknown'}
                    </div>
                    {student.classes?.name && (
                      <div className="text-ds-tiny text-slate-500 dark:text-slate-400">
                        {student.classes.name}
                      </div>
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

export interface HealthLogFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: HealthLogFormData & { id?: string }) => Promise<void>;
  initialData?: HealthLog | null;
  loading?: boolean;
  error?: string | null;
}

const HEALTH_LOG_TYPES: { value: HealthLogType; label: { en: string; is: string } }[] = [
  { value: 'diaper_wet', label: { en: 'Diaper - Wet', is: 'Bleyja - Vot' } },
  { value: 'diaper_dirty', label: { en: 'Diaper - Dirty', is: 'Bleyja - Skítug' } },
  { value: 'diaper_mixed', label: { en: 'Diaper - Mixed', is: 'Bleyja - Blanda' } },
  { value: 'temperature', label: { en: 'Temperature', is: 'Hitastig' } },
  { value: 'medication', label: { en: 'Medication', is: 'Lyf' } },
  { value: 'nap', label: { en: 'Nap', is: 'Svefn' } },
  { value: 'symptom', label: { en: 'Symptom', is: 'Einkenni' } },
  { value: 'injury', label: { en: 'Injury', is: 'Meiðsli' } },
  { value: 'meal', label: { en: 'Meal', is: 'Máltíð' } },
  { value: 'other', label: { en: 'Other', is: 'Annað' } },
];

export function HealthLogFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  loading = false,
  error: externalError,
}: HealthLogFormModalProps) {
  const { t, lang } = useLanguage();
  const { classes, isLoading: isLoadingClasses } = useTeacherClasses();
  const { students, isLoading: isLoadingStudents } = useTeacherStudents(classes);

  const [formData, setFormData] = useState<HealthLogFormData>({
    student_id: '',
    type: 'diaper_wet',
    recorded_at: new Date().toISOString().slice(0, 16), // Format: YYYY-MM-DDTHH:mm
    temperature_celsius: null,
    notes: '',
    severity: null,
    data: {},
  });
  const [error, setError] = useState<string | null>(null);

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Convert recorded_at to datetime-local format
        const recordedDate = new Date(initialData.recorded_at);
        const localDateTime = new Date(recordedDate.getTime() - recordedDate.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);

        setFormData({
          student_id: initialData.student_id,
          type: initialData.type,
          recorded_at: localDateTime,
          temperature_celsius: initialData.temperature_celsius || null,
          notes: initialData.notes || '',
          severity: initialData.severity || null,
          data: initialData.data || {},
        });
      } else {
        // Reset to defaults for new log
        setFormData({
          student_id: '',
          type: 'diaper_wet',
          recorded_at: new Date().toISOString().slice(0, 16),
          temperature_celsius: null,
          notes: '',
          severity: null,
          data: {},
        });
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.student_id || !formData.recorded_at) {
      setError(t.missing_fields || 'Missing required fields');
      return;
    }

    setError(null);

    try {
      // Convert datetime-local to ISO string
      const recordedAt = new Date(formData.recorded_at).toISOString();

      // org_id and recorded_by are now set server-side from authenticated user
      const submitData = initialData
        ? {
            id: initialData.id,
            ...formData,
            recorded_at: recordedAt,
          }
        : {
            ...formData,
            recorded_at: recordedAt,
          };

      await onSubmit(submitData);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to submit health log');
      }
    }
  };

  if (!isOpen) return null;

  const displayError = error || externalError;
  const showTemperature = formData.type === 'temperature';
  const showSeverity = ['symptom', 'injury', 'other'].includes(formData.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-xl rounded-ds-lg bg-white dark:bg-slate-800 p-ds-md shadow-ds-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
            {initialData ? (lang === 'is' ? 'Breyta heilsuskráningu' : 'Edit Health Log') : (lang === 'is' ? 'Búa til heilsuskráningu' : 'Create Health Log')}
          </h3>
          <button
            onClick={onClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {displayError && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.child} <span className="text-red-500">*</span>
            </label>
            <StudentSearchDropdownWrapper
              value={formData.student_id || null}
              onChange={(id) => setFormData({ ...formData, student_id: id || '' })}
              students={students}
              isLoading={isLoadingClasses || isLoadingStudents}
              placeholder={classes.length === 0 ? 'No classes assigned' : `${t.child} 1`}
              required
            />
          </div>

          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.di_type || 'Type'} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as HealthLogType })}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              required
            >
              {HEALTH_LOG_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {lang === 'is' ? type.label.is : type.label.en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.time || 'Time'} <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.recorded_at}
              onChange={(e) => setFormData({ ...formData, recorded_at: e.target.value })}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              required
            />
          </div>

          {showTemperature && (
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'is' ? 'Hitastig (°C)' : 'Temperature (°C)'} ({t.optional || 'Optional'})
              </label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="45"
                value={formData.temperature_celsius || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    temperature_celsius: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                placeholder="36.5"
              />
            </div>
          )}

          {showSeverity && (
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'is' ? 'Alvarleiki (1-5)' : 'Severity (1-5)'} ({t.optional || 'Optional'})
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.severity || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    severity: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                placeholder="1-5"
              />
            </div>
          )}

          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.notes} ({t.optional || 'Optional'})
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              placeholder={t.di_notes_ph || 'Optional notes…'}
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t.saving || 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t.save}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

