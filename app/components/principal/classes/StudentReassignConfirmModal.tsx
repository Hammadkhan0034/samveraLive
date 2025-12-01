import { AlertTriangle } from 'lucide-react';

import type { TranslationStrings } from './types';

export interface StudentToAssign {
  id: string;
  name: string;
  currentClass: string | null;
}

export interface StudentReassignConfirmModalProps {
  isOpen: boolean;
  t: TranslationStrings;
  studentToAssign: StudentToAssign | null;
  targetClassName: string;
  assigningStudent: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function StudentReassignConfirmModal({
  isOpen,
  t,
  studentToAssign,
  targetClassName,
  assigningStudent,
  onCancel,
  onConfirm,
}: StudentReassignConfirmModalProps) {
  if (!isOpen || !studentToAssign) return null;

  const message = t.reassign_student_message
    .replace('{name}', studentToAssign.name)
    .replace('{currentClass}', studentToAssign.currentClass || t.no_class)
    .replace('{newClass}', targetClassName || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-ds-lg bg-white p-ds-md shadow-ds-lg dark:bg-slate-800">
        <div className="mb-ds-md flex items-center gap-ds-sm">
          <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/20">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
            {t.reassign_student}
          </h3>
        </div>

        <p className="mb-ds-md text-ds-small text-slate-600 dark:text-slate-400">{message}</p>

        <div className="flex gap-ds-sm">
          <button
            onClick={onCancel}
            className="flex-1 rounded-ds-md border border-slate-300 px-ds-md py-ds-sm text-ds-small text-slate-700 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {t.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={assigningStudent}
            className="flex-1 rounded-ds-md bg-amber-600 px-ds-md py-ds-sm text-ds-small text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {assigningStudent ? t.assigning : t.confirm_reassign}
          </button>
        </div>
      </div>
    </div>
  );
}


