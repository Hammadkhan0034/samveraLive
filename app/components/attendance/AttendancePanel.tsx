'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useTeacherStudents } from '@/lib/hooks/useTeacherStudents';
import { useAttendance } from '@/lib/hooks/useAttendance';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { AttendanceFilters } from '@/app/components/attendance/AttendanceFilters';
import { AttendanceActions } from '@/app/components/attendance/AttendanceActions';
import { UnsavedChangesWarning } from '@/app/components/attendance/UnsavedChangesWarning';
import EmptyState from '@/app/components/EmptyState';
import { getStudentName } from '@/lib/utils/studentUtils';
import type { Student, TeacherClass } from '@/lib/types/attendance';

export default function AttendancePanel() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  // Data fetching hooks
  const { classes: teacherClasses, isLoading: loadingClasses } = useTeacherClasses();
  const { students, isLoading: loadingStudents } = useTeacherStudents(teacherClasses);
  const {
    attendance,
    savedAttendance,
    attendanceRecords,
    leftAt,
    savedLeftAt,
    isLoading: loadingAttendance,
    isSaving: isSavingAttendance,
    hasLoadedInitial,
    loadAttendance,
    saveAttendance,
    updateAttendance,
  } = useAttendance(students, teacherClasses);

  // Local state for class filter
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  // Load attendance for today when students are available
  useEffect(() => {
    if (students.length > 0 && teacherClasses.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      loadAttendance(today);
    }
  }, [students.length, teacherClasses.length, loadAttendance]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return students.some((student) => {
      const currentStatus = attendance[student.id] || '';
      const savedStatus = savedAttendance[student.id] || '';
      const currentLeftAt = leftAt[student.id] ?? null;
      const savedLeftAtValue = savedLeftAt[student.id] ?? null;
      return currentStatus !== savedStatus || currentLeftAt !== savedLeftAtValue;
    });
  }, [attendance, savedAttendance, leftAt, savedLeftAt, students]);

  // Handle save attendance
  const handleSaveAttendance = useCallback(async () => {
    try {
      await saveAttendance(attendance, leftAt);
    } catch (error: any) {
      alert(error.message || t.error_saving_attendance || 'Error saving attendance. Please try again.');
    }
  }, [attendance, leftAt, saveAttendance, t]);

  // Handle status change
  const handleStatusChange = useCallback(
    (studentId: string, status: string) => {
      updateAttendance(studentId, status);
    },
    [updateAttendance]
  );

  // Aggregate loading state
  const isLoading =
    loadingClasses ||
    loadingStudents ||
    (loadingAttendance && students.length > 0 && teacherClasses.length > 0) ||
    (!hasLoadedInitial && students.length > 0 && teacherClasses.length > 0);

  // Filter students by selected class
  const filteredStudents = useMemo(() => {
    if (selectedClassId === 'all') {
      return students;
    }

    return students.filter((s) => {
      const studentClassId = s.class_id || (s as any).classes?.id || null;
      const normalizedStudentClassId = studentClassId ? String(studentClassId).trim() : null;
      const normalizedSelectedClassId = selectedClassId ? String(selectedClassId).trim() : null;
      return normalizedStudentClassId === normalizedSelectedClassId;
    });
  }, [students, selectedClassId]);

  // Handle class filter change
  const handleClassChange = useCallback((classId: string) => {
    setSelectedClassId(classId);
  }, []);

  // Get available status options based on current status and left_at
  const getAvailableOptions = useCallback((status: string, isGone: boolean): Array<{ value: string; label: string }> => {
    const currentStatus = status || '';
    
    // If student has left (left_at is set), show option to unmark as gone
    if (isGone) {
      return [
        { value: 'arrived', label: t.attendance_status_arrived || 'Arrived' },
        { value: 'gone', label: t.attendance_status_gone || 'Marked as Gone' },
      ];
    }
    
    // If status is 'arrived' and not gone, show option to mark as gone
    if (currentStatus === 'arrived') {
      return [
        { value: 'arrived', label: t.attendance_status_arrived || 'Arrived' },
        { value: 'gone', label: t.attendance_mark_as_gone || 'Mark as Gone' },
      ];
    }
    
    // Otherwise show the main status options
    return [
      { value: '', label: t.attendance_not_recorded || 'Not Recorded' },
      { value: 'arrived', label: t.attendance_status_arrived || 'Arrived' },
      { value: 'away_holiday', label: t.attendance_status_away_holiday || 'Away – Holiday' },
      { value: 'away_sick', label: t.attendance_status_away_sick || 'Away – Sick' },
    ];
  }, [t]);

  // Handle student name click
  const handleStudentNameClick = useCallback((e: React.MouseEvent, studentId: string) => {
    e.stopPropagation();
    const from = encodeURIComponent('/dashboard/teacher/attendance');
    router.push(`/dashboard/teacher/students/${encodeURIComponent(studentId)}?from=${from}`);
  }, [router]);

  return (
    <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
      {/* Title and Actions Row */}
      <div className="mb-3 sm:mb-4 flex flex-col gap-2 sm:gap-ds-sm sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
          {t.attendance_title || t.attendance || 'Attendance'}
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-ds-sm">
          <AttendanceFilters
            classes={teacherClasses}
            selectedClassId={selectedClassId}
            onClassChange={handleClassChange}
            translations={t}
          />
          <AttendanceActions
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSavingAttendance}
            onSave={handleSaveAttendance}
            translations={t}
            disabled={isLoading}
          />
        </div>
      </div>

      {hasUnsavedChanges && !isSavingAttendance && (
        <UnsavedChangesWarning lang={lang} />
      )}

      {isLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={selectedClassId === 'all' ? t.no_students_found_title : t.no_students_assigned}
          description={selectedClassId === 'all' ? t.no_students_found_description : t.no_students_assigned}
        />
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-ds-lg">
          <div className="min-w-[640px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-mint-500">
                  <th className="text-left py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-lg">
                    {t.student_name || 'Student Name'}
                  </th>
                  <th className="text-left py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-lg">
                    {t.attendance_status || 'Status'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const status = attendance[student.id] || '';
                  const record = attendanceRecords[student.id];
                  const studentLeftAt = leftAt[student.id] ?? record?.left_at ?? null;
                  const isGone = studentLeftAt !== null && studentLeftAt !== undefined;
                  const displayStatus = isGone ? 'gone' : status;
                  const options = getAvailableOptions(status, isGone);
                  const studentName = getStudentName(student);

                  return (
                    <tr
                      key={student.id}
                      className="border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="py-2 px-2 sm:px-4">
                        <button
                          onClick={(e) => handleStudentNameClick(e, student.id)}
                          className="font-medium text-left hover:text-mint-600 dark:hover:text-mint-400 hover:underline transition-colors cursor-pointer focus:outline-none rounded px-1 -ml-1 text-ds-tiny text-ds-text-primary dark:text-slate-100"
                          type="button"
                        >
                          {studentName}
                        </button>
                      </td>
                      <td className="py-2 px-2 sm:px-4">
                        <select
                          value={displayStatus || ''}
                          onChange={(e) => handleStatusChange(student.id, e.target.value)}
                          disabled={isSavingAttendance || isLoading}
                          className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 px-2 sm:px-3 py-1.5 sm:py-2 text-ds-tiny sm:text-ds-small bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800"
                        >
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

