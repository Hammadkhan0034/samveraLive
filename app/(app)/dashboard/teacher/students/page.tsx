'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, CalendarDays, BookOpen } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import EmptyState from '@/app/components/EmptyState';
import type { Student, TeacherClass, GuardianRelation } from '@/lib/types/attendance';
import { getStudentName } from '@/lib/utils/studentUtils';

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  if (typeof window === 'undefined') return '';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return '-';
  }
}

// StudentsPanel Component
function StudentsPanel({
  t,
  students,
  loadingStudents,
  studentError,
  hasLoadedOnce,
  router
}: {
  t: typeof enText | typeof isText;
  students: Student[];
  loadingStudents: boolean;
  studentError: string | null;
  hasLoadedOnce?: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    
    const query = searchQuery.toLowerCase();
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
  }, [students, searchQuery]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 sm:mb-ds-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2 sm:mb-ds-sm">
          <div className="flex items-center gap-2 sm:gap-ds-xs">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-2.5 sm:left-ds-sm top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-ds-text-muted dark:text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search_students_placeholder || 'Search students...'}
                className="w-full sm:w-48 md:w-64 h-10 sm:h-12 pl-8 sm:pl-10 pr-2 sm:pr-ds-sm rounded-ds-xl bg-input-fill border border-input-stroke text-ds-tiny sm:text-ds-body text-ds-text-primary focus:outline-none focus:border-mint-200 focus:ring-2 focus:ring-mint-200/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-mint-300"
              />
            </div>
          </div>
        </div>
        {studentError && (
          <div className="mb-2 sm:mb-ds-md rounded-ds-md bg-red-50 border border-red-200 px-3 sm:px-ds-md py-2 sm:py-ds-sm text-ds-tiny sm:text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {studentError}
          </div>
        )}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-ds-lg">
          {loadingStudents || !hasLoadedOnce ? (
            <LoadingSkeleton type="table" rows={5} />
          ) : filteredStudents.length === 0 ? (
            <div className="p-4 sm:p-ds-lg">
              <EmptyState
                icon={Users}
                title={t.no_students_found_title || 'No Students Found'}
                description={searchQuery 
                  ? (t.no_students_found_search || 'No students found matching your search')
                  : ((t as any).no_students_found_description || t.no_students_found || 'No students found in assigned classes')
                }
              />
            </div>
          ) : (
            <>
              <div className="min-w-[640px]">
                <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-mint-500">
                    <th className="text-left py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-lg">
                      {t.student_name}
                    </th>
                    <th className="text-left py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small font-medium text-white dark:text-slate-300 hidden md:table-cell">
                      {t.student_dob}
                    </th>
                    <th className="text-left py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small font-medium text-white dark:text-slate-300 hidden lg:table-cell">
                      {t.student_gender}
                    </th>
                    <th className="text-left py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small font-medium text-white dark:text-slate-300 hidden sm:table-cell">
                      {t.student_class}
                    </th>
                    <th className="text-left py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-lg">
                      {t.guardians || 'Guardians'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((student) => (
                    <tr 
                      key={student.id} 
                      onClick={() => router.push(`/dashboard/teacher/students/${encodeURIComponent(student.id)}`)}
                      className="border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      <td className="py-2 px-2 sm:px-4">
                        <div className="font-medium text-ds-tiny text-ds-text-primary dark:text-slate-100">
                          {getStudentName(student)}
                        </div>
                      </td>
                      <td className="py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small text-ds-text-secondary dark:text-slate-400 hidden md:table-cell">
                        <span suppressHydrationWarning>
                          {formatDate(student.users?.dob || student.dob)}
                        </span>
                      </td>
                      <td className="py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small text-ds-text-secondary dark:text-slate-400 hidden lg:table-cell">
                        {student.users?.gender || student.gender || '-'}
                      </td>
                      <td className="py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small text-ds-text-secondary dark:text-slate-400 hidden sm:table-cell">
                        {student.classes?.name || '-'}
                      </td>
                      <td className="py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small text-ds-text-secondary dark:text-slate-400">
                        {student.guardians && Array.isArray(student.guardians) && student.guardians.length > 0 ? (
                          <div className="flex flex-col gap-0.5 sm:gap-1">
                            {student.guardians.map((guardian: GuardianRelation, idx) => {
                              const guardianName = guardian.users
                                ? `${guardian.users.first_name || ''} ${guardian.users.last_name || ''}`.trim()
                                : null;
                              return guardianName ? (
                                <span key={guardian.id || idx} className="text-ds-tiny truncate">
                                  {guardianName}
                                  {guardian.relation ? ` (${guardian.relation})` : ''}
                                </span>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <span className="text-ds-text-muted dark:text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>

              {filteredStudents.length > 0 && (
                <div className="mt-2 sm:mt-ds-sm mb-2 sm:mb-ds-sm mr-2 sm:mr-ds-sm flex items-center justify-center sm:justify-end gap-1 sm:gap-ds-xs flex-wrap px-2 sm:px-0">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 sm:gap-ds-xs rounded-ds-md border border-input-stroke bg-input-fill px-2 sm:px-3 py-1.5 text-ds-tiny sm:text-ds-small text-ds-text-primary hover:bg-mint-50 hover:border-mint-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 active:bg-mint-100 dark:active:bg-slate-600"
                  >
                    {t.prev || 'Prev'}
                  </button>

                  <div className="flex items-center gap-0.5 sm:gap-ds-xs flex-wrap justify-center">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-2 sm:px-3 py-1.5 text-ds-tiny sm:text-ds-small rounded-ds-md transition-colors ${
                          currentPage === page
                            ? 'bg-mint-500 text-white border border-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                            : 'border border-input-stroke bg-input-fill text-ds-text-primary hover:bg-mint-50 hover:border-mint-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 sm:gap-ds-xs rounded-ds-md border border-input-stroke bg-input-fill px-2 sm:px-3 py-1.5 text-ds-tiny sm:text-ds-small text-ds-text-primary hover:bg-mint-50 hover:border-mint-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 active:bg-mint-100 dark:active:bg-slate-600"
                  >
                    {t.next || 'Next'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeacherStudentsPage() {
  const { t } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();

  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  
  // Ensure students array is empty on initial mount - never load all students by default
  useEffect(() => {
    setStudents([]);
    setHasLoadedOnce(false);
    setLoadingStudents(false);
  }, []); // Only run on mount

  const loadTeacherClasses = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setLoadingClasses(false);
      return;
    }

    try {
      setLoadingClasses(true);
      const response = await fetch(`/api/teacher-classes?userId=${userId}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();

      if (response.ok) {
        const classesData = (data.classes || []) as TeacherClass[];
        // Filter out any "AllClasses" or org-wide options - only show actual assigned classes
        const validClasses = classesData.filter(cls => 
          cls && 
          cls.id && 
          cls.name && 
          !cls.name.toLowerCase().includes('all classes') &&
          !cls.name.toLowerCase().includes('org-wide') &&
          !cls.name.toLowerCase().includes('organization-wide')
        );
        setTeacherClasses(validClasses);
        if (typeof window !== 'undefined') {
          localStorage.setItem('teacher_classes_cache', JSON.stringify(validClasses));
        }
      } else {
        setTeacherClasses([]);
      }
    } catch (error) {
      setTeacherClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }, [session?.user?.id]);

  const loadStudents = useCallback(async (classId: string | null, showLoading = true) => {
    if (!classId) {
      setStudents([]);
      setHasLoadedOnce(true);
      if (showLoading) setLoadingStudents(false);
      return;
    }

    try {
      if (showLoading) setLoadingStudents(true);
      setStudentError(null);

      const timestamp = Date.now();

      const response = await fetch(`/api/students?classId=${classId}&t=${timestamp}`, {
        cache: 'no-store',
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          setStudents([]);
          setHasLoadedOnce(true);
          if (showLoading) setLoadingStudents(false);
          return;
        }
        throw new Error(`Failed to load students: ${response.status}`);
      }

      const data = await response.json();
      if (data.students && Array.isArray(data.students)) {
        const classInfo = teacherClasses.find(cls => cls.id === classId);
        const studentsWithClassInfo = data.students.map((student: Student) => ({
          ...student,
          classes: {
            id: student.class_id || '',
            name: classInfo?.name || `Class ${student.class_id?.slice(0, 8)}...`
          }
        }));

        setStudents(studentsWithClassInfo);
        setHasLoadedOnce(true);

        if (typeof window !== 'undefined') {
          localStorage.setItem(`teacher_students_cache_${classId}`, JSON.stringify(studentsWithClassInfo));
        }
      } else {
        setStudents([]);
        setHasLoadedOnce(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load students';
      setStudentError(errorMessage);
      setHasLoadedOnce(true);

      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(`teacher_students_cache_${classId}`);
          if (cached) {
            const cachedStudents = JSON.parse(cached) as Student[];
            setStudents(cachedStudents);
          }
        } catch {
          // Ignore cache errors
        }
      }
    } finally {
      if (showLoading) setLoadingStudents(false);
    }
  }, [teacherClasses]);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Clear any old cached students to prevent loading all students on mount
    if (typeof window !== 'undefined') {
      try {
        // Clear old cache keys that might have all students
        // Remove the old general cache key, but keep class-specific ones (teacher_students_cache_${classId})
        const oldCacheKey = 'teacher_students_cache';
        if (localStorage.getItem(oldCacheKey)) {
          localStorage.removeItem(oldCacheKey);
        }
        
        // Clear any cached selected class to prevent auto-selection
        localStorage.removeItem('teacher_selected_class_id');

        const cachedClasses = localStorage.getItem('teacher_classes_cache');
        if (cachedClasses) {
          const parsed = JSON.parse(cachedClasses);
          if (Array.isArray(parsed)) {
            // Filter out any invalid classes from cache too
            const validClasses = parsed.filter((cls: TeacherClass) => 
              cls && 
              cls.id && 
              cls.name && 
              !cls.name.toLowerCase().includes('all classes') &&
              !cls.name.toLowerCase().includes('org-wide') &&
              !cls.name.toLowerCase().includes('organization-wide')
            );
            setTeacherClasses(validClasses);
            setLoadingClasses(false);
          }
        }
      } catch {
        // Ignore cache parsing errors
      }
    }

    loadTeacherClasses();
  }, [session?.user?.id, loadTeacherClasses]);

  useEffect(() => {
    // Only load students when a class is explicitly selected
    // Never load students on initial mount or when no class is selected
    if (selectedClassId) {
      loadStudents(selectedClassId, true);
    } else {
      // Clear students when no class is selected
      setStudents([]);
      setHasLoadedOnce(false);
      setLoadingStudents(false);
      setStudentError(null);
    }
  }, [selectedClassId, loadStudents]);

  function TeacherStudentsContent() {
    const { sidebarRef } = useTeacherPageLayout();
    const lang = typeof t === typeof enText ? 'en' : 'is';

    return (
      <>
        <PageHeader
          title={t.students}
          subtitle={t.students_subtitle}
          showMobileMenu={true}
          onMobileMenuClick={() => sidebarRef.current?.open()}
          
        />

        {loadingClasses ? (
          <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
            <LoadingSkeleton type="table" rows={3} />
          </div>
        ) : teacherClasses.length === 0 ? (
          <div className="rounded-ds-lg border border-slate-200 bg-white p-4 sm:p-ds-lg shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
            <EmptyState
              icon={BookOpen}
              title={t.no_classes_assigned_title}
              description={t.no_classes_assigned_description}
            />
          </div>
        ) : (
          <>
            <div className="mb-3 sm:mb-ds-md">
              <select
                value={selectedClassId || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  // Ensure we never set "all" or empty string that might trigger loading all students
                  setSelectedClassId(value && value !== 'all' ? value : null);
                }}
                className="w-full max-w-md h-10 sm:h-12 rounded-ds-xl bg-input-fill border border-input-stroke text-ds-tiny sm:text-ds-body text-ds-text-primary focus:outline-none focus:border-mint-200 focus:ring-2 focus:ring-mint-200/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-mint-300 px-3 sm:px-ds-sm"
              >
                <option value="">{t.select_class_placeholder}</option>
                {teacherClasses
                  .filter(cls => cls && cls.id && cls.name) // Additional safety filter
                  .map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
              </select>
            </div>

            {!selectedClassId ? (
              <div className="rounded-ds-lg border border-slate-200 bg-white p-4 sm:p-ds-lg shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
                <EmptyState
                  icon={Users}
                  title={t.no_class_selected_title}
                  description={t.no_class_selected_description}
                />
              </div>
            ) : (
              <StudentsPanel 
                t={t} 
                students={students} 
                loadingStudents={loadingStudents} 
                studentError={studentError} 
                hasLoadedOnce={hasLoadedOnce}
                router={router}
              />
            )}
          </>
        )}
      </>
    );
  }

  return (
    <TeacherPageLayout>
      <TeacherStudentsContent />
    </TeacherPageLayout>
  );
}
