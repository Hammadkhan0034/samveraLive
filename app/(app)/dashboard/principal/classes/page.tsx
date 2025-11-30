'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Menu, Plus, X, Eye, CircleCheck as CheckCircle2, Edit, UserPlus, Users, Search, AlertTriangle, Check, Trash2 } from 'lucide-react';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import Loading from '@/app/components/shared/Loading';

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function ClassesPageContent() {
  const { t } = useLanguage();
  const { session } = useAuth?.() || {} as any;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sidebarRef } = usePrincipalPageLayout();

  // Class management states
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isAssignTeacherModalOpen, setIsAssignTeacherModalOpen] = useState(false);
  const [classForAssignment, setClassForAssignment] = useState<any>(null);
  const [availableStudents, setAvailableStudents] = useState<Array<{ id: string; first_name: string; last_name: string | null; full_name: string; current_class_id: string | null; current_class_name: string | null; email: string | null; phone: string | null }>>([]);
  const [availableTeachers, setAvailableTeachers] = useState<Array<{ id: string; first_name: string; last_name: string | null; email: string; full_name: string; is_assigned: boolean }>>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState(false);
  const [assigningTeacher, setAssigningTeacher] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [studentToAssign, setStudentToAssign] = useState<{ id: string; name: string; currentClass: string | null } | null>(null);
  const [showStudentConfirmModal, setShowStudentConfirmModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [initialTeacherIds, setInitialTeacherIds] = useState<string[]>([]);
  const selectedTeacherIdsRef = useRef<string[]>([]);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [showDeleteClassModal, setShowDeleteClassModal] = useState(false);
  const [classToDelete, setClassToDelete] = useState<any>(null);
  const [deletingClass, setDeletingClass] = useState(false);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; code: string | null; assigned_teachers: any[] }>>(() => {
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

  // Load classes and student counts when session is available
  useEffect(() => {
    if (session?.user?.id) {
      Promise.allSettled([
        loadClasses(false),
        loadStudentsForCounts(false)
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

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

  // Load classes data
  async function loadClasses(showLoading = true) {
    try {
      if (showLoading) setLoadingClass(true);
      const response = await fetch(`/api/classes`, { cache: 'no-store' });
      const data = await response.json();

      if (response.ok) {
        const classesData = Array.isArray(data.classes) ? data.classes : null;
        if (classesData) {
          // Normalize to ensure assigned_teachers exists
          const normalized = classesData.map((cls: any) => ({
            ...cls,
            assigned_teachers: Array.isArray(cls.assigned_teachers) ? cls.assigned_teachers : []
          }));
          setClasses(normalized);
          if (typeof window !== 'undefined') {
            if (session?.user?.id) {
              localStorage.setItem(`classes_cache_${session.user.id}`, JSON.stringify(normalized));
            }
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
  }

  // Load student counts per class
  async function loadStudentsForCounts(showLoading = true) {
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
        localStorage.setItem(`class_student_counts_cache_${session.user.id}`, JSON.stringify(counts));
      }
    } catch (e: any) {
      console.error('❌ Error loading student counts:', e.message);
    }
  }

  const openClassDetailsModal = useCallback((cls: any) => {
    router.push(`/dashboard/principal/classes/${cls.id}`);
  }, [router]);

  const openDeleteClassModal = useCallback((cls: any) => {
    setClassToDelete(cls);
    setShowDeleteClassModal(true);
  }, []);

  const openEditClass = useCallback((cls: any) => {
    router.push(`/dashboard/principal/classes/create?id=${encodeURIComponent(cls.id)}`);
  }, [router]);

  const openAddStudentModal = useCallback((cls: any) => {
    setClassForAssignment(cls);
    setStudentSearchQuery('');
    setSelectedStudentIds(new Set());
    setIsAddStudentModalOpen(true);
    loadAvailableStudents(cls.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAssignTeacherModal = useCallback((cls: any) => {
    setClassForAssignment(cls);
    setTeacherSearchQuery('');
    setIsAssignTeacherModalOpen(true);
    
    // Load currently assigned teachers first
    if (cls.assigned_teachers && Array.isArray(cls.assigned_teachers)) {
      const teacherIds = cls.assigned_teachers.map((teacher: any) => teacher.id || teacher.user_id).filter(Boolean);
      setInitialTeacherIds(teacherIds);
      setSelectedTeacherIds(new Set(teacherIds));
      selectedTeacherIdsRef.current = teacherIds;
    } else {
      setInitialTeacherIds([]);
      setSelectedTeacherIds(new Set());
      selectedTeacherIdsRef.current = [];
    }
    
    // Then load all available teachers
    loadAvailableTeachers(cls.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAvailableStudents(classId: string) {
    try {
      setLoadingStudents(true);
      const response = await fetch(`/api/students?t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data.students) {
        // Show all students, but mark which class they're currently in
        // Filter out students already in this class
        const allStudents = data.students
          .filter((s: any) => s.class_id !== classId) // Don't show students already in this class
          .map((s: any) => {
            const currentClass = classes.find(c => c.id === s.class_id);
            return {
              id: s.id,
              first_name: s.first_name || (s.users?.first_name || ''),
              last_name: s.last_name || (s.users?.last_name || null),
              full_name: `${s.first_name || s.users?.first_name || ''} ${s.last_name || s.users?.last_name || ''}`.trim(),
              current_class_id: s.class_id || null,
              current_class_name: currentClass?.name || null,
              email: s.users?.email || null,
              phone: s.phone || s.users?.phone || null
            };
          });
        setAvailableStudents(allStudents);
        setSelectedStudentIds(new Set()); // Reset selection
      }
    } catch (err: any) {
      console.error('Error loading students:', err);
      setAssignmentError(err.message || 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  }

  async function loadAvailableTeachers(classId: string) {
    try {
      setLoadingTeachers(true);
      const response = await fetch(`/api/staff-management`, { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data.staff) {
        // Show all teachers, mark which ones are assigned
        const classData = classes.find(c => c.id === classId);
        const assignedTeacherIds = new Set(
          (classData?.assigned_teachers || []).map((t: any) => t.id || t.user_id)
        );
        
        // Show all teachers with their assignment status
        const allTeachers = data.staff.map((s: any) => {
          const teacherId = s.id || s.user_id;
          return {
            id: teacherId,
            first_name: s.first_name || '',
            last_name: s.last_name || null,
            email: s.email || '',
            full_name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email || 'Unknown',
            is_assigned: assignedTeacherIds.has(teacherId)
          };
        });
        setAvailableTeachers(allTeachers);
        setSelectedTeacherIds(new Set()); // Reset selection
      }
    } catch (err: any) {
      console.error('Error loading teachers:', err);
      setAssignmentError(err.message || 'Failed to load teachers');
    } finally {
      setLoadingTeachers(false);
    }
  }

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

        {/* Add Student Modal */}
        {isAddStudentModalOpen && classForAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-slate-800 max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {t.add_student_to_class} - {classForAssignment.name}
                  </h3>
                  <button
                  onClick={() => {
                    setIsAddStudentModalOpen(false);
                    setClassForAssignment(null);
                    setAssignmentError(null);
                    setAssignmentSuccess(null);
                  }}
                    className="rounded-lg p-1 text-slate-600 dark:text-slate-400"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {assignmentError && (
                  <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                    {assignmentError}
                  </div>
                )}

                {assignmentSuccess && (
                  <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {assignmentSuccess}
                  </div>
                )}

                {/* Search Bar */}
                <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder={t.search_students_placeholder}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  />
                </div>
              </div>

              {loadingStudents ? (
                <div className="py-8 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
                  <p className="text-slate-600 dark:text-slate-400">{t.loading_students}</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                    {t.no_students_available}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredStudents.map((student) => {
                        const isSelected = selectedStudentIds.has(student.id);
                        return (
                          <button
                            key={student.id}
                            onClick={() => toggleStudentSelection(student.id)}
                            disabled={assigningStudent}
                            className={`w-full flex items-center justify-between rounded-lg border p-4 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed ${
                              isSelected
                                ? 'border-black bg-slate-100 dark:border-slate-400 dark:bg-slate-700'
                                : student.current_class_id && student.current_class_id !== classForAssignment.id
                                ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                                isSelected
                                  ? 'border-black bg-black dark:border-slate-300 dark:bg-slate-300'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}>
                                {isSelected && <Check className="h-3 w-3 text-white dark:text-slate-900" />}
                              </div>
                              <div className="text-left flex-1">
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                  {student.full_name}
                                </div>
                                {student.current_class_id && student.current_class_id !== classForAssignment.id && (
                                  <div className="text-xs text-amber-700 dark:text-amber-300 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {t.currently_in_class}: {student.current_class_name}
                                  </div>
                                )}
                                {student.email && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {student.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedStudentIds.size > 0 && (
                      <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {selectedStudentIds.size} {selectedStudentIds.size === 1 ? t.student_selected : t.students_selected}
                          </span>
                          <button
                            onClick={assignSelectedStudents}
                            disabled={assigningStudent}
                            className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm text-white dark:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {assigningStudent ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                {t.assigning}
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4" />
                                {t.assign_selected}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <button
                  onClick={() => {
                    setIsAddStudentModalOpen(false);
                    setClassForAssignment(null);
                    setAssignmentError(null);
                    setAssignmentSuccess(null);
                    setSelectedStudentIds(new Set());
                    setStudentSearchQuery('');
                  }}
                  className="rounded-lg bg-black px-4 py-2 text-sm text-white dark:bg-black"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Teacher Modal */}
        {isAssignTeacherModalOpen && classForAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-slate-800 max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {t.assign_teacher_to_class} - {classForAssignment.name}
                  </h3>
                  <button
                    onClick={() => {
                      setIsAssignTeacherModalOpen(false);
                      setClassForAssignment(null);
                      setAssignmentError(null);
                      setAssignmentSuccess(null);
                      setInitialTeacherIds([]);
                      setSelectedTeacherIds(new Set());
                      selectedTeacherIdsRef.current = [];
                    }}
                    className="rounded-lg p-1 text-slate-600 dark:text-slate-400"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {assignmentError && (
                  <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                    {assignmentError}
                  </div>
                )}

                {/* Search Bar */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={teacherSearchQuery}
                      onChange={(e) => setTeacherSearchQuery(e.target.value)}
                      placeholder={t.search_teachers_placeholder}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                    />
                  </div>
                </div>

                {loadingTeachers ? (
                  <div className="py-8 text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400">{t.loading_teachers}</p>
                  </div>
                ) : filteredTeachers.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                      {t.no_teachers_available}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredTeachers.map((teacher) => {
                          const isSelected = selectedTeacherIds.has(teacher.id);
                          return (
                            <button
                              key={teacher.id}
                              onClick={() => toggleTeacherSelection(teacher.id)}
                              disabled={assigningTeacher}
                              className={`w-full flex items-center justify-between rounded-lg border p-4 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed ${
                                isSelected
                                  ? 'border-black bg-slate-100 dark:border-slate-400 dark:bg-slate-700'
                                  : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                                  isSelected
                                    ? 'border-black bg-black dark:border-slate-300 dark:bg-slate-300'
                                    : 'border-slate-300 dark:border-slate-600'
                                }`}>
                                  {isSelected && <Check className="h-3 w-3 text-white dark:text-slate-900" />}
                                </div>
                                <div className="text-left flex-1">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {teacher.full_name}
                                  </div>
                                  {teacher.email && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                      {teacher.email}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {selectedTeacherIds.size > 0 && (
                        <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {selectedTeacherIds.size} {selectedTeacherIds.size === 1 ? t.teacher_selected || 'teacher selected' : t.teachers_selected || 'teachers selected'}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsAssignTeacherModalOpen(false);
                    setClassForAssignment(null);
                    setAssignmentError(null);
                    setAssignmentSuccess(null);
                    setInitialTeacherIds([]);
                    setSelectedTeacherIds(new Set());
                    selectedTeacherIdsRef.current = [];
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={saveTeacherAssignments}
                  disabled={assigningTeacher}
                  className="rounded-lg bg-black px-4 py-2 text-sm text-white dark:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {assigningTeacher ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      {t.updating_teachers}
                    </>
                  ) : (
                    t.save
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Class Confirmation Modal */}
        {showDeleteClassModal && classToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/20">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t.delete_class || 'Delete Class'}
                </h3>
              </div>
              
              {assignmentError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  {assignmentError}
                </div>
              )}

              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                {t.delete_class_message?.replace('{name}', classToDelete.name) || `Are you sure you want to delete "${classToDelete.name}"? This action cannot be undone.`}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteClassModal(false);
                    setClassToDelete(null);
                    setAssignmentError(null);
                  }}
                  disabled={deletingClass}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleDeleteClass}
                  disabled={deletingClass}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deletingClass ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      {t.deleting || 'Deleting...'}
                    </>
                  ) : (
                    t.delete
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Student Reassignment Confirmation Modal */}
        {showStudentConfirmModal && studentToAssign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/20">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t.reassign_student}
                </h3>
              </div>
              
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                {t.reassign_student_message.replace('{name}', studentToAssign.name).replace('{currentClass}', studentToAssign.currentClass || t.no_class).replace('{newClass}', classForAssignment?.name || '')}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowStudentConfirmModal(false);
                    setStudentToAssign(null);
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={() => {
                    if (studentToAssign) {
                      // If multiple students selected, assign all, otherwise just the one
                      if (selectedStudentIds.size > 0) {
                        performMultipleStudentAssignment(Array.from(selectedStudentIds));
                      } else {
                        performStudentAssignment(studentToAssign.id);
                      }
                    }
                  }}
                  disabled={assigningStudent}
                  className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigningStudent ? t.assigning : t.confirm_reassign}
                </button>
              </div>
            </div>
          </div>
        )}
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
