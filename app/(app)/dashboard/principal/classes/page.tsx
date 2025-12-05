'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Menu, Plus, Eye, CircleCheck as CheckCircle2, Edit, UserPlus, Users, X, Trash2 } from 'lucide-react';

import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import Loading from '@/app/components/shared/Loading';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/hooks/useAuth';

import { StudentAssignmentModal } from '@/app/components/principal/classes/StudentAssignmentModal';
import { TeacherAssignmentModal } from '@/app/components/principal/classes/TeacherAssignmentModal';
import { DeleteClassModal } from '@/app/components/principal/classes/DeleteClassModal';
import type {
  AvailableStudent,
  AvailableTeacher,
  ClassSummary,
  TranslationStrings,
} from '@/app/components/principal/classes/types';

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function ClassesPageContent() {
  const { t } = useLanguage();
  const { session } = (useAuth?.() || {}) as { session: { user?: { id?: string } } | null };
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sidebarRef } = usePrincipalPageLayout();

  // Class management states
  const [showDeleteClassModal, setShowDeleteClassModal] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassSummary | null>(null);
  const [deletingClass, setDeletingClass] = useState(false);
  const [classes, setClasses] = useState<ClassSummary[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('classes_cache');
      return cached ? JSON.parse(cached) : [];
    }
    return [];
  });
  const [classStudentCounts, setClassStudentCounts] = useState<Record<string, number>>({});
  const [loadingClass, setLoadingClass] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successClassName, setSuccessClassName] = useState('');

  // Load cached data immediately on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedClasses = localStorage.getItem('classes_cache');
      const cachedClassStudentCounts = localStorage.getItem('class_student_counts_cache');
      
      if (cachedClasses) setClasses(JSON.parse(cachedClasses));
      if (cachedClassStudentCounts) setClassStudentCounts(JSON.parse(cachedClassStudentCounts));
    }
  }, []);

  // Load classes data
  const loadClasses = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoadingClass(true);
        const response = await fetch(`/api/classes`, { cache: 'no-store' });
        const data = await response.json();

        if (response.ok) {
          const classesData = Array.isArray(data.classes) ? data.classes : null;
          if (classesData) {
            // Normalize to ensure assigned_teachers exists
            const normalized: ClassSummary[] = classesData.map((cls: any) => ({
              id: cls.id,
              name: cls.name,
              code: cls.code ?? null,
              assigned_teachers: Array.isArray(cls.assigned_teachers) ? cls.assigned_teachers : [],
            }));
            setClasses(normalized);
            if (typeof window !== 'undefined') {
              localStorage.setItem('classes_cache', JSON.stringify(normalized));
            }
          }
        } else {
          console.error('Error loading classes:', data.error);
        }
      } catch (error) {
        console.error('Error loading classes:', error);
      } finally {
        if (showLoading) setLoadingClass(false);
      }
    },
    [session?.user?.id],
  );

  // Load student counts per class
  const loadStudentsForCounts = useCallback(
    async (showLoading = true) => {
      try {
        const res = await fetch(`/api/students?t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();

        if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

        const studentsList = json.students || [];

        // Count students per class
        const counts: Record<string, number> = {};
        studentsList.forEach((student: any) => {
          const classId = student.class_id || student.classes?.id || null;
          if (classId) {
            counts[classId] = (counts[classId] || 0) + 1;
          }
        });
        setClassStudentCounts(counts);

        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'class_student_counts_cache',
            JSON.stringify(counts),
          );
        }
      } catch (e: any) {
        console.error('❌ Error loading student counts:', e.message);
      }
    },
    [session?.user?.id],
  );

  // Load classes and student counts when session is available
  useEffect(() => {
    if (session?.user?.id) {
      Promise.allSettled([
        loadClasses(false),
        loadStudentsForCounts(false)
      ]);
    }
  }, [loadClasses, loadStudentsForCounts, session?.user?.id]);

  // Listen for student data changes triggered from other pages
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'students_data_changed') {
        loadClasses(false);
        loadStudentsForCounts(false);
        try { localStorage.removeItem('students_data_changed'); } catch {}
      }
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        const studentFlag = typeof window !== 'undefined' ? localStorage.getItem('students_data_changed') : null;
        if (studentFlag) {
          loadClasses(false);
          loadStudentsForCounts(false);
          try { localStorage.removeItem('students_data_changed'); } catch {}
        }
      }
    }
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadClasses, loadStudentsForCounts, session?.user?.id]);

  // Listen for classes data refresh from create page
  useEffect(() => {
    function onClassesRefresh() {
      loadClasses(false);
      loadStudentsForCounts(false);
    }
    function onStorage(e: StorageEvent) {
      if (e.key === 'classes_data_updated') {
        loadClasses(false);
        loadStudentsForCounts(false);
        try { localStorage.removeItem('classes_data_updated'); } catch {}
      }
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        const classesFlag = typeof window !== 'undefined' ? localStorage.getItem('classes_data_updated') : null;
        if (classesFlag) {
          loadClasses(false);
          loadStudentsForCounts(false);
          try { localStorage.removeItem('classes_data_updated'); } catch {}
        }
      }
    }
    window.addEventListener('classes-refresh', onClassesRefresh);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('classes-refresh', onClassesRefresh);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadClasses, loadStudentsForCounts, session?.user?.id]);

  // Check for success query param and show success message
  useEffect(() => {
    const created = searchParams.get('created');
    const className = searchParams.get('name');
    if (created === 'true' && className) {
      setSuccessClassName(decodeURIComponent(className));
      setShowSuccessMessage(true);
      // Remove query params from URL
      router.replace('/dashboard/principal/classes', { scroll: false });
      // Auto-hide success message after 5 seconds
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
        setSuccessClassName('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  const openClassDetailsModal = useCallback((cls: ClassSummary) => {
    router.push(`/dashboard/principal/classes/${cls.id}`);
  }, [router]);

  const openDeleteClassModal = useCallback((cls: ClassSummary) => {
    setClassToDelete(cls);
    setShowDeleteClassModal(true);
  }, []);

  const openEditClass = useCallback((cls: ClassSummary) => {
    router.push(`/dashboard/principal/classes/create?id=${encodeURIComponent(cls.id)}`);
  }, [router]);


  async function handleDeleteClass() {
    if (!classToDelete) return;
    
    try {
      setDeletingClass(true);

      const response = await fetch(`/api/classes?id=${classToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete class');
      }

      // Refresh classes data
      await loadClasses(false);
      await loadStudentsForCounts(false);
      
      // Close modal
      setShowDeleteClassModal(false);
      setClassToDelete(null);
      
    } catch (err: any) {
      console.error('Error deleting class:', err);
    } finally {
      setDeletingClass(false);
    }
  }

  return (
    <>
      {/* Content Header */}
      <div className="mb-ds-md flex flex-col gap-ds-md md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-ds-md">
          {/* Mobile menu button */}
          <button
            onClick={() => sidebarRef.current?.open()}
            className="md:hidden p-2 rounded-ds-md hover:bg-mint-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-ds-h1 font-bold tracking-tight text-ds-text-primary dark:text-slate-100">{t.departments}</h1>
            <p className="mt-2 text-ds-small text-ds-text-muted dark:text-slate-400">{t.overview_hint}</p>
          </div>
        </div>

        <div className="flex items-center gap-ds-md">
          <ProfileSwitcher />
          <button
            onClick={() => router.push('/dashboard/principal/classes/create')}
            className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 px-ds-sm py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Plus className="h-4 w-4" /> {t.add_class}
          </button>
        </div>
      </div>

        {/* Departments table */}
        <div className="mt-ds-md rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
         
          <div className="overflow-x-auto overflow-hidden border border-slate-200 dark:border-slate-700 rounded-ds-md">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-mint-500">
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-md">
                    {t.col_name}
                  </th>
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                    {t.col_students}
                  </th>
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                    {t.col_staff}
                  </th>
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                    {t.col_visible}
                  </th>
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-md">
                    {t.col_actions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <tr key={cls.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="text-left py-2 px-4 text-ds-small font-medium text-slate-900 dark:text-slate-100">{cls.name}</td>
                    <td className="text-left py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                      {classStudentCounts[cls.id] || 0}
                    </td>
                    <td className="text-left py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                      {cls.assigned_teachers?.length || 0}
                    </td>
                    <td className="text-left py-2 px-4 text-ds-small">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 rounded-ds-full border px-2 py-0.5 text-ds-tiny',
                          'border-mint-200 bg-mint-50 text-mint-700 dark:border-mint-600 dark:bg-mint-900/20 dark:text-mint-300'
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t.visible_yes}
                      </span>
                    </td>
                    <td className="text-left py-2 px-4 text-ds-small">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => openClassDetailsModal(cls)}
                          className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2.5 py-1 text-ds-tiny hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t.show}
                        </button>
                        <button
                          onClick={() => openEditClass(cls)}
                          className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2.5 py-1 text-ds-tiny hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          {t.edit}
                        </button>
                        <button
                          onClick={() => openDeleteClassModal(cls)}
                          className="inline-flex items-center gap-1 rounded-ds-sm border border-red-300 px-2.5 py-1 text-ds-tiny text-red-600 hover:bg-red-50 transition-colors dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t.delete}
                        </button>
                        <StudentAssignmentModal
                          classId={cls.id}
                          className={cls.name}
                          t={t as unknown as TranslationStrings}
                          onCompleted={() => {
                            void loadClasses(false);
                            void loadStudentsForCounts(false);
                          }}
                          trigger={(open) => (
                            <button
                              onClick={open}
                              className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2.5 py-1 text-ds-tiny hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              {t.add_student}
                            </button>
                          )}
                        />
                        <TeacherAssignmentModal
                          classId={cls.id}
                          className={cls.name}
                          t={t as unknown as TranslationStrings}
                          onCompleted={() => {
                            void loadClasses(false);
                          }}
                          trigger={(open) => (
                            <button
                              onClick={open}
                              className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2.5 py-1 text-ds-tiny hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                              <Users className="h-3.5 w-3.5" />
                              {t.assign_teacher}
                            </button>
                          )}
                        />
                      </div>
                    </td>
                  </tr>
                ))}

                {classes.length === 0 && (
                  <tr>
                    <td className="text-center py-4 px-4 text-ds-small text-slate-600 dark:text-slate-400" colSpan={5}>
                      {t.empty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Success Message */}
        {showSuccessMessage && successClassName && (
          <div className="mt-4 rounded-ds-md bg-mint-50 border border-mint-200 px-4 py-3 text-ds-small text-mint-700 dark:bg-mint-900/20 dark:border-mint-800 dark:text-mint-400">
            <div className="flex items-center justify-between">
              <span>
                <strong>{successClassName}</strong> {t.class_created_message}
              </span>
              <button
                onClick={() => {
                  setShowSuccessMessage(false);
                  setSuccessClassName('');
                }}
                className="ml-4 text-mint-600 hover:text-mint-800 transition-colors dark:text-mint-400 dark:hover:text-mint-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <DeleteClassModal
          isOpen={showDeleteClassModal && !!classToDelete}
          t={t as unknown as TranslationStrings}
          className={classToDelete?.name ?? ''}
          assignmentError={null}
          deletingClass={deletingClass}
          onCancel={() => {
            setShowDeleteClassModal(false);
            setClassToDelete(null);
          }}
          onConfirm={handleDeleteClass}
        />
    </>
  );
}

// Translations removed - using centralized translations from @/lib/translations

export default function ClassesPage() {
  return (
    <PrincipalPageLayout>
      <Suspense fallback={<Loading fullScreen variant="sand" />}>
        <ClassesPageContent />
      </Suspense>
    </PrincipalPageLayout>
  );
}
