import { X, Search, Check, Users } from 'lucide-react';

import type { AvailableTeacher, TranslationStrings } from './types';

export interface AssignTeacherModalProps {
  isOpen: boolean;
  className: string;
  t: TranslationStrings;
  assignmentError: string | null;
  teacherSearchQuery: string;
  onTeacherSearchChange: (value: string) => void;
  loadingTeachers: boolean;
  filteredTeachers: AvailableTeacher[];
  selectedTeacherIds: Set<string>;
  assigningTeacher: boolean;
  onToggleTeacherSelection: (teacherId: string) => void;
  onSaveTeacherAssignments: () => void;
  onClose: () => void;
}

export function AssignTeacherModal({
  isOpen,
  className,
  t,
  assignmentError,
  teacherSearchQuery,
  onTeacherSearchChange,
  loadingTeachers,
  filteredTeachers,
  selectedTeacherIds,
  assigningTeacher,
  onToggleTeacherSelection,
  onSaveTeacherAssignments,
  onClose,
}: AssignTeacherModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-ds-lg bg-white shadow-ds-lg dark:bg-slate-800 max-h-[90vh] flex flex-col">
        <div className="p-ds-md border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
              {t.assign_teacher_to_class} - {className}
            </h3>
            <button
              onClick={onClose}
              className="rounded-ds-md p-1 text-slate-600 dark:text-slate-400 hover:bg-mint-50 transition-colors"
              aria-label={t.close}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-ds-md">
          {assignmentError && (
            <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {assignmentError}
            </div>
          )}

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={teacherSearchQuery}
                onChange={(e) => onTeacherSearchChange(e.target.value)}
                placeholder={t.search_teachers_placeholder}
                className="w-full h-14 pl-10 pr-4 rounded-ds-xl bg-[#F5FFF7] border border-[#D8EBD8] text-ds-body focus:outline-none focus:ring-2 focus:ring-mint-500/20 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 shadow-ds-sm"
              />
            </div>
          </div>

          {loadingTeachers ? (
            <div className="py-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-mint-300 border-t-mint-600 mx-auto mb-4" />
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
                      onClick={() => onToggleTeacherSelection(teacher.id)}
                      disabled={assigningTeacher}
                      className={`w-full flex items-center justify-between rounded-ds-md border p-4 hover:bg-mint-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                        isSelected
                          ? 'border-mint-500 bg-mint-50 dark:border-mint-400 dark:bg-mint-900/20'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded border ${
                            isSelected
                              ? 'border-mint-500 bg-mint-500 dark:border-mint-400 dark:bg-mint-400'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white dark:text-slate-900" />}
                        </div>
                        <div className="text-left flex-1">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {teacher.full_name}
                          </div>
                          {teacher.email && (
                            <div className="text-ds-tiny text-slate-500 dark:text-slate-400 mt-1">
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
                <div className="mt-4 p-3 rounded-ds-md bg-mint-50 border border-mint-200 dark:bg-slate-800 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-ds-small text-slate-700 dark:text-slate-300">
                      {selectedTeacherIds.size}{' '}
                      {selectedTeacherIds.size === 1
                        ? t.teacher_selected || 'teacher selected'
                        : t.teachers_selected || 'teachers selected'}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-ds-md border-t border-slate-200 dark:border-slate-700 flex justify-end gap-ds-sm">
          <button
            onClick={onClose}
            className="rounded-ds-md border border-slate-300 px-ds-md py-ds-sm text-ds-small text-slate-700 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {t.cancel}
          </button>
          <button
            onClick={onSaveTeacherAssignments}
            disabled={assigningTeacher}
            className="rounded-ds-md bg-mint-500 hover:bg-mint-600 px-ds-md py-ds-sm text-ds-small text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
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
    </div>
  );
}


