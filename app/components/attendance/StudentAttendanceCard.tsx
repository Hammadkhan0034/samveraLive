'use client';

import React from 'react';
import type { Student } from '@/lib/types/attendance';
import { getStudentName, getClassName } from '@/lib/utils/studentUtils';

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

interface StudentAttendanceCardProps {
  student: Student;
  isPresent: boolean;
  onToggle: (studentId: string, checked: boolean) => void;
  disabled?: boolean;
  classes: Array<{ id: string; name: string }>;
}

export const StudentAttendanceCard = React.memo<StudentAttendanceCardProps>(
  function StudentAttendanceCard({
    student,
    isPresent,
    onToggle,
    disabled = false,
    classes,
  }) {
    const studentName = getStudentName(student);
    const classId = student.class_id || (student as any).classes?.id || null;
    const className = getClassName(classId, classes);

    return (
      <label
        className={clsx(
          'flex cursor-pointer items-center justify-between rounded-xl border p-3 transition',
          isPresent
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300'
            : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
        )}
      >
        <div className="flex flex-col">
          <span className="font-medium">{studentName}</span>
          {classId && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {className}
            </span>
          )}
        </div>
        <input
          type="checkbox"
          checked={isPresent}
          onChange={(e) => onToggle(student.id, e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </label>
    );
  }
);

