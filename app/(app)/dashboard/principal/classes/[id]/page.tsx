'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRouter, useParams } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { ArrowLeft, Trash2, AlertTriangle, X, UserPlus, Users, Search, CheckCircle2, Check } from 'lucide-react';
import Loading from '@/app/components/shared/Loading';

type Lang = 'is' | 'en';

export default function ClassDetailsPage() {
  const { t } = useLanguage();
  const { user, loading } = useRequireAuth('principal');
  const { session } = useAuth?.() || {} as any;
  const router = useRouter();
  const params = useParams();
  const classId = params?.id as string;

  const [classData, setClassData] = useState<any>(() => {
    if (typeof window !== 'undefined' && classId) {
      try {
        const cached = sessionStorage.getItem(`class_details_${classId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing cached class data:', e);
      }
    }
    return null;
  });
  const [assignedTeachers, setAssignedTeachers] = useState<any[]>(() => {
    if (typeof window !== 'undefined' && classId) {
      try {
        const cached = sessionStorage.getItem(`class_details_${classId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return parsed.assigned_teachers || [];
        }
      } catch (e) {
        console.error('Error parsing cached teachers:', e);
      }
    }
    return [];
  });
  const [assignedStudents, setAssignedStudents] = useState<any[]>(() => {
    if (typeof window !== 'undefined' && classId) {
      try {
        const cached = sessionStorage.getItem(`class_students_${classId}`);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (e) {
        console.error('Error parsing cached students:', e);
      }
    }
    return [];
  });
  const [error, setError] = useState<string | null>(null);
  const [showDeleteTeacherModal, setShowDeleteTeacherModal] = useState(false);
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<any>(null);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [deletingTeacher, setDeletingTeacher] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isAssignTeacherModalOpen, setIsAssignTeacherModalOpen] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState(false);
  const [assigningTeacher, setAssigningTeacher] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);

  // Get org_id
  const userMetadata = session?.user?.user_metadata || user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const [dbOrgId, setDbOrgId] = useState<string | null>(null);
  const finalOrgId = dbOrgId || orgId;

  useEffect(() => {
    if (session?.user?.id && !orgId) {
      fetch(`/api/users/${session.user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.user?.org_id) {
            setDbOrgId(data.user.org_id);
          }
        })
        .catch(console.error);
    }
  }, [session?.user?.id, orgId]);

  useEffect(() => {
    if (classId && finalOrgId) {
      loadClassDetails();
    }
  }, [classId, finalOrgId]);

  async function loadClassDetails() {
    if (!classId || !finalOrgId) return;
    
    try {
      setError(null);

      // Load class data and students in parallel for faster loading
      const [classResponse, studentsResponse] = await Promise.all([
        fetch(`/api/classes?orgId=${finalOrgId}&t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/students?orgId=${finalOrgId}&t=${Date.now()}`, { cache: 'no-store' })
      ]);

      const classData = await classResponse.json();
      const classItem = classData.classes?.find((c: any) => c.id === classId);
      
      if (!classItem) {
        setError('Class not found');
        return;
      }

      const studentsData = await studentsResponse.json();
      const classStudents = studentsData.students?.filter((s: any) => s.class_id === classId) || [];

      // Update all state at once for immediate rendering
      setClassData(classItem);
      setAssignedTeachers(classItem.assigned_teachers || []);
      setAssignedStudents(classStudents);
      
      // Cache data for instant display on refresh
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`class_details_${classId}`, JSON.stringify(classItem));
        sessionStorage.setItem(`class_students_${classId}`, JSON.stringify(classStudents));
      }
    } catch (err: any) {
      console.error('Error loading class details:', err);
      setError(err.message || 'Failed to load class details');
    }
  }

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
    if (!teacherToDelete || !classId || !finalOrgId) return;
    
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
    if (!studentToDelete || !classId || !finalOrgId) return;
    
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
          dob: dob,
          gender: gender,
          class_id: null,
          org_id: finalOrgId,
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

  function openAddStudentModal() {
    setStudentSearchQuery('');
    setSelectedStudentIds(new Set());
    setAssignmentError(null);
    setAssignmentSuccess(null);
    setIsAddStudentModalOpen(true);
    loadAvailableStudents();
  }

  function openAssignTeacherModal() {
    setTeacherSearchQuery('');
    setSelectedTeacherIds(new Set());
    setAssignmentError(null);
    setAssignmentSuccess(null);
    setIsAssignTeacherModalOpen(true);
    loadAvailableTeachers();
  }

  async function loadAvailableStudents() {
    if (!classId || !finalOrgId) return;
    try {
      setLoadingStudents(true);
      const response = await fetch(`/api/students?orgId=${finalOrgId}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      const students = (data.students || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name || s.users?.first_name || '',
        last_name: s.last_name || s.users?.last_name || '',
        full_name: `${s.first_name || s.users?.first_name || ''} ${s.last_name || s.users?.last_name || ''}`.trim(),
        email: s.email || s.users?.email || null,
        current_class_id: s.class_id,
        current_class_name: s.class_name || null,
      }));
      setAvailableStudents(students);
    } catch (err: any) {
      console.error('Error loading students:', err);
      setAssignmentError(err.message || 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  }

  async function loadAvailableTeachers() {
    if (!classId || !finalOrgId) return;
    try {
      setLoadingTeachers(true);
      const response = await fetch(`/api/staff-management?orgId=${finalOrgId}&role=teacher&t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      const teachers = (data.staff || []).map((t: any) => ({
        id: t.id || t.user_id,
        first_name: t.first_name || '',
        last_name: t.last_name || '',
        full_name: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
        email: t.email || '',
        is_assigned: assignedTeachers.some(at => (at.id || at.user_id) === (t.id || t.user_id)),
      }));
      setAvailableTeachers(teachers);
      
      // Pre-select already assigned teachers
      const assignedIds = new Set(assignedTeachers.map(t => t.id || t.user_id).filter(Boolean));
      setSelectedTeacherIds(assignedIds);
    } catch (err: any) {
      console.error('Error loading teachers:', err);
      setAssignmentError(err.message || 'Failed to load teachers');
    } finally {
      setLoadingTeachers(false);
    }
  }

  function toggleStudentSelection(studentId: string) {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }

  function toggleTeacherSelection(teacherId: string) {
    setSelectedTeacherIds(prev => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  }

  async function assignSelectedStudents() {
    if (!classId || !finalOrgId || selectedStudentIds.size === 0) return;
    
    try {
      setAssigningStudent(true);
      setAssignmentError(null);

      const studentIds = Array.from(selectedStudentIds);
      const assignmentPromises = studentIds.map(async (studentId) => {
        const student = availableStudents.find(s => s.id === studentId);
        if (!student) return;

        const response = await fetch('/api/students', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: studentId,
            first_name: student.first_name || '',
            last_name: student.last_name || '',
            class_id: classId,
            org_id: finalOrgId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to assign student ${studentId}`);
        }
      });

      await Promise.allSettled(assignmentPromises);
      await loadClassDetails();
      
      setAssignmentSuccess(`${studentIds.length} ${studentIds.length === 1 ? t.student_assigned_success : t.students_assigned_success}`);
      setSelectedStudentIds(new Set());
      
      setTimeout(() => {
        setIsAddStudentModalOpen(false);
        setAssignmentSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('Error assigning students:', err);
      setAssignmentError(err.message || 'Failed to assign students');
    } finally {
      setAssigningStudent(false);
    }
  }

  async function saveTeacherAssignments() {
    if (!classId || !finalOrgId) return;
    
    try {
      setAssigningTeacher(true);
      setAssignmentError(null);

      const currentAssignedIds = new Set(assignedTeachers.map(t => t.id || t.user_id).filter(Boolean));
      const newSelectedIds = new Set(Array.from(selectedTeacherIds).filter(Boolean));

      // Find teachers to add
      const toAdd = Array.from(newSelectedIds).filter(id => !currentAssignedIds.has(id));
      // Find teachers to remove
      const toRemove = Array.from(currentAssignedIds).filter(id => !newSelectedIds.has(id));

      // Add teachers
      for (const teacherId of toAdd) {
        const response = await fetch('/api/assign-teacher-class', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: teacherId, classId }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to assign teacher');
        }
      }

      // Remove teachers
      for (const teacherId of toRemove) {
        const response = await fetch('/api/remove-teacher-class', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: teacherId, classId }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to remove teacher');
        }
      }

      await loadClassDetails();
      
      setAssignmentSuccess(t.teachers_updated_success);
      
      setTimeout(() => {
        setIsAssignTeacherModalOpen(false);
        setSelectedTeacherIds(new Set());
        setAssignmentSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('Error updating teachers:', err);
      setAssignmentError(err.message || 'Failed to update teachers');
    } finally {
      setAssigningTeacher(false);
    }
  }

  if (loading && !user) {
    return <Loading fullScreen />;
  }

  if (!user) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 mt-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-red-700 dark:text-red-400">{error || 'Class not found'}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 mt-14 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {t.class_details || 'Class Details'} {classData ? `- ${classData.name}` : ''}
              </h1>
            </div>
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
            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="p-4">
                <div className="mb-3">
                  <button
                    onClick={openAssignTeacherModal}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    <Users className="h-3.5 w-3.5" />
                    {t.assign_teacher || 'Assign Teacher'}
                  </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.no_staff_assigned || 'No staff assigned to this class.'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Students Assigned Table */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-medium text-slate-900 dark:text-slate-100">
            {t.assigned_students || 'Assigned Students'}
          </h2>
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
            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="p-4">
                <div className="mb-3">
                  <button
                    onClick={openAddStudentModal}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t.add_student || 'Add Student'}
                  </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.no_students_assigned || 'No students assigned to this class.'}</p>
              </div>
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

       

      
      </main>
    </div>
  );
}

// Translations removed - using centralized translations from @/lib/translations

