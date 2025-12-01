'use client';

import React from 'react';
import { SquareCheck as CheckSquare } from 'lucide-react';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';

interface AttendanceActionsProps {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
  translations: typeof enText | typeof isText;
  disabled?: boolean;
}

export const AttendanceActions = React.memo<AttendanceActionsProps>(
  function AttendanceActions({
    hasUnsavedChanges,
    isSaving,
    onSave,
    translations: t,
    disabled = false,
  }) {
    return (
      <button
        onClick={onSave}
        disabled={!hasUnsavedChanges || isSaving || disabled}
        className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 border border-mint-600 hover:bg-mint-600 px-4 py-2 text-ds-small text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-slate-600 dark:bg-mint-600 dark:hover:bg-mint-700 dark:text-slate-200"
      >
        {isSaving ? (
          <>
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {t.saved || 'Saving...'}
          </>
        ) : (
          <>
            <CheckSquare className="h-4 w-4" />
            {t.save_attendance || 'Save Attendance'}
          </>
        )}
      </button>
    );
  }
);

