'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Menu, Plus, Eye, CircleCheck as CheckCircle2, Edit, UserPlus, Users, X, Trash2 } from 'lucide-react';

import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import Loading from '@/app/components/shared/Loading';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/hooks/useAuth';

import { AddStudentModal } from '@/app/components/principal/classes/AddStudentModal';
import { AssignTeacherModal } from '@/app/components/principal/classes/AssignTeacherModal';
import { DeleteClassModal } from '@/app/components/principal/classes/DeleteClassModal';
import { StudentReassignConfirmModal, type StudentToAssign } from '@/app/components/principal/classes/StudentReassignConfirmModal';
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
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isAssignTeacherModalOpen, setIsAssignTeacherModalOpen] = useState(false);
  const [classForAssignment, setClassForAssignment] = useState<ClassSummary | null>(null);
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<AvailableTeacher[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState(false);
  const [assigningTeacher, setAssigningTeacher] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [studentToAssign, setStudentToAssign] = useState<StudentToAssign | null>(null);
  const [showStudentConfirmModal, setShowStudentConfirmModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [initialTeacherIds, setInitialTeacherIds] = useState<string[]>([]);
  const selectedTeacherIdsRef = useRef<string[]>([]);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [showDeleteClassModal, setShowDeleteClassModal] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassSummary | null>(null);
  const [deletingClass, setDeletingClass] = useState(false);
  const [classes, setClasses] = useState<ClassSummary[]>(() => {
    if (typeof window !== 'undefined' && session?.user?.id) {
      const cached = localStorage.getItem(`classes_cache_${session.user.id}`);
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
    if (typeof window !== 'undefined' && session?.user?.id) {
      const userId = session.user.id;
      const cachedClasses = localStorage.getItem(`classes_cache_${userId}`);
      const cachedClassStudentCounts = localStorage.getItem(`class_student_counts_cache_${userId}`);
      
      if (cachedClasses) setClasses(JSON.parse(cachedClasses));
      if (cachedClassStudentCounts) setClassStudentCounts(JSON.parse(cachedClassStudentCounts));
    }
  }, [session?.user?.id]);

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
            if (typeof window !== 'undefined' && session?.user?.id) {
              localStorage.setItem(`classes_cache_${session.user.id}`, JSON.stringify(normalized));
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

        if (typeof window !== 'undefined' && session?.user?.id) {
          localStorage.setItem(
            `class_student_counts_cache_${session.user.id}`,
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

  const loadAvailableStudents = useCallback(
    async (classId: string) => {
      try {
        setLoadingStudents(true);
        const response = await fetch(`/api/students?t=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();
        if (response.ok && data.students) {
          const allStudents: AvailableStudent[] = data.students
            .filter((s: any) => s.class_id !== classId)
            .map((s: any) => {
              const currentClass = classes.find((c) => c.id === s.class_id);
              return {
                id: s.id,
                first_name: s.first_name || s.users?.first_name || '',
                last_name: s.last_name || s.users?.last_name || null,
                full_name: `${s.first_name || s.users?.first_name || ''} ${
                  s.last_name || s.users?.last_name || ''
                }`.trim(),
                current_class_id: s.class_id || null,
                current_class_name: currentClass?.name || null,
                email: s.users?.email || null,
                phone: s.phone || s.users?.phone || null,
              };
            });
          setAvailableStudents(allStudents);
          setSelectedStudentIds(new Set());
        }
      } catch (err: any) {
        console.error('Error loading students:', err);
        setAssignmentError(err.message || 'Failed to load students');
      } finally {
        setLoadingStudents(false);
      }
    },
    [classes],
  );

  const loadAvailableTeachers = useCallback(
    async (classId: string) => {
      try {
        setLoadingTeachers(true);
        const response = await fetch(`/api/staff-management`, { cache: 'no-store' });
        const data = await response.json();
        if (response.ok && data.staff) {
          const classData = classes.find((c) => c.id === classId);
          const assignedTeacherIds = new Set(
            (classData?.assigned_teachers || []).map((t: any) => t.id || t.user_id),
          );

          const allTeachers: AvailableTeacher[] = data.staff.map((s: any) => {
            const teacherId = s.id || s.user_id;
            const firstName = s.first_name || '';
            const lastName = s.last_name || null;
            const fullName = `${firstName} ${lastName || ''}`.trim() || s.email || 'Unknown';
            return {
              id: teacherId,
              first_name: firstName,
              last_name: lastName,
              email: s.email || '',
              full_name: fullName,
              is_assigned: assignedTeacherIds.has(teacherId),
            };
          });
          setAvailableTeachers(allTeachers);
          setSelectedTeacherIds(new Set());
        }
      } catch (err: any) {
        console.error('Error loading teachers:', err);
        setAssignmentError(err.message || 'Failed to load teachers');
      } finally {
        setLoadingTeachers(false);
      }
    },
    [classes],
  );

  const openAddStudentModal = useCallback(
    (cls: ClassSummary) => {
    setClassForAssignment(cls);
    setStudentSearchQuery('');
    setSelectedStudentIds(new Set());
    setIsAddStudentModalOpen(true);
    loadAvailableStudents(cls.id);
    },
    [loadAvailableStudents],
  );

  const openAssignTeacherModal = useCallback(
    (cls: ClassSummary) => {
      setClassForAssignment(cls);
      setTeacherSearchQuery('');
      setIsAssignTeacherModalOpen(true);

      if (cls.assigned_teachers && Array.isArray(cls.assigned_teachers)) {
        const teacherIds = cls.assigned_teachers
          .map((teacher: any) => teacher.id || teacher.user_id)
          .filter(Boolean);
        setInitialTeacherIds(teacherIds);
        setSelectedTeacherIds(new Set(teacherIds));
        selectedTeacherIdsRef.current = teacherIds;
      } else {
        setInitialTeacherIds([]);
        setSelectedTeacherIds(new Set());
        selectedTeacherIdsRef.current = [];
      }

      loadAvailableTeachers(cls.id);
    },
    [loadAvailableTeachers],
  );

  const toggleStudentSelection = useCallback((studentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  async function assignSelectedStudents() {
    if (!classForAssignment || selectedStudentIds.size === 0) return;
    
    // Check if any students are already assigned to another class
    const studentsToReassign = Array.from(selectedStudentIds)
      .map(id => availableStudents.find(s => s.id === id))
      .filter(s => s && s.current_class_id && s.current_class_id !== classForAssignment.id);
    
    if (studentsToReassign.length > 0) {
      // Show confirmation for reassignment
      const firstStudent = studentsToReassign[0];
      if (firstStudent) {
        setStudentToAssign({
          id: firstStudent.id,
          name: `${studentsToReassign.length} ${studentsToReassign.length === 1 ? t.student_selected : t.students_selected}`,
          currentClass: firstStudent.current_class_name
        });
        setShowStudentConfirmModal(true);
        return;
      }
    }
    
    // Proceed with assignment
    await performMultipleStudentAssignment(Array.from(selectedStudentIds));
  }

  async function performMultipleStudentAssignment(studentIds: string[]) {
    if (!classForAssignment || studentIds.length === 0) return;
    
    try {
      setAssigningStudent(true);
      setAssignmentError(null);
      
      // Get all student data
      const studentResponse = await fetch(`/api/students?t=${Date.now()}`, { cache: 'no-store' });
      const studentData = await studentResponse.json();
      
      if (!studentData.students) {
        throw new Error('Failed to load student data');
      }

      // Assign all selected students
      const assignmentPromises = studentIds.map(async (studentId) => {
        const student = studentData.students?.find((s: any) => s.id === studentId);
        if (!student) {
          console.warn(`Student ${studentId} not found`);
          return;
        }

        // Skip if already in this class
        if (student.class_id === classForAssignment.id) {
          console.warn(`Student ${studentId} already in class ${classForAssignment.id}`);
          return;
        }

        const updateResponse = await fetch('/api/students', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: studentId,
            first_name: student.first_name || student.users?.first_name || '',
            last_name: student.last_name || student.users?.last_name || '',
            dob: student.users?.dob || student.dob || '',
            gender: student.users?.gender || student.gender || 'unknown',
            class_id: classForAssignment.id,
            phone: student.phone || '',
            address: student.address || '',
            registration_time: student.registration_time || '',
            start_date: student.start_date || '',
            barngildi: student.barngildi || 0,
            student_language: student.language || 'english',
            social_security_number: student.social_security_number || '',
            medical_notes: student.medical_notes || '',
            allergies: student.allergies || '',
            emergency_contact: student.emergency_contact || '',
            guardian_ids: student.guardians?.map((g: any) => g.id) || []
          }),
        });

        const updateData = await updateResponse.json();
        if (!updateResponse.ok) {
          throw new Error(updateData.error || `Failed to assign student ${studentId}`);
        }
      });

      await Promise.allSettled(assignmentPromises);

      // Refresh classes and student counts
      await loadClasses(false);
      await loadStudentsForCounts(false);
      
      // Show success message in modal
      setAssignmentSuccess(`${studentIds.length} ${studentIds.length === 1 ? t.student_assigned_success : t.students_assigned_success}`);
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setIsAddStudentModalOpen(false);
        setClassForAssignment(null);
        setShowStudentConfirmModal(false);
        setStudentToAssign(null);
        setSelectedStudentIds(new Set());
        setAssignmentSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('Error assigning students:', err);
      setAssignmentError(err.message || 'Failed to assign students');
    } finally {
      setAssigningStudent(false);
    }
  }

  async function performStudentAssignment(studentId: string) {
    if (!classForAssignment) return;
    try {
      setAssigningStudent(true);
      setAssignmentError(null);
      
      // Get student data first
      const studentResponse = await fetch(`/api/students?t=${Date.now()}`, { cache: 'no-store' });
      const studentData = await studentResponse.json();
      const student = studentData.students?.find((s: any) => s.id === studentId);
      
      if (!student) {
        throw new Error('Student not found');
      }

      // Update student with class_id
      const updateResponse = await fetch('/api/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: studentId,
            first_name: student.first_name || student.users?.first_name || '',
            last_name: student.last_name || student.users?.last_name || '',
            dob: student.users?.dob || student.dob || '',
            gender: student.users?.gender || student.gender || 'unknown',
            class_id: classForAssignment.id,
          phone: student.phone || '',
          address: student.address || '',
          registration_time: student.registration_time || '',
          start_date: student.start_date || '',
          barngildi: student.barngildi || 0,
          student_language: student.language || 'english',
          social_security_number: student.social_security_number || '',
          medical_notes: student.medical_notes || '',
          allergies: student.allergies || '',
          emergency_contact: student.emergency_contact || '',
          guardian_ids: student.guardians?.map((g: any) => g.id) || []
        }),
      });

      const updateData = await updateResponse.json();
      if (!updateResponse.ok) {
        throw new Error(updateData.error || 'Failed to assign student');
      }

      // Refresh classes and student counts
      await loadClasses(false);
      await loadStudentsForCounts(false);
      
      // Show success message in modal
      setAssignmentSuccess(t.student_assigned_success);
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setIsAddStudentModalOpen(false);
        setClassForAssignment(null);
        setShowStudentConfirmModal(false);
        setStudentToAssign(null);
        setSelectedStudentIds(new Set());
        setAssignmentSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('Error assigning student:', err);
      setAssignmentError(err.message || 'Failed to assign student');
    } finally {
      setAssigningStudent(false);
    }
  }

  const toggleTeacherSelection = useCallback((teacherId: string) => {
    setSelectedTeacherIds(prev => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      selectedTeacherIdsRef.current = Array.from(next);
      return next;
    });
  }, []);

  async function saveTeacherAssignments() {
    if (!classForAssignment) return;
    
    const teacherIds = Array.from(selectedTeacherIds);
    
    // Get current assigned teachers
    const currentAssignedIds = new Set(
      (classForAssignment.assigned_teachers || []).map((t: any) => t.id || t.user_id).filter(Boolean)
    );
    const newSelectedIds = new Set(teacherIds);
    
    // Find teachers to add (in newSelectedIds but not in currentAssignedIds)
    const toAdd = teacherIds.filter((id: string) => !currentAssignedIds.has(id));
    
    // Find teachers to remove (in currentAssignedIds but not in newSelectedIds)
    const toRemove = Array.from(currentAssignedIds).filter((id: unknown): id is string => typeof id === 'string' && !newSelectedIds.has(id));
    
    // If no changes, just close the modal
    if (toAdd.length === 0 && toRemove.length === 0) {
      setIsAssignTeacherModalOpen(false);
      setClassForAssignment(null);
      setAssignmentError(null);
      setInitialTeacherIds([]);
      selectedTeacherIdsRef.current = [];
      return;
    }
    
    try {
      setAssigningTeacher(true);
      setAssignmentError(null);
      
      // Assign new teachers
      const assignPromises = toAdd.map(async (teacherId) => {
        const response = await fetch('/api/assign-teacher-class', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: teacherId,
            classId: classForAssignment.id,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to assign teacher ${teacherId}`);
        }
      });
      
      // Remove teachers
      const removePromises = toRemove.map(async (teacherId) => {
        const response = await fetch('/api/remove-teacher-class', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: teacherId,
            classId: classForAssignment.id,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to remove teacher ${teacherId}`);
        }
      });
      
      await Promise.allSettled([...assignPromises, ...removePromises]);
      
      // Refresh classes
      await loadClasses(false);
      
      // Update classForAssignment with new teacher data
      if (classForAssignment) {
        const updatedClass = classes.find(c => c.id === classForAssignment.id);
        if (updatedClass) {
          setClassForAssignment(updatedClass);
          // Update initial teacher IDs for the modal
          if (updatedClass.assigned_teachers && Array.isArray(updatedClass.assigned_teachers)) {
            const teacherIds = updatedClass.assigned_teachers.map((t: any) => t.id || t.user_id).filter(Boolean);
            setInitialTeacherIds(teacherIds);
          }
        }
      }
      
      // Show success message in modal
      setAssignmentSuccess(t.teachers_updated_success);
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setIsAssignTeacherModalOpen(false);
        setClassForAssignment(null);
        setAssignmentError(null);
        setInitialTeacherIds([]);
        setSelectedTeacherIds(new Set());
        selectedTeacherIdsRef.current = [];
        setAssignmentSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('Error updating teachers:', err);
      setAssignmentError(err.message || 'Failed to update teachers');
    } finally {
      setAssigningTeacher(false);
    }
  }


  async function handleDeleteClass() {
    if (!classToDelete) return;
    
    try {
      setDeletingClass(true);
      setAssignmentError(null);

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
      
      // Show success message
      setAssignmentSuccess(t.class_deleted_success || 'Class deleted successfully');
      setTimeout(() => {
        setAssignmentSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('Error deleting class:', err);
      setAssignmentError(err.message || 'Failed to delete class');
    } finally {
      setDeletingClass(false);
    }
  }

  // Memoize filtered students and teachers for performance
  const filteredStudents = useMemo(() => 
    availableStudents.filter(s => 
      s.full_name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(studentSearchQuery.toLowerCase()))
    ), [availableStudents, studentSearchQuery]);

  const filteredTeachers = useMemo(() => 
    availableTeachers.filter(t => 
      t.full_name.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
    ), [availableTeachers, teacherSearchQuery]);

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
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.departments}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.overview_hint}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ProfileSwitcher />
          <button
            onClick={() => router.push('/dashboard/principal/classes/create')}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Plus className="h-4 w-4" /> {t.add_class}
          </button>
        </div>
      </div>

        {/* Departments table */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.departments}</h2>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {t.overview_hint}
            </div>
          </div>
          <div className="overflow-x-auto overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-black">
                  <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300 rounded-tl-xl">
                    {t.col_name}
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                    {t.col_students}
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                    {t.col_staff}
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                    {t.col_visible}
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300 rounded-tr-xl">
                    {t.col_actions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <tr key={cls.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="text-left py-2 px-4 text-sm font-medium text-slate-900 dark:text-slate-100">{cls.name}</td>
                    <td className="text-left py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                      {classStudentCounts[cls.id] || 0}
                    </td>
                    <td className="text-left py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                      {cls.assigned_teachers?.length || 0}
                    </td>
                    <td className="text-left py-2 px-4 text-sm">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300'
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t.visible_yes}
                      </span>
                    </td>
                    <td className="text-left py-2 px-4 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => openClassDetailsModal(cls)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t.show}
                        </button>
                        <button
                          onClick={() => openEditClass(cls)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          {t.edit}
                        </button>
                        <button
                          onClick={() => openDeleteClassModal(cls)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t.delete}
                        </button>
                        <button
                          onClick={() => openAddStudentModal(cls)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          {t.add_student}
                        </button>
                        <button
                          onClick={() => openAssignTeacherModal(cls)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          <Users className="h-3.5 w-3.5" />
                          {t.assign_teacher}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {classes.length === 0 && (
                  <tr>
                    <td className="text-center py-4 px-4 text-sm text-slate-600 dark:text-slate-400" colSpan={5}>
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
          <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
            <div className="flex items-center justify-between">
              <span>
                <strong>{successClassName}</strong> {t.class_created_message}
              </span>
              <button
                onClick={() => {
                  setShowSuccessMessage(false);
                  setSuccessClassName('');
                }}
                className="ml-4 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <AddStudentModal
          isOpen={isAddStudentModalOpen && !!classForAssignment}
          className={classForAssignment?.name ?? ''}
          t={t as unknown as TranslationStrings}
          assignmentError={assignmentError}
          assignmentSuccess={assignmentSuccess}
          studentSearchQuery={studentSearchQuery}
          onStudentSearchChange={setStudentSearchQuery}
          loadingStudents={loadingStudents}
          filteredStudents={filteredStudents}
          selectedStudentIds={selectedStudentIds}
          assigningStudent={assigningStudent}
          onToggleStudentSelection={toggleStudentSelection}
          onAssignSelectedStudents={assignSelectedStudents}
          onClose={() => {
            setIsAddStudentModalOpen(false);
            setClassForAssignment(null);
            setAssignmentError(null);
            setAssignmentSuccess(null);
            setSelectedStudentIds(new Set());
            setStudentSearchQuery('');
          }}
        />

        <AssignTeacherModal
          isOpen={isAssignTeacherModalOpen && !!classForAssignment}
          className={classForAssignment?.name ?? ''}
          t={t as unknown as TranslationStrings}
          assignmentError={assignmentError}
          teacherSearchQuery={teacherSearchQuery}
          onTeacherSearchChange={setTeacherSearchQuery}
          loadingTeachers={loadingTeachers}
          filteredTeachers={filteredTeachers}
          selectedTeacherIds={selectedTeacherIds}
          assigningTeacher={assigningTeacher}
          onToggleTeacherSelection={toggleTeacherSelection}
          onSaveTeacherAssignments={saveTeacherAssignments}
          onClose={() => {
            setIsAssignTeacherModalOpen(false);
            setClassForAssignment(null);
            setAssignmentError(null);
            setAssignmentSuccess(null);
            setInitialTeacherIds([]);
            setSelectedTeacherIds(new Set());
            selectedTeacherIdsRef.current = [];
          }}
        />

        <DeleteClassModal
          isOpen={showDeleteClassModal && !!classToDelete}
          t={t as unknown as TranslationStrings}
          className={classToDelete?.name ?? ''}
          assignmentError={assignmentError}
          deletingClass={deletingClass}
          onCancel={() => {
            setShowDeleteClassModal(false);
            setClassToDelete(null);
            setAssignmentError(null);
          }}
          onConfirm={handleDeleteClass}
        />

        <StudentReassignConfirmModal
          isOpen={showStudentConfirmModal && !!studentToAssign && !!classForAssignment}
          t={t as unknown as TranslationStrings}
          studentToAssign={studentToAssign}
          targetClassName={classForAssignment?.name ?? ''}
          assigningStudent={assigningStudent}
          onCancel={() => {
            setShowStudentConfirmModal(false);
            setStudentToAssign(null);
          }}
          onConfirm={() => {
            if (!studentToAssign) return;
            if (selectedStudentIds.size > 0) {
              void performMultipleStudentAssignment(Array.from(selectedStudentIds));
            } else {
              void performStudentAssignment(studentToAssign.id);
            }
          }}
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
