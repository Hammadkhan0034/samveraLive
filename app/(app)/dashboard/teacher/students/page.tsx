'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Search, Edit, Trash2, CalendarDays } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { StudentForm } from '@/app/components/shared/StudentForm';
import type { StudentFormData } from '@/lib/types/students';

// Type definitions
interface TeacherClass {
  id: string;
  name: string;
}

interface GuardianUser {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface Guardian {
  id: string;
  relation: string;
  users?: GuardianUser;
}

interface Student {
  id: string;
  first_name?: string;
  last_name?: string | null;
  dob?: string | null;
  gender?: string;
  class_id?: string | null;
  created_at: string;
  medical_notes_encrypted?: string;
  allergies_encrypted?: string;
  emergency_contact_encrypted?: string;
  users?: {
    first_name?: string;
    last_name?: string;
    dob?: string;
    gender?: string;
  };
  classes?: {
    id: string;
    name: string;
  };
  guardians?: Guardian[];
}

// Translations removed - using centralized translations from @/lib/translations


// Helper function to format date
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  if (typeof window === 'undefined') return '';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return '-';
  }
}

// Helper function to get student name
function getStudentName(student: Student): string {
  const firstName = student.users?.first_name || student.first_name || '';
  const lastName = student.users?.last_name || student.last_name || '';
  return `${firstName} ${lastName}`.trim() || '-';
}

