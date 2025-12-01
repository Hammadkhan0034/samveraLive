'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRouter, useParams } from 'next/navigation';
import { Menu, Trash2, AlertTriangle, UserPlus, Users } from 'lucide-react';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { StudentAssignmentModal } from '@/app/components/principal/classes/StudentAssignmentModal';
import { TeacherAssignmentModal } from '@/app/components/principal/classes/TeacherAssignmentModal';
import type { TranslationStrings } from '@/app/components/principal/classes/types';

type Lang = 'is' | 'en';

type ClassDetails = {
  id: string;
  name: string;
  code?: string | null;
  assigned_teachers?: any[];
};

function readCachedJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(key);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch (e) {
    console.error(`Error parsing cached data for key ${key}:`, e);
    return null;
  }
}

function writeCachedJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing cached data for key ${key}:`, e);
  }
}

function ClassDetailsPageContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const classId = params?.id as string | undefined;
  const { sidebarRef } = usePrincipalPageLayout();

  const [classData, setClassData] = useState<ClassDetails | null>(() =>
    classId ? readCachedJson<ClassDetails>(`class_details_${classId}`) : null,
  );
  const [assignedTeachers, setAssignedTeachers] = useState<any[]>(() => {
    if (!classId) return [];
    const cached = readCachedJson<{ assigned_teachers?: any[] }>(`class_details_${classId}`);
    return cached?.assigned_teachers || [];
  });
  const [assignedStudents, setAssignedStudents] = useState<any[]>(() =>
    classId ? readCachedJson<any[]>(`class_students_${classId}`) || [] : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [showDeleteTeacherModal, setShowDeleteTeacherModal] = useState(false);
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<any>(null);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [deletingTeacher, setDeletingTeacher] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadClassDetails = useCallback(async () => {
    if (!classId) return;

    try {
      setError(null);

      // Load class data and students in parallel for faster loading
      const [classResponse, studentsResponse] = await Promise.all([
        fetch(`/api/classes?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/students?t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const classJson = await classResponse.json();
      const classItem = classJson.classes?.find((c: any) => c.id === classId);

      if (!classItem) {
        setError('Class not found');
        return;
      }

      const studentsJson = await studentsResponse.json();
      const classStudents = studentsJson.students?.filter((s: any) => s.class_id === classId) || [];

      // Update all state at once for immediate rendering
      setClassData(classItem);
      setAssignedTeachers(classItem.assigned_teachers || []);
      setAssignedStudents(classStudents);

      // Cache data for instant display on refresh
      writeCachedJson(`class_details_${classId}`, classItem);
      writeCachedJson(`class_students_${classId}`, classStudents);
    } catch (err: any) {
      console.error('Error loading class details:', err);
      setError(err.message || 'Failed to load class details');
    }
  }, [classId]);

  useEffect(() => {
    if (classId) {
      void loadClassDetails();
    }
  }, [classId, loadClassDetails]);

  function openDeleteTeacherModal(teacher: any) {
    setTeacherToDelete(teacher);
    setShowDeleteTeacherModal(true);
    setDeleteError(null);
  }

  function openDeleteStudentModal(student: any) {
    setStudentToDelete(student);
    setShowDeleteStudentModal(true);
    setDeleteError(null);
  }

  async function handleDeleteTeacher() {
    if (!teacherToDelete || !classId) return;
    
    try {
      setDeletingTeacher(true);
      setDeleteError(null);

      const teacherId = teacherToDelete.id || teacherToDelete.user_id;
      const response = await fetch('/api/remove-teacher-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: teacherId,
          classId: classId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove teacher from class');
      }

      // Update state directly without reloading
      setAssignedTeachers(prev => prev.filter(t => (t.id || t.user_id) !== teacherId));
      if (classData) {
        setClassData({
          ...classData,
          assigned_teachers: classData.assigned_teachers?.filter((t: any) => (t.id || t.user_id) !== teacherId) || []
        });
      }
      
      // Close modal
      setShowDeleteTeacherModal(false);
      setTeacherToDelete(null);
    } catch (err: any) {
      console.error('Error removing teacher from class:', err);
      setDeleteError(err.message || 'Failed to remove teacher from class');
    } finally {
      setDeletingTeacher(false);
    }
  }

  async function handleDeleteStudent() {
    if (!studentToDelete || !classId) return;
    
    try {
      setDeletingStudent(true);
      setDeleteError(null);

      // Get student data with required fields
      const firstName = studentToDelete.first_name || studentToDelete.users?.first_name || '';
      const lastName = studentToDelete.last_name || studentToDelete.users?.last_name || '';
      const dob = studentToDelete.users?.dob || studentToDelete.dob || '';
      const gender = studentToDelete.users?.gender || studentToDelete.gender || 'unknown';

      // Remove class_id from student
      const response = await fetch('/api/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: studentToDelete.id,
          first_name: firstName,
          last_name: lastName,
          dob,
          gender,
          class_id: null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove student from class');
      }

      // Update state directly without reloading
      setAssignedStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
      
      // Close modal
      setShowDeleteStudentModal(false);
      setStudentToDelete(null);
    } catch (err: any) {
      console.error('Error removing student from class:', err);
      setDeleteError(err.message || 'Failed to remove student from class');
    } finally {
      setDeletingStudent(false);
    }
  }

  function formatDate(dateString: string | Date): string {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return date.toLocaleDateString();
    } catch {
      return '-';
    }
  }


  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-red-700 dark:text-red-400">{error || 'Class not found'}</p>
      </div>
    );
  }

  return (
    <>
      {/* Content Header */}
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
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.class_details || 'Class Details'} {classData ? `- ${classData.name}` : ''}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <ProfileSwitcher />
        </div>
      </div>

        {/* Class Details Table */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-medium text-slate-900 dark:text-slate-100">
            {t.class_details || 'Class Details'}
          </h2>
          {classData ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead className="bg-black text-white">
                  <tr>
                    <th className="px-4 py-2 text-left text-white">{t.col_name || 'Name'}</th>
                    <th className="px-4 py-2 text-left text-white">{t.col_students || 'Students'}</th>
                    <th className="px-4 py-2 text-left text-white">{t.col_staff || 'Staff'}</th>
                    <th className="px-4 py-2 text-left text-white">{t.class_description || 'Description'}</th>
                    <th className="px-4 py-2 text-left text-white">{t.visible_yes || 'Visible'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{classData.name}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{assignedStudents.length}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{assignedTeachers.length}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{classData.code || '-'}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
                        {t.visible_yes || 'Visible'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No class data available.</p>
          )}
        </div>

        {/* Staff Assigned Table */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-medium text-slate-900 dark:text-slate-100">
            {t.assigned_staff || 'Assigned Staff'}
          </h2>
          <div className="mb-3">
            <TeacherAssignmentModal
              classId={classId ?? ''}
              className={classData?.name ?? ''}
              t={t as unknown as TranslationStrings}
              onCompleted={() => {
                void loadClassDetails();
              }}
              trigger={(open) => (
                <button
                  onClick={open}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  <Users className="h-3.5 w-3.5" />
                  {t.assign_teacher || 'Assign Teacher'}
                </button>
              )}
            />
          </div>
          {assignedTeachers.length > 0 || classData ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead className="bg-black text-white">
                  <tr>
                    <th className="px-4 py-2 text-left text-white">{t.first_name || 'First Name'}</th>
                    <th className="px-4 py-2 text-left text-white">{t.last_name || 'Last Name'}</th>
                    <th className="px-4 py-2 text-left text-white">{t.email || 'Email'}</th>
                    <th className="px-4 py-2 text-left text-white">{t.col_actions || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedTeachers.map((teacher: any, index: number) => (
                    <tr key={index} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{teacher.first_name || '-'}</td>
                      <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{teacher.last_name || '-'}</td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{teacher.email || '-'}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => openDeleteTeacherModal(teacher)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          title={t.delete || 'Delete'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t.delete || 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t.no_staff_assigned || 'No staff assigned to this class.'}
            </div>
          )}
        </div>

        {/* Students Assigned Table */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-medium text-slate-900 dark:text-slate-100">
            {t.assigned_students || 'Assigned Students'}
          </h2>
          <div className="mb-3">
            <StudentAssignmentModal
              classId={classId ?? ''}
              className={classData?.name ?? ''}
              t={t as unknown as TranslationStrings}
              onCompleted={() => {
                void loadClassDetails();
              }}
              trigger={(open) => (
                <button
                  onClick={open}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {t.add_student || 'Add Student'}
                </button>
              )}
            />
          </div>
          {assignedStudents.length > 0 || classData ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-black text-white sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-white">{t.first_name || 'First Name'}</th>
                      <th className="px-4 py-2 text-left text-white">{t.last_name || 'Last Name'}</th>
                      <th className="px-4 py-2 text-left text-white">{t.dob || 'Date of Birth'}</th>
                      <th className="px-4 py-2 text-left text-white">{t.gender || 'Gender'}</th>
                      <th className="px-4 py-2 text-left text-white">{t.col_actions || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedStudents.map((student: any) => {
                      const dob = student.users?.dob || student.dob;
                      const gender = student.users?.gender || student.gender;
                      return (
                        <tr key={student.id} className="border-t border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                            {student.first_name || student.users?.first_name || '-'}
                          </td>
                          <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                            {student.last_name || student.users?.last_name || '-'}
                          </td>
                          <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                            {dob ? formatDate(dob) : '-'}
                          </td>
                          <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{gender || '-'}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => openDeleteStudentModal(student)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              title={t.delete || 'Delete'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {t.delete || 'Delete'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t.no_students_assigned || 'No students assigned to this class.'}
            </div>
          )}
        </div>

        {/* Delete Teacher Confirmation Modal */}
        {showDeleteTeacherModal && teacherToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/20">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t.delete_teacher || 'Remove Teacher'}
                </h3>
              </div>
              
              {deleteError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  {deleteError}
                </div>
              )}

              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                {t.delete_teacher_message?.replace('{name}', `${teacherToDelete.first_name || ''} ${teacherToDelete.last_name || ''}`.trim() || 'this teacher') || `Are you sure you want to remove this teacher from the class?`}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteTeacherModal(false);
                    setTeacherToDelete(null);
                    setDeleteError(null);
                  }}
                  disabled={deletingTeacher}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button
                  onClick={handleDeleteTeacher}
                  disabled={deletingTeacher}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deletingTeacher ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      {t.deleting || 'Deleting...'}
                    </>
                  ) : (
                    t.delete || 'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Student Confirmation Modal */}
        {showDeleteStudentModal && studentToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/20">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t.delete_student || 'Remove Student'}
                </h3>
              </div>
              
              {deleteError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  {deleteError}
                </div>
              )}

              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                {t.delete_student_message?.replace('{name}', `${studentToDelete.first_name || studentToDelete.users?.first_name || ''} ${studentToDelete.last_name || studentToDelete.users?.last_name || ''}`.trim() || 'this student') || `Are you sure you want to remove this student from the class?`}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteStudentModal(false);
                    setStudentToDelete(null);
                    setDeleteError(null);
                  }}
                  disabled={deletingStudent}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button
                  onClick={handleDeleteStudent}
                  disabled={deletingStudent}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deletingStudent ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      {t.deleting || 'Deleting...'}
                    </>
                  ) : (
                    t.delete || 'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

export default function ClassDetailsPage() {
  return (
    <PrincipalPageLayout>
      <ClassDetailsPageContent />
    </PrincipalPageLayout>
  );
}

// Translations removed - using centralized translations from @/lib/translations

