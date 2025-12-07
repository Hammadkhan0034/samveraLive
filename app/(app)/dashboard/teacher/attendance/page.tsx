'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Users, CalendarDays } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useTeacherStudents } from '@/lib/hooks/useTeacherStudents';
import { useAttendance } from '@/lib/hooks/useAttendance';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { StudentAttendanceCard } from '@/app/components/attendance/StudentAttendanceCard';
import { AttendanceFilters } from '@/app/components/attendance/AttendanceFilters';
import { AttendanceActions } from '@/app/components/attendance/AttendanceActions';
import { UnsavedChangesWarning } from '@/app/components/attendance/UnsavedChangesWarning';
import EmptyState from '@/app/components/EmptyState';
import type { Student, TeacherClass } from '@/lib/types/attendance';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';


interface TeacherAttendanceContentProps {
  t: typeof enText | typeof isText;
  lang: 'is' | 'en';
  kidsIn: number;
  students: Student[];
  teacherClasses: TeacherClass[];
  attendance: Record<string, string>;
  attendanceRecords: Record<string, any>;
  leftAt: Record<string, string | null>;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isLoading: boolean;
  onMarkAll: (classId?: string) => void;
  onStatusChange: (studentId: string, status: string) => void;
  onSubmit: () => void;
}

function TeacherAttendanceContent({
  t,
  lang,
  kidsIn,
  students,
  teacherClasses,
  attendance,
  attendanceRecords,
  leftAt,
  hasUnsavedChanges,
  isSaving,
  isLoading,
  onMarkAll,
  onStatusChange,
  onSubmit,
}: TeacherAttendanceContentProps) {
  const { sidebarRef } = useTeacherPageLayout();

  return (
    <>
      <PageHeader
        title={t.att_title}
        subtitle={t.attendance_subtitle}
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
        rightActions={
          <>
            {/* Desktop stats */}
            <div className="hidden md:flex items-center gap-2 text-ds-small text-slate-600 dark:text-slate-400">
              <Users className="h-4 w-4" />
              <span>
                {t.kids_checked_in}: <span className="font-medium">{kidsIn}</span> / {students.length}
              </span>
              <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
              <CalendarDays className="h-4 w-4" />
              <span>{t.today_hint}</span>
            </div>
            {/* Mobile stats */}
            <div className="md:hidden flex items-center gap-2 text-ds-small text-slate-600 dark:text-slate-400">
              <Users className="h-4 w-4" />
              <span>
                {t.kids_checked_in}: <span className="font-medium">{kidsIn}</span> / {students.length}
              </span>
            </div>
          </>
        }
      />

      {/* Attendance Panel */}
      <section>
        <AttendancePanel
          t={t}
          lang={lang}
          students={students}
          teacherClasses={teacherClasses}
          attendance={attendance}
          attendanceRecords={attendanceRecords}
          leftAt={leftAt}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          isLoading={isLoading}
          onMarkAll={onMarkAll}
          onStatusChange={onStatusChange}
          onSubmit={onSubmit}
        />
      </section>
    </>
  );
}

export default function TeacherAttendancePage() {
  const { t, lang } = useLanguage();
  const { classes: teacherClasses, isLoading: loadingClasses } = useTeacherClasses();
  const { students, isLoading: loadingStudents, error: studentError } = useTeacherStudents(
    teacherClasses
  );
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
    markAllPresent,
  } = useAttendance(students, teacherClasses);

  // Load attendance for today when students are available
  useEffect(() => {
    if (students.length > 0 && teacherClasses.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      loadAttendance(today);
    }
  }, [students.length, teacherClasses.length, loadAttendance]);

  // Calculate kids checked in from actual students (needed for tiles badge)
  // Count students with 'arrived' status
  const kidsIn = useMemo(() => {
    return students.filter((s) => {
      const status = attendance[s.id] || '';
      return status === 'arrived';
    }).length;
  }, [students, attendance]);

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

  // Handle mark all present
  const handleMarkAllPresent = useCallback(
    (classId?: string) => {
      markAllPresent(classId);
    },
    [markAllPresent]
  );

  const isPageLoading =
    !hasLoadedInitial || loadingClasses || loadingStudents || loadingAttendance;

  return (
    <TeacherPageLayout attendanceBadge={kidsIn}>
      <TeacherAttendanceContent
        t={t}
        lang={lang}
        kidsIn={kidsIn}
        students={students}
        teacherClasses={teacherClasses}
        attendance={attendance}
        attendanceRecords={attendanceRecords}
        leftAt={leftAt}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSavingAttendance}
        isLoading={isPageLoading}
        onMarkAll={handleMarkAllPresent}
        onStatusChange={handleStatusChange}
        onSubmit={handleSaveAttendance}
      />
    </TeacherPageLayout>
  );
}

/* -------------------- Attendance Panel -------------------- */

interface AttendancePanelProps {
  t: typeof enText | typeof isText;
  lang: 'is' | 'en';
  students: Student[];
  teacherClasses: TeacherClass[];
  attendance: Record<string, string>;
  attendanceRecords: Record<string, any>;
  leftAt: Record<string, string | null>;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isLoading: boolean;
  onMarkAll: (classId?: string) => void;
  onStatusChange: (studentId: string, status: string) => void;
  onSubmit: () => void;
}

const AttendancePanel = React.memo<AttendancePanelProps>(function AttendancePanel({
  t,
  lang,
  students,
  teacherClasses,
  attendance,
  attendanceRecords,
  leftAt,
  hasUnsavedChanges,
  isSaving,
  isLoading,
  onMarkAll,
  onStatusChange,
  onSubmit,
}) {
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

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

  // Handle mark all
  const handleMarkAll = useCallback(
    (classId?: string) => {
      onMarkAll(classId);
    },
    [onMarkAll]
  );

    return (
      <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 sm:mb-4 flex flex-col gap-2 sm:gap-ds-sm sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-ds-sm">
            <AttendanceFilters
              classes={teacherClasses}
              selectedClassId={selectedClassId}
              onClassChange={handleClassChange}
              onMarkAll={handleMarkAll}
              translations={t}
            />
            <AttendanceActions
              hasUnsavedChanges={hasUnsavedChanges}
              isSaving={isSaving}
              onSave={onSubmit}
              translations={t}
              disabled={isLoading}
            />
          </div>
        </div>

      {hasUnsavedChanges && !isSaving && (
        <UnsavedChangesWarning lang={lang} />
      )}

      {isLoading ? (
        <LoadingSkeleton type="cards" rows={6} />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          lang={lang}
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
                onStatusChange={onStatusChange}
                disabled={isSaving || isLoading}
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
});
