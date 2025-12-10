'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/hooks/useAuth';
import TeacherSelection from '@/app/components/TeacherSelection';

export interface ClassData {
  id: string;
  name: string;
  code?: string;
  assigned_teachers?: Array<{ id?: string; user_id?: string }>;
}

export interface ClassFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: ClassData | null;
  lang?: 'is' | 'en';
}

export function ClassFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  lang: propLang,
}: ClassFormModalProps) {
  const { t, lang: contextLang } = useLanguage();
  const lang = propLang || contextLang;
  const { user, session } = useAuth?.() || ({} as any);

  // Form state
  const [formData, setFormData] = useState({ name: '', description: '', capacity: '' });
  const [loadingClass, setLoadingClass] = useState(false);
  const [loadingClassData, setLoadingClassData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedTeacherIdsRef = useRef<string[]>([]);
  const [initialTeacherIds, setInitialTeacherIds] = useState<string[]>([]);

  const isEditMode = !!initialData?.id;

  // Load class data when initialData has id but no name (standalone usage)
  useEffect(() => {
    if (isOpen && initialData?.id && !initialData.name) {
      loadClassData();
    }
  }, [isOpen, initialData?.id, initialData?.name]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({ name: '', description: '', capacity: '' });
      setError(null);
      setLoadingClass(false);
      setLoadingClassData(false);
      selectedTeacherIdsRef.current = [];
      setInitialTeacherIds([]);
    }
  }, [isOpen]);

  // Initialize form from initialData
  useEffect(() => {
    if (isOpen) {
      if (initialData && initialData.name) {
        // Use provided initialData (page already loaded it)
        setFormData({
          name: initialData.name || '',
          description: initialData.code || '',
          capacity: '',
        });

        // Set selected teachers
        if (initialData.assigned_teachers && Array.isArray(initialData.assigned_teachers)) {
          const teacherIds = initialData.assigned_teachers
            .map((teacher: any) => teacher.id || teacher.user_id)
            .filter(Boolean);
          selectedTeacherIdsRef.current = teacherIds;
          setInitialTeacherIds(teacherIds);
        }
      } else if (!initialData) {
        // Reset for create mode
        setFormData({ name: '', description: '', capacity: '' });
        selectedTeacherIdsRef.current = [];
        setInitialTeacherIds([]);
      }
      // If initialData.id exists but no name, loadClassData will handle it
    }
  }, [isOpen, initialData]);

  async function loadClassData() {
    if (!initialData?.id) return;

    try {
      setLoadingClassData(true);
      setError(null);

      // Fetch all classes and find the one with matching ID
      const response = await fetch(`/api/classes?t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load class data');
      }

      const classData = data.classes?.find((cls: any) => cls.id === initialData.id);

      if (classData) {
        setFormData({
          name: classData.name || '',
          description: classData.code || '',
          capacity: '',
        });

        // Set selected teachers
        if (classData.assigned_teachers && Array.isArray(classData.assigned_teachers)) {
          const teacherIds = classData.assigned_teachers
            .map((teacher: any) => teacher.id || teacher.user_id)
            .filter(Boolean);
          selectedTeacherIdsRef.current = teacherIds;
          setInitialTeacherIds(teacherIds);
        }
      } else {
        setError('Class not found');
      }
    } catch (err: any) {
      console.error('❌ Error loading class data:', err);
      setError(err.message || 'Failed to load class data');
    } finally {
      setLoadingClassData(false);
    }
  }

  // Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loadingClass) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, loadingClass, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Class name is required');
      return;
    }

    if (!session?.user?.id) {
      setError('User session not found. Please log in again.');
      return;
    }

    try {
      setLoadingClass(true);

      const userId = session.user.id;

      if (isEditMode && initialData?.id) {
        // Update existing class
        const response = await fetch('/api/classes', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: initialData.id,
            name: formData.name,
            code: formData.description || null,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update class');
        }

        // Handle teacher assignments for edit mode
        // Note: This is a simplified approach. You may want to update teacher assignments separately
        if (selectedTeacherIdsRef.current.length > 0 && initialData.id) {
          const assignmentPromises = selectedTeacherIdsRef.current.map(async (teacherId) => {
            try {
              const assignResponse = await fetch('/api/assign-teacher-class', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: teacherId,
                  classId: initialData.id,
                }),
              });

              if (!assignResponse.ok) {
                const assignData = await assignResponse.json();
                console.warn(`Failed to assign teacher ${teacherId} to class:`, assignData.error);
              }
            } catch (err) {
              console.error(`Error assigning teacher ${teacherId} to class:`, err);
            }
          });

          await Promise.allSettled(assignmentPromises);
        }

        // Trigger refresh
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('classes_data_updated', 'true');
            window.dispatchEvent(new Event('classes-refresh'));
          }
        } catch {}

        // Call success callback and close
        onSuccess();
        onClose();
      } else {
        // Create new class
        const response = await fetch('/api/classes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            code: formData.description || null,
            created_by: userId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create class');
        }

        const createdClassId = data.class?.id;
        if (!createdClassId) {
          throw new Error('Class created but no class ID returned');
        }

        // Assign selected teachers to the class
        if (selectedTeacherIdsRef.current.length > 0 && createdClassId) {
          const assignmentPromises = selectedTeacherIdsRef.current.map(async (teacherId) => {
            try {
              const assignResponse = await fetch('/api/assign-teacher-class', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: teacherId,
                  classId: createdClassId,
                }),
              });

              if (!assignResponse.ok) {
                const assignData = await assignResponse.json();
                console.warn(`Failed to assign teacher ${teacherId} to class:`, assignData.error);
              }
            } catch (err) {
              console.error(`Error assigning teacher ${teacherId} to class:`, err);
            }
          });

          await Promise.allSettled(assignmentPromises);
        }

        // Trigger refresh
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('classes_data_updated', 'true');
            window.dispatchEvent(new Event('classes-refresh'));
          }
        } catch {}

        // Call success callback and close
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      setError(error.message || `An error occurred while ${isEditMode ? 'updating' : 'creating'} the class`);
    } finally {
      setLoadingClass(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      onClick={(e) => {
        // Close on outside click
        if (e.target === e.currentTarget && !loadingClass) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl rounded-ds-lg bg-white dark:bg-slate-800 p-4 sm:p-ds-md shadow-ds-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <h3 className="text-ds-small sm:text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
            {isEditMode ? t.edit_class : t.add_class}
          </h3>
          <button
            onClick={onClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 active:bg-mint-200 dark:active:bg-slate-600 transition-colors"
            disabled={loadingClass || loadingClassData}
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 sm:mb-4 rounded-ds-md bg-red-50 border border-red-200 px-3 sm:px-4 py-2 sm:py-3 text-ds-tiny sm:text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {loadingClassData && (
          <div className="mb-3 sm:mb-4 text-ds-tiny sm:text-ds-small text-slate-600 dark:text-slate-400">
            {t.loading || 'Loading...'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.class_name}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t.class_name_placeholder}
              className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-tiny sm:text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              required
              disabled={loadingClass || loadingClassData}
            />
          </div>

          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.class_description}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder={t.class_description_placeholder}
              className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-tiny sm:text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              rows={3}
              disabled={loadingClass || loadingClassData}
            />
          </div>

          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.class_capacity}
            </label>
            <input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData((prev) => ({ ...prev, capacity: e.target.value }))}
              placeholder={t.class_capacity_placeholder}
              className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-tiny sm:text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              min="1"
              disabled={loadingClass || loadingClassData}
            />
          </div>

          {!isEditMode && (
            <div>
              <TeacherSelection
                onSelectionChange={(ids) => {
                  selectedTeacherIdsRef.current = ids;
                }}
                lang={lang}
                initialSelectedIds={initialTeacherIds}
              />
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loadingClass || loadingClassData}
              className="flex-1 rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm py-2 text-ds-tiny sm:text-ds-small text-ds-text-primary hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loadingClass || loadingClassData}
              className="flex-1 rounded-ds-md bg-mint-500 px-ds-md py-ds-sm text-ds-tiny sm:text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {loadingClass ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {isEditMode ? t.updating : t.creating}
                </>
              ) : (
                isEditMode ? t.update_class : t.create_class
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

