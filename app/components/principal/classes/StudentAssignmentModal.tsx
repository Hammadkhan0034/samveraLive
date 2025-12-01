'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Search, CheckCircle2, AlertTriangle, Check, UserPlus } from 'lucide-react';

import type { AvailableStudent, TranslationStrings } from './types';
import { StudentReassignConfirmModal, type StudentToAssign } from './StudentReassignConfirmModal';

export interface StudentAssignmentModalProps {
  classId: string;
  className: string;
  t: TranslationStrings;
  /**
   * Called after students have been successfully assigned.
   * Useful for parents to trigger data refresh.
   */
  onCompleted?: () => void;
  /**
   * Render prop for the trigger that opens the modal.
   * Receives an `open` function to call from any button or element.
   */
  trigger: (open: () => void) => React.ReactNode;
}

export function StudentAssignmentModal({
  classId,
  className,
  t,
  onCompleted,
  trigger,
}: StudentAssignmentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [studentToAssign, setStudentToAssign] = useState<StudentToAssign | null>(null);
  const [showStudentConfirmModal, setShowStudentConfirmModal] = useState(false);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setAssignmentError(null);
    setAssignmentSuccess(null);
    setSelectedStudentIds(new Set());
    setStudentSearchQuery('');
    setShowStudentConfirmModal(false);
    setStudentToAssign(null);
  }, []);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Load available students when the modal opens
  useEffect(() => {
    async function loadAvailableStudents() {
      if (!isOpen) return;

      try {
        setLoadingStudents(true);
        setAssignmentError(null);

        const [studentsRes, classesRes] = await Promise.all([
          fetch(`/api/students?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/classes`, { cache: 'no-store' }),
        ]);

        const studentsJson = await studentsRes.json();
        const classesJson = await classesRes.json();

        if (!studentsRes.ok) {
          throw new Error(studentsJson.error || `Failed to load students`);
        }

        const classesList: Array<{ id: string; name: string }> =
          Array.isArray(classesJson.classes) ? classesJson.classes : [];

        const classNameById = new Map<string, string>();
        classesList.forEach((c) => {
          if (c?.id) classNameById.set(c.id, c.name);
        });

        const allStudents: AvailableStudent[] = (studentsJson.students || [])
          .filter((s: any) => s.class_id !== classId)
          .map((s: any) => {
            const currentClassId = s.class_id || s.classes?.id || null;
            const currentClassName =
              (currentClassId && classNameById.get(currentClassId)) || s.classes?.name || null;

            return {
              id: s.id,
              first_name: s.first_name || s.users?.first_name || '',
              last_name: s.last_name || s.users?.last_name || null,
              full_name: `${s.first_name || s.users?.first_name || ''} ${
                s.last_name || s.users?.last_name || ''
              }`.trim(),
              current_class_id: currentClassId,
              current_class_name: currentClassName,
              email: s.users?.email || null,
              phone: s.phone || s.users?.phone || null,
            };
          });

        setAvailableStudents(allStudents);
        setSelectedStudentIds(new Set());
      } catch (err: any) {
        console.error('Error loading students:', err);
        setAssignmentError(err.message || 'Failed to load students');
      } finally {
        setLoadingStudents(false);
      }
    }

    void loadAvailableStudents();
  }, [classId, isOpen]);

  const toggleStudentSelection = useCallback((studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  const filteredStudents = useMemo(
    () =>
      availableStudents.filter((s) => {
        const q = studentSearchQuery.toLowerCase();
        return (
          s.full_name.toLowerCase().includes(q) ||
          (s.email && s.email.toLowerCase().includes(q))
        );
      }),
    [availableStudents, studentSearchQuery],
  );

  async function performMultipleStudentAssignment(studentIds: string[]) {
    if (!classId || studentIds.length === 0) return;

    try {
      setAssigningStudent(true);
      setAssignmentError(null);

      const studentResponse = await fetch(`/api/students?t=${Date.now()}`, {
        cache: 'no-store',
      });
      const studentData = await studentResponse.json();

      if (!studentData.students) {
        throw new Error('Failed to load student data');
      }

      const assignmentPromises = studentIds.map(async (studentId) => {
        const student = studentData.students?.find((s: any) => s.id === studentId);
        if (!student) {
          console.warn(`Student ${studentId} not found`);
          return;
        }

        if (student.class_id === classId) {
          console.warn(`Student ${studentId} already in class ${classId}`);
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
            class_id: classId,
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
            guardian_ids: student.guardians?.map((g: any) => g.id) || [],
          }),
        });

        const updateData = await updateResponse.json();
        if (!updateResponse.ok) {
          throw new Error(updateData.error || `Failed to assign student ${studentId}`);
        }
      });

      await Promise.allSettled(assignmentPromises);

      setAssignmentSuccess(
        `${studentIds.length} ${
          studentIds.length === 1 ? t.student_assigned_success : t.students_assigned_success
        }`,
      );

      setTimeout(() => {
        closeModal();
        setAssignmentSuccess(null);
        if (onCompleted) onCompleted();
      }, 2000);
    } catch (err: any) {
      console.error('Error assigning students:', err);
      setAssignmentError(err.message || 'Failed to assign students');
    } finally {
      setAssigningStudent(false);
    }
  }

  async function performSingleStudentAssignment(studentId: string) {
    if (!classId) return;

    try {
      setAssigningStudent(true);
      setAssignmentError(null);

      const studentResponse = await fetch(`/api/students?t=${Date.now()}`, {
        cache: 'no-store',
      });
      const studentData = await studentResponse.json();
      const student = studentData.students?.find((s: any) => s.id === studentId);

      if (!student) {
        throw new Error('Student not found');
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
          class_id: classId,
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
          guardian_ids: student.guardians?.map((g: any) => g.id) || [],
        }),
      });

      const updateData = await updateResponse.json();
      if (!updateResponse.ok) {
        throw new Error(updateData.error || 'Failed to assign student');
      }

      setAssignmentSuccess(t.student_assigned_success);

      setTimeout(() => {
        closeModal();
        setAssignmentSuccess(null);
        if (onCompleted) onCompleted();
      }, 2000);
    } catch (err: any) {
      console.error('Error assigning student:', err);
      setAssignmentError(err.message || 'Failed to assign student');
    } finally {
      setAssigningStudent(false);
    }
  }

  async function assignSelectedStudents() {
    if (selectedStudentIds.size === 0) return;

    const studentsToReassign = Array.from(selectedStudentIds)
      .map((id) => availableStudents.find((s) => s.id === id))
      .filter((s) => s && s.current_class_id && s.current_class_id !== classId);

    if (studentsToReassign.length > 0) {
      const firstStudent = studentsToReassign[0];
      if (firstStudent) {
        setStudentToAssign({
          id: firstStudent.id,
          name: `${studentsToReassign.length} ${
            studentsToReassign.length === 1 ? t.student_selected : t.students_selected
          }`,
          currentClass: firstStudent.current_class_name,
        });
        setShowStudentConfirmModal(true);
        return;
      }
    }

    await performMultipleStudentAssignment(Array.from(selectedStudentIds));
  }

  if (!trigger) return null;

  return (
    <>
      {trigger(openModal)}

      {!isOpen ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex h-[700px] w-full max-w-2xl flex-col rounded-ds-lg bg-white shadow-ds-lg dark:bg-slate-800">
            <div className="border-b border-slate-200 p-ds-md dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
                  {t.add_student_to_class} - {className}
                </h3>
                <button
                  onClick={closeModal}
                  className="rounded-ds-md p-1 text-slate-600 dark:text-slate-400 hover:bg-mint-50 transition-colors"
                  aria-label={t.close}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-ds-md min-h-0">
              {assignmentError && (
                <div className="mb-4 rounded-ds-md border border-red-200 bg-red-50 px-4 py-3 text-ds-small text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  {assignmentError}
                </div>
              )}

              {assignmentSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-ds-md border border-mint-200 bg-mint-50 px-4 py-3 text-ds-small text-mint-700 dark:border-mint-800 dark:bg-mint-900/20 dark:text-mint-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {assignmentSuccess}
                </div>
              )}

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder={t.search_students_placeholder}
                    className="w-full rounded-ds-md border border-slate-300 py-2 pl-9 pr-3 text-ds-small text-slate-900 placeholder:text-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  />
                </div>
              </div>

              {loadingStudents ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-mint-300 border-t-mint-600" />
                  <p className="text-slate-600 dark:text-slate-400">{t.loading_students}</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                  {t.no_students_available}
                </div>
              ) : (
                <>
                  <div className="h-[400px] space-y-2 overflow-y-auto">
                    {filteredStudents.map((student) => {
                      const isSelected = selectedStudentIds.has(student.id);
                      const isInOtherClass =
                        student.current_class_id && student.current_class_name && !isSelected;

                      return (
                        <button
                          key={student.id}
                          onClick={() => toggleStudentSelection(student.id)}
                          disabled={assigningStudent}
                          className={`flex w-full items-center justify-between rounded-ds-md border p-4 hover:bg-mint-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${
                            isSelected
                              ? 'border-mint-500 bg-mint-50 dark:border-mint-400 dark:bg-mint-900/20'
                              : isInOtherClass
                                ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex flex-1 items-center gap-3">
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded border ${
                                isSelected
                                  ? 'border-mint-500 bg-mint-500 dark:border-mint-400 dark:bg-mint-400'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 text-white dark:text-slate-900" />
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {student.full_name}
                              </div>
                              {isInOtherClass && (
                                <div className="mt-1 flex items-center gap-1 text-ds-tiny text-amber-700 dark:text-amber-300">
                                  <AlertTriangle className="h-3 w-3" />
                                  {t.currently_in_class}: {student.current_class_name}
                                </div>
                              )}
                              {student.email && (
                                <div className="mt-1 text-ds-tiny text-slate-500 dark:text-slate-400">
                                  {student.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>


                </>
              )}
            </div>

            {selectedStudentIds.size > 0 && (
                    <div className="m-4 rounded-ds-md border border-mint-200 bg-mint-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-ds-small text-slate-700 dark:text-slate-300">
                          {selectedStudentIds.size}{' '}
                          {selectedStudentIds.size === 1
                            ? t.student_selected
                            : t.students_selected}
                        </span>
                        <button
                          onClick={assignSelectedStudents}
                          disabled={assigningStudent}
                          className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-4 py-2 text-ds-small text-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                        >
                          {assigningStudent ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
          </div>
        </div>
      )}

      <StudentReassignConfirmModal
        isOpen={showStudentConfirmModal && !!studentToAssign}
        t={t}
        studentToAssign={studentToAssign}
        targetClassName={className}
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
            void performSingleStudentAssignment(studentToAssign.id);
          }
        }}
      />
    </>
  );
}


