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

  async function assignStudents(studentIds: string[]) {
    if (!classId || studentIds.length === 0) return;

    try {
      setAssigningStudent(true);
      setAssignmentError(null);

      const response = await fetch('/api/assign-students-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          studentIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign students');
      }

      const assignedCount = data.assignedCount || studentIds.length;
      setAssignmentSuccess(
        `${assignedCount} ${
          assignedCount === 1 ? t.student_assigned_success : t.students_assigned_success
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

    await assignStudents(Array.from(selectedStudentIds));
  }

  if (!trigger) return null;

  return (
    <>
      {trigger(openModal)}

      {!isOpen ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="flex max-h-[85vh] sm:max-h-[90vh] md:h-[700px] w-full max-w-2xl flex-col rounded-ds-lg bg-white shadow-ds-lg dark:bg-slate-800 overflow-hidden">
            <div className="border-b border-slate-200 p-3 sm:p-ds-md dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-ds-small sm:text-ds-h3 font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {t.add_student_to_class} - {className}
                </h3>
                <button
                  onClick={closeModal}
                  className="rounded-ds-md p-1 text-slate-600 dark:text-slate-400 hover:bg-mint-50 transition-colors flex-shrink-0 active:bg-mint-100 dark:active:bg-slate-700"
                  aria-label={t.close}
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-ds-md min-h-0">
              {assignmentError && (
                <div className="mb-3 sm:mb-4 rounded-ds-md border border-red-200 bg-red-50 px-3 sm:px-4 py-2 sm:py-3 text-ds-tiny sm:text-ds-small text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  {assignmentError}
                </div>
              )}

              {assignmentSuccess && (
                <div className="mb-3 sm:mb-4 flex items-center gap-2 rounded-ds-md border border-mint-200 bg-mint-50 px-3 sm:px-4 py-2 sm:py-3 text-ds-tiny sm:text-ds-small text-mint-700 dark:border-mint-800 dark:bg-mint-900/20 dark:text-mint-400">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span>{assignmentSuccess}</span>
                </div>
              )}

              <div className="mb-3 sm:mb-4">
                <div className="relative">
                  <Search className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder={t.search_students_placeholder}
                    className="w-full h-10 sm:h-14 pl-8 sm:pl-10 pr-3 sm:pr-4 rounded-ds-xl bg-[#F5FFF7] border border-[#D8EBD8] text-ds-tiny sm:text-ds-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-mint-500/20 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 shadow-ds-sm"
                  />
                </div>
              </div>

              {loadingStudents ? (
                <div className="py-6 sm:py-8 text-center">
                  <div className="mx-auto mb-3 sm:mb-4 h-6 w-6 sm:h-8 sm:w-8 animate-spin rounded-full border-4 border-mint-300 border-t-mint-600" />
                  <p className="text-ds-tiny sm:text-ds-small text-slate-600 dark:text-slate-400">{t.loading_students}</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-6 sm:py-8 text-center text-ds-tiny sm:text-ds-small text-slate-500 dark:text-slate-400">
                  {t.no_students_available}
                </div>
              ) : (
                <>
                  <div className="h-[300px] sm:h-[400px] space-y-2 overflow-y-auto">
                    {filteredStudents.map((student) => {
                      const isSelected = selectedStudentIds.has(student.id);
                      const isInOtherClass =
                        student.current_class_id && student.current_class_name && !isSelected;

                      return (
                        <button
                          key={student.id}
                          onClick={() => toggleStudentSelection(student.id)}
                          disabled={assigningStudent}
                          className={`flex w-full items-center justify-between rounded-ds-md border p-2.5 sm:p-4 hover:bg-mint-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors active:bg-mint-100 dark:active:bg-slate-700 ${
                            isSelected
                              ? 'border-mint-500 bg-mint-50 dark:border-mint-400 dark:bg-mint-900/20'
                              : isInOtherClass
                                ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
                            <div
                              className={`flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded border flex-shrink-0 ${
                                isSelected
                                  ? 'border-mint-500 bg-mint-500 dark:border-mint-400 dark:bg-mint-400'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {isSelected && (
                                <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white dark:text-slate-900" />
                              )}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <div className="font-medium text-ds-tiny sm:text-ds-small text-slate-900 dark:text-slate-100 truncate">
                                {student.full_name}
                              </div>
                              {isInOtherClass && (
                                <div className="mt-0.5 sm:mt-1 flex items-center gap-1 text-ds-tiny text-amber-700 dark:text-amber-300">
                                  <AlertTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                  <span className="truncate">{t.currently_in_class}: {student.current_class_name}</span>
                                </div>
                              )}
                              {student.email && (
                                <div className="mt-0.5 sm:mt-1 text-ds-tiny text-slate-500 dark:text-slate-400 truncate">
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
                    <div className="m-2 sm:m-4 rounded-ds-md border border-mint-200 bg-mint-50 p-2.5 sm:p-3 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0">
                        <span className="text-ds-tiny sm:text-ds-small text-slate-700 dark:text-slate-300">
                          {selectedStudentIds.size}{' '}
                          {selectedStudentIds.size === 1
                            ? t.student_selected
                            : t.students_selected}
                        </span>
                        <button
                          onClick={assignSelectedStudents}
                          disabled={assigningStudent}
                          className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-3 sm:px-ds-md py-2 sm:py-ds-sm text-ds-tiny sm:text-ds-small text-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors active:bg-mint-700 w-full sm:w-auto"
                        >
                          {assigningStudent ? (
                            <>
                              <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              <span className="hidden sm:inline">{t.assigning}</span>
                              <span className="sm:hidden">{t.assigning}</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              <span className="hidden sm:inline">{t.assign_selected}</span>
                              <span className="sm:hidden">{t.assign_selected}</span>
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
            void assignStudents(Array.from(selectedStudentIds));
          } else {
            void assignStudents([studentToAssign.id]);
          }
        }}
      />
    </>
  );
}


