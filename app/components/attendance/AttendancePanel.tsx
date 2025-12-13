'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Users } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useTeacherStudents } from '@/lib/hooks/useTeacherStudents';
import { useAttendance } from '@/lib/hooks/useAttendance';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { StudentAttendanceCard } from '@/app/components/attendance/StudentAttendanceCard';
import { AttendanceFilters } from '@/app/components/attendance/AttendanceFilters';
import { AttendanceActions } from '@/app/components/attendance/AttendanceActions';
import { UnsavedChangesWarning } from '@/app/components/attendance/UnsavedChangesWarning';
import EmptyState from '@/app/components/EmptyState';
import type { Student, TeacherClass } from '@/lib/types/attendance';

export default function AttendancePanel() {
  const { t, lang } = useLanguage();
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
      alert(error.message || 'Error saving attendance. Please try again.');
    }
  }, [attendance, leftAt, saveAttendance]);

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

  return (
    <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 sm:mb-4 flex flex-col gap-2 sm:gap-ds-sm sm:flex-row sm:items-center sm:justify-end">
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
        <LoadingSkeleton type="cards" rows={6} />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={selectedClassId === 'all' ? t.no_students_found_title : t.no_students_assigned || 'No students assigned to this class'}
          description={selectedClassId === 'all' ? t.no_students_found_description : t.no_students_assigned || 'No students assigned to this class'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => {
            const status = attendance[student.id] || '';
            const record = attendanceRecords[student.id];
            const studentLeftAt = leftAt[student.id] ?? record?.left_at ?? null;
            return (
              <StudentAttendanceCard
                key={student.id}
                student={student}
                status={status}
                onStatusChange={handleStatusChange}
                disabled={isSavingAttendance || isLoading}
                classes={teacherClasses}
                updatedAt={record?.updated_at || record?.created_at || null}
                leftAt={studentLeftAt}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

