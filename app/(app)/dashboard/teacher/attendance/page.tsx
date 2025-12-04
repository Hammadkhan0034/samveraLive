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
import type { Student, TeacherClass } from '@/lib/types/attendance';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';


interface TeacherAttendanceContentProps {
  t: typeof enText | typeof isText;
  lang: 'is' | 'en';
  kidsIn: number;
  students: Student[];
  teacherClasses: TeacherClass[];
  attendance: Record<string, boolean>;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isLoading: boolean;
  onMarkAll: (classId?: string) => void;
  onToggle: (studentId: string, checked: boolean) => void;
  onSubmit: () => void;
}

function TeacherAttendanceContent({
  t,
  lang,
  kidsIn,
  students,
  teacherClasses,
  attendance,
  hasUnsavedChanges,
  isSaving,
  isLoading,
  onMarkAll,
  onToggle,
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
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          isLoading={isLoading}
          onMarkAll={onMarkAll}
          onToggle={onToggle}
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
  const kidsIn = useMemo(() => {
    return students.filter((s) => attendance[s.id]).length;
  }, [students, attendance]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return students.some((student) => {
      const currentStatus = attendance[student.id] || false;
      const savedStatus = savedAttendance[student.id] || false;
      return currentStatus !== savedStatus;
    });
  }, [attendance, savedAttendance, students]);

  // Handle save attendance
  const handleSaveAttendance = useCallback(async () => {
    try {
      await saveAttendance(attendance);
    } catch (error: any) {
      alert(error.message || 'Error saving attendance. Please try again.');
    }
  }, [attendance, saveAttendance]);

  // Handle toggle attendance
  const handleToggleAttendance = useCallback(
    (studentId: string, checked: boolean) => {
      updateAttendance(studentId, checked);
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
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSavingAttendance}
        isLoading={isPageLoading}
        onMarkAll={handleMarkAllPresent}
        onToggle={handleToggleAttendance}
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
  attendance: Record<string, boolean>;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isLoading: boolean;
  onMarkAll: (classId?: string) => void;
  onToggle: (studentId: string, checked: boolean) => void;
  onSubmit: () => void;
}

const AttendancePanel = React.memo<AttendancePanelProps>(function AttendancePanel({
  t,
  lang,
  students,
  teacherClasses,
  attendance,
  hasUnsavedChanges,
  isSaving,
  isLoading,
  onMarkAll,
  onToggle,
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
      <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex flex-col gap-ds-sm sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-ds-sm">
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
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          {selectedClassId === 'all'
            ? t.no_students_found || 'No students found in assigned classes'
            : t.no_students_assigned || 'No students assigned to this class'}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => {
            const isPresent = attendance[student.id] || false;
            return (
              <StudentAttendanceCard
                key={student.id}
                student={student}
                isPresent={isPresent}
                onToggle={onToggle}
                disabled={isSaving || isLoading}
                classes={teacherClasses}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
