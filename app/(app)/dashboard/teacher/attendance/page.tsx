'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Users, Menu, CalendarDays } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useTeacherOrgId } from '@/lib/hooks/useTeacherOrgId';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useTeacherStudents } from '@/lib/hooks/useTeacherStudents';
import { useAttendance } from '@/lib/hooks/useAttendance';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { StudentAttendanceCard } from '@/app/components/attendance/StudentAttendanceCard';
import { AttendanceFilters } from '@/app/components/attendance/AttendanceFilters';
import { AttendanceActions } from '@/app/components/attendance/AttendanceActions';
import { UnsavedChangesWarning } from '@/app/components/attendance/UnsavedChangesWarning';
import type { Student, TeacherClass } from '@/lib/types/attendance';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';

// Attendance Page Header Component
function AttendancePageHeader({
  title,
  label,
  kidsIn,
  total,
  todayHint,
}: {
  title: string;
  label: string;
  kidsIn: number;
  total: number;
  todayHint: string;
}) {
  const { sidebarRef } = useTeacherPageLayout();

  return (
    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={() => sidebarRef.current?.open()}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <ProfileSwitcher />
        {/* Desktop stats */}
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Users className="h-4 w-4" />
          <span>
            {label}: <span className="font-medium">{kidsIn}</span> / {total}
          </span>
          <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
          <CalendarDays className="h-4 w-4" />
          <span>{todayHint}</span>
        </div>
        {/* Mobile stats */}
        <div className="md:hidden flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Users className="h-4 w-4" />
          <span>
            {label}: <span className="font-medium">{kidsIn}</span> / {total}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function TeacherAttendancePage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const { orgId } = useTeacherOrgId();
  const { classes: teacherClasses, isLoading: loadingClasses } = useTeacherClasses();
  const { students, isLoading: loadingStudents, error: studentError } = useTeacherStudents(
    teacherClasses,
    orgId
  );
  const {
    attendance,
    savedAttendance,
    isLoading: loadingAttendance,
    isSaving: isSavingAttendance,
    loadAttendance,
    saveAttendance,
    updateAttendance,
    markAllPresent,
  } = useAttendance(students, teacherClasses, orgId, session?.user?.id);

  // Load attendance for today when students are available
  useEffect(() => {
    if (students.length > 0 && orgId && session?.user?.id && teacherClasses.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      loadAttendance(today);
    }
  }, [students.length, orgId, session?.user?.id, teacherClasses.length, loadAttendance]);

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

  return (
    <TeacherPageLayout attendanceBadge={kidsIn}>
      {/* Content Header */}
      <AttendancePageHeader
        title={t.att_title}
        label={t.kids_checked_in}
        kidsIn={kidsIn}
        total={students.length}
        todayHint={t.today_hint}
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
          isSaving={isSavingAttendance}
          isLoading={loadingStudents || loadingAttendance}
          onMarkAll={handleMarkAllPresent}
          onToggle={handleToggleAttendance}
          onSubmit={handleSaveAttendance}
        />
      </section>
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-3">
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
