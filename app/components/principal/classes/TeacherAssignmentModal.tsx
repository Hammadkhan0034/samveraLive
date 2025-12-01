'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Search, Check, Users } from 'lucide-react';

import type { AvailableTeacher, TranslationStrings } from './types';

export interface TeacherAssignmentModalProps {
  classId: string;
  className: string;
  t: TranslationStrings;
  /**
   * Called after teacher assignments have been successfully updated.
   */
  onCompleted?: () => void;
  /**
   * Render prop for the trigger that opens the modal.
   */
  trigger: (open: () => void) => React.ReactNode;
}

export function TeacherAssignmentModal({
  classId,
  className,
  t,
  onCompleted,
  trigger,
}: TeacherAssignmentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState<AvailableTeacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [assigningTeacher, setAssigningTeacher] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [initialTeacherIds, setInitialTeacherIds] = useState<string[]>([]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setAssignmentError(null);
    setTeacherSearchQuery('');
    setSelectedTeacherIds(new Set());
    setInitialTeacherIds([]);
  }, []);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Load teachers when modal opens
  useEffect(() => {
    async function loadAvailableTeachers() {
      if (!isOpen) return;

      try {
        setLoadingTeachers(true);
        setAssignmentError(null);

        const [staffRes, classesRes] = await Promise.all([
          fetch(`/api/staff-management`, { cache: 'no-store' }),
          fetch(`/api/classes?id=${encodeURIComponent(classId)}`, { cache: 'no-store' }),
        ]);

        const staffJson = await staffRes.json();
        const classesJson = await classesRes.json();

        if (!staffRes.ok) {
          throw new Error(staffJson.error || 'Failed to load teachers');
        }

        let classData: any | null = null;
        if (classesJson) {
          if (Array.isArray(classesJson.classes)) {
            classData = classesJson.classes.find((c: any) => c.id === classId) || null;
          } else if (classesJson.class) {
            classData = classesJson.class;
          }
        }

        const assignedTeacherIds = new Set(
          (classData?.assigned_teachers || []).map((t: any) => t.id || t.user_id).filter(Boolean),
        );

        const allTeachers: AvailableTeacher[] = (staffJson.staff || []).map((s: any) => {
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
        const initialIds = allTeachers.filter((t) => t.is_assigned).map((t) => t.id);
        setInitialTeacherIds(initialIds);
        setSelectedTeacherIds(new Set(initialIds));
      } catch (err: any) {
        console.error('Error loading teachers:', err);
        setAssignmentError(err.message || 'Failed to load teachers');
      } finally {
        setLoadingTeachers(false);
      }
    }

    void loadAvailableTeachers();
  }, [classId, isOpen]);

  const toggleTeacherSelection = useCallback((teacherId: string) => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  }, []);

  const filteredTeachers = useMemo(
    () =>
      availableTeachers.filter((tchr) => {
        const q = teacherSearchQuery.toLowerCase();
        return (
          tchr.full_name.toLowerCase().includes(q) ||
          (tchr.email && tchr.email.toLowerCase().includes(q))
        );
      }),
    [availableTeachers, teacherSearchQuery],
  );

  async function saveTeacherAssignments() {
    const teacherIds = Array.from(selectedTeacherIds);
    const currentAssignedIds = new Set(initialTeacherIds);
    const newSelectedIds = new Set(teacherIds);

    const toAdd = teacherIds.filter((id) => !currentAssignedIds.has(id));
    const toRemove = Array.from(currentAssignedIds).filter(
      (id) => typeof id === 'string' && !newSelectedIds.has(id),
    );

    if (toAdd.length === 0 && toRemove.length === 0) {
      closeModal();
      return;
    }

    try {
      setAssigningTeacher(true);
      setAssignmentError(null);

      const assignPromises = toAdd.map(async (teacherId) => {
        const response = await fetch('/api/assign-teacher-class', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: teacherId,
            classId,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to assign teacher ${teacherId}`);
        }
      });

      const removePromises = toRemove.map(async (teacherId) => {
        const response = await fetch('/api/remove-teacher-class', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: teacherId,
            classId,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to remove teacher ${teacherId}`);
        }
      });

      await Promise.allSettled([...assignPromises, ...removePromises]);

      closeModal();
      if (onCompleted) onCompleted();
    } catch (err: any) {
      console.error('Error updating teachers:', err);
      setAssignmentError(err.message || 'Failed to update teachers');
    } finally {
      setAssigningTeacher(false);
    }
  }

  if (!trigger) return null;

  return (
    <>
      {trigger(openModal)}

      {!isOpen ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl dark:bg-slate-800">
            <div className="border-b border-slate-200 p-6 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t.assign_teacher_to_class} - {className}
                </h3>
                <button
                  onClick={closeModal}
                  className="rounded-lg p-1 text-slate-600 dark:text-slate-400"
                  aria-label={t.close}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {assignmentError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  {assignmentError}
                </div>
              )}

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    placeholder={t.search_teachers_placeholder}
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  />
                </div>
              </div>

              {loadingTeachers ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600" />
                  <p className="text-slate-600 dark:text-slate-400">{t.loading_teachers}</p>
                </div>
              ) : filteredTeachers.length === 0 ? (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                  {t.no_teachers_available}
                </div>
              ) : (
                <>
                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {filteredTeachers.map((teacher) => {
                      const isSelected = selectedTeacherIds.has(teacher.id);

                      return (
                        <button
                          key={teacher.id}
                          onClick={() => toggleTeacherSelection(teacher.id)}
                          disabled={assigningTeacher}
                          className={`flex w-full items-center justify-between rounded-lg border p-4 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 ${
                            isSelected
                              ? 'border-black bg-slate-100 dark:border-slate-400 dark:bg-slate-700'
                              : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex flex-1 items-center gap-3">
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded border ${
                                isSelected
                                  ? 'border-black bg-black dark:border-slate-300 dark:bg-slate-300'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 text-white dark:text-slate-900" />
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {teacher.full_name}
                              </div>
                              {teacher.email && (
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {teacher.email}
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

            {selectedTeacherIds.size > 0 && (
                    <div className="m-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {selectedTeacherIds.size}{' '}
                          {selectedTeacherIds.size === 1
                            ? t.teacher_selected || 'teacher selected'
                            : t.teachers_selected || 'teachers selected'}
                        </span>
                        <button
                onClick={saveTeacherAssignments}
                disabled={assigningTeacher}
                className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-black"
              >
                {assigningTeacher ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t.updating_teachers}
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    {t.save}
                  </>
                )}
              </button>
                      </div>
                    </div>
                  )}
           
          </div>
        </div>
      )}
    </>
  );
}


