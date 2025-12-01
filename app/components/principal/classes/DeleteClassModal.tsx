import { AlertTriangle } from 'lucide-react';

import type { TranslationStrings } from './types';

export interface DeleteClassModalProps {
  isOpen: boolean;
  t: TranslationStrings;
  className: string;
  assignmentError: string | null;
  deletingClass: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteClassModal({
  isOpen,
  t,
  className,
  assignmentError,
  deletingClass,
  onCancel,
  onConfirm,
}: DeleteClassModalProps) {
  if (!isOpen) return null;

  const messageTemplate =
    t.delete_class_message ||
    `Are you sure you want to delete \"{name}\"? This action cannot be undone.`;

  const message = messageTemplate.replace('{name}', className);

  return (
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

        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deletingClass}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={deletingClass}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {deletingClass ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t.deleting || 'Deleting...'}
              </>
            ) : (
              t.delete
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


