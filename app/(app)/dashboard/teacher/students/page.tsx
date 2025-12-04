'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Users, Search, CalendarDays } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
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
  hasLoadedOnce
}: {
  t: typeof enText | typeof isText;
  students: Student[];
  loadingStudents: boolean;
  studentError: string | null;
  hasLoadedOnce?: boolean;
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
    <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-ds-lg">
        <div className="flex items-center justify-between mb-ds-sm">
          <h3 className="text-ds-body font-medium text-ds-text-primary dark:text-slate-100">{t.existing_students}</h3>
          <div className="flex items-center gap-ds-xs">
            <div className="relative">
              <Search className="absolute left-ds-sm top-1/2 transform -translate-y-1/2 h-4 w-4 text-ds-text-muted dark:text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search_students_placeholder || 'Search students...'}
                className="h-12 pl-10 pr-ds-sm rounded-ds-xl bg-input-fill border border-input-stroke text-ds-body text-ds-text-primary focus:outline-none focus:border-mint-200 focus:ring-2 focus:ring-mint-200/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-mint-300 w-64"
              />
            </div>
          </div>
        </div>
        {studentError && (
          <div className="mb-ds-md rounded-ds-md bg-red-50 border border-red-200 px-ds-md py-ds-sm text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {studentError}
          </div>
        )}
        <div className="overflow-x-auto overflow-hidden border border-slate-200 dark:border-slate-700 rounded-ds-lg">
          {loadingStudents || !hasLoadedOnce ? (
            <LoadingSkeleton type="table" rows={5} />
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-4 text-ds-text-muted dark:text-slate-400">
              {searchQuery ? (t.no_students_found_search || 'No students found matching your search') : t.no_students_found}
            </div>
          ) : (
            <>
              <table className="w-full border-collapse">
              <thead>
                <tr className="bg-mint-500">
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-lg">
                    {t.student_name}
                  </th>
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                    {t.student_dob}
                  </th>
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                    {t.student_gender}
                  </th>
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                    {t.student_class}
                  </th>
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-lg">
                    {t.guardians || 'Guardians'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => (
                  <tr key={student.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-2 px-4">
                      <div className="font-medium text-ds-tiny text-ds-text-primary dark:text-slate-100">
                        {getStudentName(student)}
                      </div>
                    </td>
                    <td className="py-2 px-4 text-ds-small text-ds-text-secondary dark:text-slate-400">
                      <span suppressHydrationWarning>
                        {formatDate(student.users?.dob || student.dob)}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-ds-small text-ds-text-secondary dark:text-slate-400">
                      {student.users?.gender || student.gender || '-'}
                    </td>
                    <td className="py-2 px-4 text-ds-small text-ds-text-secondary dark:text-slate-400">
                      {student.classes?.name || '-'}
                    </td>
                    <td className="py-2 px-4 text-ds-small text-ds-text-secondary dark:text-slate-400">
                      {student.guardians && Array.isArray(student.guardians) && student.guardians.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {student.guardians.map((guardian: GuardianRelation, idx) => {
                            const guardianName = guardian.users
                              ? `${guardian.users.first_name || ''} ${guardian.users.last_name || ''}`.trim()
                              : null;
                            return guardianName ? (
                              <span key={guardian.id || idx} className="text-ds-tiny">
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

              {filteredStudents.length > 0 && (
                <div className="mt-ds-sm mb-ds-sm mr-ds-sm flex items-center justify-end gap-ds-xs">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-ds-xs rounded-ds-md border border-input-stroke bg-input-fill px-3 py-1.5 text-ds-small text-ds-text-primary hover:bg-mint-50 hover:border-mint-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t.prev || 'Prev'}
                  </button>

                  <div className="flex items-center gap-ds-xs">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-ds-small rounded-ds-md transition-colors ${
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
                    className="inline-flex items-center gap-ds-xs rounded-ds-md border border-input-stroke bg-input-fill px-3 py-1.5 text-ds-small text-ds-text-primary hover:bg-mint-50 hover:border-mint-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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

  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const loadTeacherClasses = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;

    try {
      const response = await fetch(`/api/teacher-classes?userId=${userId}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();

      if (response.ok) {
        const classesData = (data.classes || []) as TeacherClass[];
        setTeacherClasses(classesData);
        if (typeof window !== 'undefined') {
          localStorage.setItem('teacher_classes_cache', JSON.stringify(classesData));
        }
      } else {
        setTeacherClasses([]);
      }
    } catch (error) {
      setTeacherClasses([]);
    }
  }, [session?.user?.id]);

  const loadStudents = useCallback(async (showLoading = true) => {
    if (teacherClasses.length === 0) {
      setStudents([]);
      setHasLoadedOnce(true);
      if (showLoading) setLoadingStudents(false);
      return;
    }

    try {
      if (showLoading) setLoadingStudents(true);
      setStudentError(null);

      const classIds = teacherClasses.map(cls => cls.id);
      const timestamp = Date.now();

      const studentPromises = classIds.map(async (classId) => {
        try {
          const response = await fetch(`/api/students?classId=${classId}&t=${timestamp}`, {
            cache: 'no-store',
            credentials: 'include'
          });

          if (!response.ok) {
            if (response.status === 401) {
              return null;
            }
            return null;
          }

          const data = await response.json();
          if (data.students && Array.isArray(data.students)) {
            return data.students.map((student: Student) => {
              const classInfo = teacherClasses.find(cls => cls.id === student.class_id);
              return {
                ...student,
                classes: {
                  id: student.class_id || '',
                  name: classInfo?.name || `Class ${student.class_id?.slice(0, 8)}...`
                }
              };
            });
          }
          return null;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(studentPromises);
      const allStudents = results.flat().filter((student): student is Student => student !== null);

      setStudents(allStudents);
      setHasLoadedOnce(true);

      if (typeof window !== 'undefined') {
        localStorage.setItem('teacher_students_cache', JSON.stringify(allStudents));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load students';
      setStudentError(errorMessage);
      setHasLoadedOnce(true);

      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('teacher_students_cache');
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

    if (typeof window !== 'undefined') {
      try {
        const cachedClasses = localStorage.getItem('teacher_classes_cache');
        const cachedStudents = localStorage.getItem('teacher_students_cache');
        
        if (cachedClasses) {
          const parsed = JSON.parse(cachedClasses);
          if (Array.isArray(parsed)) setTeacherClasses(parsed);
        }
        if (cachedStudents) {
          const parsed = JSON.parse(cachedStudents);
          if (Array.isArray(parsed)) {
            setStudents(parsed);
            setHasLoadedOnce(true);
            setLoadingStudents(false);
          }
        }
      } catch {
        // Ignore cache parsing errors
      }
    }

    loadTeacherClasses();
  }, [session?.user?.id, loadTeacherClasses]);

  useEffect(() => {
    if (teacherClasses.length > 0) {
      loadStudents(false);
    } else if (teacherClasses.length === 0 && hasLoadedOnce) {
      setStudents([]);
      setHasLoadedOnce(true);
    }
  }, [teacherClasses.length, loadStudents, hasLoadedOnce]);

  function TeacherStudentsContent() {
    const { sidebarRef } = useTeacherPageLayout();

    return (
      <>
        <PageHeader
          title={t.students}
          subtitle={t.students_subtitle}
          showMobileMenu={true}
          onMobileMenuClick={() => sidebarRef.current?.open()}
          rightActions={
            <div className="flex items-center gap-ds-xs text-ds-small text-ds-text-secondary dark:text-slate-400">
              <Users className="h-4 w-4" />
              <span>
                {t.tile_students}:{' '}
                <span className="font-medium">{students.length}</span>
              </span>
              <span className="hidden md:inline mx-ds-xs text-slate-300 dark:text-slate-600">•</span>
              <CalendarDays className="hidden md:block h-4 w-4" />
              <span className="hidden md:inline">{t.today_hint}</span>
            </div>
          }
        />

        <StudentsPanel 
          t={t} 
          students={students} 
          loadingStudents={loadingStudents} 
          studentError={studentError} 
          hasLoadedOnce={hasLoadedOnce}
        />
      </>
    );
  }

  return (
    <TeacherPageLayout>
      <TeacherStudentsContent />
    </TeacherPageLayout>
  );
}
