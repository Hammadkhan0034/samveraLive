'use client';

import React from 'react';
import type { Student } from '@/lib/types/attendance';
import { getStudentName, getClassName } from '@/lib/utils/studentUtils';
import { useLanguage } from '@/lib/contexts/LanguageContext';

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type AttendanceStatus = 'arrived' | 'away_holiday' | 'away_sick' | 'gone' | 'present' | 'absent' | 'late' | 'excused' | '';

interface StudentAttendanceCardProps {
  student: Student;
  status: string;
  onStatusChange: (studentId: string, status: string) => void;
  disabled?: boolean;
  classes: Array<{ id: string; name: string }>;
  updatedAt?: string | null;
}

export const StudentAttendanceCard = React.memo<StudentAttendanceCardProps>(
  function StudentAttendanceCard({
    student,
    status,
    onStatusChange,
    disabled = false,
    classes,
    updatedAt,
  }) {
    const { t, lang } = useLanguage();
    const studentName = getStudentName(student);
    const classId = student.class_id || (student as any).classes?.id || null;
    const className = getClassName(classId, classes);

    // Get available status options based on current status
    const getAvailableOptions = (): Array<{ value: string; label: string }> => {
      const currentStatus = status || '';
      
      // If status is 'arrived', only show 'gone' as next option
      if (currentStatus === 'arrived') {
        return [
          { value: 'arrived', label: t.attendance_status_arrived || 'Arrived' },
          { value: 'gone', label: t.attendance_mark_as_gone || 'Marked as Gone' },
        ];
      }
      
      // Otherwise show the main status options
      return [
        { value: '', label: t.attendance_not_recorded || 'Not Recorded' },
        { value: 'arrived', label: t.attendance_status_arrived || 'Arrived' },
        { value: 'away_holiday', label: t.attendance_status_away_holiday || 'Away – Holiday' },
        { value: 'away_sick', label: t.attendance_status_away_sick || 'Away – Sick' },
      ];
    };

    const options = getAvailableOptions();

    // Get status display label
    const getStatusLabel = (statusValue: string): string => {
      if (!statusValue) return t.attendance_not_recorded || 'Not Recorded';
      switch (statusValue) {
        case 'arrived':
          return t.attendance_status_arrived || 'Arrived';
        case 'away_holiday':
          return t.attendance_status_away_holiday || 'Away – Holiday';
        case 'away_sick':
          return t.attendance_status_away_sick || 'Away – Sick';
        case 'gone':
          return t.attendance_status_gone || 'Marked as Gone';
        case 'present':
          return t.attendance_present || 'Present';
        case 'absent':
          return t.attendance_absent || 'Absent';
        case 'late':
          return t.attendance_late || 'Late';
        case 'excused':
          return t.attendance_excused || 'Excused';
        default:
          return t.attendance_not_recorded || 'Not Recorded';
      }
    };

    // Get status color classes
    const getStatusColorClasses = (statusValue: string): string => {
      switch (statusValue) {
        case 'arrived':
        case 'present':
          return 'border-mint-200 bg-mint-50 text-mint-800 dark:border-mint-600 dark:bg-mint-900/20 dark:text-mint-300';
        case 'away_holiday':
        case 'away_sick':
        case 'absent':
          return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-300';
        case 'gone':
          return 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-900/20 dark:text-slate-300';
        default:
          return 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300';
      }
    };

    // Format timestamp
    const formatTimestamp = (timestamp: string | null | undefined): string | null => {
      if (!timestamp) return null;
      try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        
        // Format as date
        return date.toLocaleString(lang === 'is' ? 'is-IS' : 'en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return null;
      }
    };

    const statusColorClasses = getStatusColorClasses(status);
    const timestampText = formatTimestamp(updatedAt);

    return (
      <div
        className={clsx(
          'flex flex-col rounded-ds-md border p-3 transition-colors',
          statusColorClasses
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col flex-1">
            <span className="font-medium">{studentName}</span>
            {classId && (
              <span className="text-ds-tiny text-slate-500 dark:text-slate-400">
                {className}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <select
            value={status || ''}
            onChange={(e) => onStatusChange(student.id, e.target.value)}
            disabled={disabled}
            className={clsx(
              'w-full rounded-ds-md border border-slate-300 dark:border-slate-600',
              'px-3 py-2 text-ds-small',
              'bg-white dark:bg-slate-800',
              'text-slate-900 dark:text-slate-100',
              'focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'disabled:bg-slate-100 dark:disabled:bg-slate-800'
            )}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          {timestampText && (
            <span className="text-ds-tiny text-slate-500 dark:text-slate-400">
              {timestampText}
            </span>
          )}
        </div>
      </div>
    );
  }
);