// StudentsPanel Component
function StudentsPanel({
  t,
  students,
  loadingStudents,
  studentError,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  hasLoadedOnce
}: {
  t: typeof enText | typeof isText;
  students: Student[];
  loadingStudents: boolean;
  studentError: string | null;
  onAddStudent: () => void;
  onEditStudent?: (student: Student) => void;
  onDeleteStudent?: (studentId: string) => void;
  hasLoadedOnce?: boolean;
}) {
  // Search and pagination state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 5;

  // Filter students based on search query
  const filteredStudents = React.useMemo(() => {
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

  // Calculate pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-ds-md flex items-center">
        <button
          onClick={onAddStudent}
          className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 px-ds-sm py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Plus className="h-4 w-4" />
          {t.add_student || 'Add Student'}
        </button>
      </div>

      {/* Existing Students Section */}
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
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                    {t.guardians || 'Guardians'}
                  </th>
                  <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-lg">
                    {t.actions || 'Actions'}
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
                          {student.guardians.map((guardian, idx) => {
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
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-ds-xs">
                        <button
                          onClick={() => onEditStudent && onEditStudent(student)}
                          className="inline-flex items-center gap-1 rounded-ds-sm border border-input-stroke bg-input-fill px-2 py-1 text-ds-tiny text-ds-text-primary hover:bg-mint-50 hover:border-mint-200 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                          title={t.edit || 'Edit'}
                        >
                          <Edit className="h-3.5 w-3.5" />
                          {t.edit || 'Edit'}
                        </button>
                        
                        <button
                          onClick={() => onDeleteStudent && onDeleteStudent(student.id)}
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

              {/* Pagination Controls - Always show when there is at least 1 student */}
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
  const router = useRouter();

  // Teacher classes
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Students from assigned classes
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Edit and Delete student states
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);

  // Load teacher classes
  const loadTeacherClasses = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoadingClasses(true);
      const userId = session?.user?.id;

      if (!userId) {
        return;
      }

      // Fetch teacher's assigned classes
      const response = await fetch(`/api/teacher-classes?userId=${userId}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();

      if (response.ok) {
        const classesData = (data.classes || []) as TeacherClass[];
        setTeacherClasses(classesData);

        // Cache the data
        if (typeof window !== 'undefined') {
          localStorage.setItem('teacher_classes_cache', JSON.stringify(classesData));
        }
      } else {
        setTeacherClasses([]);
      }
    } catch (error) {
      setTeacherClasses([]);
    } finally {
      if (showLoading) setLoadingClasses(false);
    }
  }, [session?.user?.id]);

  // Load students from assigned classes
  const loadStudents = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoadingStudents(true);
      setStudentError(null);

      // Get teacher's assigned classes first
      if (teacherClasses.length === 0) {
        setStudents([]);
        setHasLoadedOnce(true);
        return;
      }

      const classIds = teacherClasses.map(cls => cls.id);

      // Load students for each class
      const allStudents: Student[] = [];
      for (const classId of classIds) {
        try {
          const url = `/api/students?classId=${classId}&t=${Date.now()}`;
          
          const response = await fetch(url, { 
            cache: 'no-store',
            credentials: 'include'
          });
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText || `HTTP ${response.status}` };
            }
            
            if (response.status === 401 || errorData.error?.includes('Authentication')) {
              // Skip authentication errors silently
              continue;
            }
            continue;
          }

          const data = await response.json();

          if (data.students && Array.isArray(data.students)) {
            // Enhance students with class names
            const enhancedStudents = (data.students || []).map((student: Student) => {
              const classInfo = teacherClasses.find(cls => cls.id === student.class_id);
              return {
                ...student,
                classes: {
                  id: student.class_id || '',
                  name: classInfo?.name || `Class ${student.class_id?.slice(0, 8)}...`
                }
              };
            });
            allStudents.push(...enhancedStudents);
          }
        } catch (fetchError) {
          // Continue with other classes instead of failing completely
          continue;
        }
      }

      setStudents(allStudents);
      setHasLoadedOnce(true);
      
      // Cache the data
      if (typeof window !== 'undefined') {
        localStorage.setItem('teacher_students_cache', JSON.stringify(allStudents));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load students';
      setStudentError(errorMessage);
      setHasLoadedOnce(true);
      // Don't clear students on error - keep cached data if available
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

  // Create table if needed
  const createTableIfNeeded = useCallback(async () => {
    try {
      await fetch('/api/create-student-requests-table', {
        method: 'POST'
      });
    } catch (error) {
      // Silently fail - table creation is not critical
    }
  }, []);

  // Load data on mount and when dependencies change
  useEffect(() => {
    if (!session?.user?.id) return;

    const loadAllData = async () => {
      // Load cached data first for instant display
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

      // Load fresh data
      await loadTeacherClasses(false);
    };
    
    loadAllData();
  }, [session?.user?.id, loadTeacherClasses]);

  // Load students when teacher classes are loaded
  useEffect(() => {
    if (!session?.user?.id) return;

    if (teacherClasses.length > 0) {
      createTableIfNeeded();
      loadStudents(false);
    } else if (!loadingClasses) {
      loadTeacherClasses(false);
    }
  }, [teacherClasses.length, session?.user?.id, loadingClasses, loadStudents, loadTeacherClasses, createTableIfNeeded]);

  // Map student to StudentFormData
  const mapStudentToFormData = useCallback((student: Student): StudentFormData => {
    const userData = student.users || {};
    return {
      id: student.id,
      first_name: userData.first_name || student.first_name || '',
      last_name: userData.last_name || student.last_name || '',
      dob: userData.dob || student.dob || '',
      gender: (userData.gender || student.gender || 'unknown').toLowerCase(),
      class_id: student.class_id || '',
      medical_notes: student.medical_notes_encrypted || '',
      allergies: student.allergies_encrypted || '',
      emergency_contact: student.emergency_contact_encrypted || '',
      guardian_ids: [],
      phone: '',
      address: '',
      registration_time: '',
      start_date: '',
      barngildi: 0,
      student_language: 'english',
      social_security_number: ''
    };
  }, []);

  // Edit and Delete handlers
  const openEditStudentModal = useCallback((student: Student) => {
    setEditingStudent(student);
    setUpdateError(null);
    setIsEditStudentModalOpen(true);
  }, []);

  const handleUpdateStudent = useCallback(async (formData: StudentFormData) => {
    if (!editingStudent) return;

    try {
      setUpdatingStudent(true);
      setUpdateError(null);

      const response = await fetch(`/api/students`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStudent.id,
          ...formData
        })
      });

      const data = await response.json();

      if (response.ok) {
        setIsEditStudentModalOpen(false);
        setEditingStudent(null);
        loadStudents(false);
      } else {
        setUpdateError(data.error || 'Failed to update student');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update student';
      setUpdateError(errorMessage);
    } finally {
      setUpdatingStudent(false);
    }
  }, [editingStudent, loadStudents]);

  const openDeleteConfirm = useCallback((studentId: string) => {
    setDeletingStudentId(studentId);
    setDeleteError(null);
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleDeleteStudent = useCallback(async () => {
    if (!deletingStudentId) return;

    try {
      setDeletingStudent(true);
      setDeleteError(null);
      
      // Optimistically remove student from UI
      setStudents(prev => prev.filter(s => s.id !== deletingStudentId));
      
      const response = await fetch(`/api/students?id=${deletingStudentId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        setIsDeleteConfirmOpen(false);
        setDeletingStudentId(null);
        loadStudents(false);
      } else {
        // Revert optimistic update on error
        loadStudents(false);
        setDeleteError(data.error || 'Failed to delete student');
      }
    } catch (error) {
      // Revert optimistic update on error
      loadStudents(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete student';
      setDeleteError(errorMessage);
    } finally {
      setDeletingStudent(false);
    }
  }, [deletingStudentId, loadStudents]);


  const { sidebarRef } = useTeacherPageLayout();

  return (
    <TeacherPageLayout>
      <PageHeader
        title={t.students}
        subtitle={t.students_subtitle}
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
        rightActions={
          <>
            {/* Desktop stats */}
            <div className="hidden md:flex items-center gap-ds-xs text-ds-small text-ds-text-secondary dark:text-slate-400">
              <Users className="h-4 w-4" />
              <span>
                {t.tile_students}:{' '}
                <span className="font-medium">{students.length}</span>
              </span>
              <span className="mx-ds-xs text-slate-300 dark:text-slate-600">•</span>
              <CalendarDays className="h-4 w-4" />
              <span>{t.today_hint}</span>
            </div>
            {/* Mobile stats */}
            <div className="md:hidden flex items-center gap-ds-xs text-ds-small text-ds-text-secondary dark:text-slate-400">
              <Users className="h-4 w-4" />
              <span>
                {t.tile_students}:{' '}
                <span className="font-medium">{students.length}</span>
              </span>
            </div>
          </>
        }
      />

      {/* Students Panel */}
      <StudentsPanel 
        t={t} 
        students={students} 
        loadingStudents={loadingStudents} 
        studentError={studentError} 
        onAddStudent={() => router.push('/dashboard/add-student')} 
        onEditStudent={openEditStudentModal} 
        onDeleteStudent={openDeleteConfirm} 
        hasLoadedOnce={hasLoadedOnce}
      />

      {/* Edit Student Modal */}
      {isEditStudentModalOpen && editingStudent && (
        <StudentForm
          isOpen={isEditStudentModalOpen}
          onClose={() => {
            setIsEditStudentModalOpen(false);
            setEditingStudent(null);
            setUpdateError(null);
          }}
          onSubmit={handleUpdateStudent}
          initialData={mapStudentToFormData(editingStudent)}
          loading={updatingStudent}
          error={updateError}
          guardians={[]}
          classes={teacherClasses}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setDeletingStudentId(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteStudent}
        title={t.delete_student || 'Delete Student'}
        message={t.delete_student_confirm || 'Are you sure you want to delete this student? This action cannot be undone.'}
        loading={deletingStudent}
        confirmButtonText={t.delete || 'Delete'}
        cancelButtonText={t.cancel}
      />
      
      {/* Delete Error Display */}
      {deleteError && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 shadow-lg">
          {deleteError}
        </div>
      )}
    </TeacherPageLayout>
  );
}


