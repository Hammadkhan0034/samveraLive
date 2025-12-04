'use client';

import { useState, useCallback } from 'react';
import type { TeacherClass, Student, AttendanceRecord } from '@/lib/types/attendance';

/**
 * Hook to manage attendance state, loading, and saving
 * Supports optimistic updates for better UX
 */
export function useAttendance(
  students: Student[],
  classes: TeacherClass[]
) {
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [savedAttendance, setSavedAttendance] = useState<Record<string, string>>({});
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  // Load attendance for a specific date
  const loadAttendance = useCallback(
    async (date: string) => {
      if (students.length === 0 || classes.length === 0) {
        return;
      }

      try {
        setIsLoading(true);
        const classIds = classes.map((c) => c.id).filter(Boolean);

        const fetchPromises = classIds.map(async (classId) => {
          try {
            const response = await fetch(
              `/api/attendance?classId=${classId}&date=${date}`,
              { next: { revalidate: 120 } }
            );
            const data = await response.json();

            if (response.ok && data.attendance) {
              return data.attendance as AttendanceRecord[];
            }
            return [];
          } catch (error) {
            console.error(`Error loading attendance for class ${classId}:`, error);
            return [];
          }
        });

        const results = await Promise.allSettled(fetchPromises);
        const allAttendance: Record<string, string> = {};
        const allRecords: Record<string, AttendanceRecord> = {};

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            result.value.forEach((record) => {
              allAttendance[record.student_id] = record.status;
              allRecords[record.student_id] = record;
            });
          }
        });

        setAttendance(allAttendance);
        setSavedAttendance(allAttendance);
        setAttendanceRecords(allRecords);
        console.log('✅ Attendance loaded for date:', date, allAttendance);
      } catch (error) {
        console.error('❌ Error loading attendance:', error);
      } finally {
        setIsLoading(false);
        setHasLoadedInitial(true);
      }
    },
    [students.length, classes]
  );

  // Save single attendance record
  const saveAttendanceRecord = useCallback(async (
    studentId: string,
    status: string,
    classId?: string | null
  ): Promise<boolean> => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: classId || null,
          student_id: studentId,
          date: today,
          status: status,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Attendance saved:', { studentId, status });
        return true;
      } else {
        console.error('❌ Failed to save attendance:', data.error);
        return false;
      }
    } catch (error: any) {
      console.error('❌ Error saving attendance:', error);
      return false;
    }
  }, []);

  // Save all attendance changes (batch)
  const saveAttendance = useCallback(async (changes: Record<string, string>) => {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);

      // Find students that have changes
      const studentsToSave = students.filter((student) => {
        const currentStatus = changes[student.id] ?? attendance[student.id] ?? '';
        const savedStatus = savedAttendance[student.id] ?? '';
        return currentStatus !== savedStatus;
      });

      if (studentsToSave.length === 0) {
        console.log('No attendance changes to save');
        setIsSaving(false);
        return;
      }

      console.log(`📋 Saving attendance for ${studentsToSave.length} student(s)...`);

      // Use batch endpoint if available, otherwise save individually
      const today = new Date().toISOString().split('T')[0];
      const records = studentsToSave.map((student) => {
        const status = changes[student.id] ?? attendance[student.id] ?? 'absent';
        const classId = student.class_id || (student as any)?.classes?.id || null;
        return {
          student_id: student.id,
          status: status as any,
          date: today,
          class_id: classId,
        };
      });

      // Try batch endpoint first
      try {
        const batchResponse = await fetch('/api/attendance/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            records,
          }),
        });

        if (batchResponse.ok) {
          const batchData = await batchResponse.json();
          setSavedAttendance({ ...attendance, ...changes });
          console.log(`✅ Successfully saved attendance for ${studentsToSave.length} student(s) via batch`);
          setIsSaving(false);
          return;
        }
      } catch (batchError) {
        console.warn('Batch endpoint failed, falling back to individual saves:', batchError);
      }

      // Fallback to individual saves
      const savePromises = studentsToSave.map(async (student) => {
        const status = changes[student.id] ?? attendance[student.id] ?? 'absent';
        const classId = student.class_id || (student as any)?.classes?.id || null;
        return saveAttendanceRecord(student.id, status, classId);
      });

      const results = await Promise.allSettled(savePromises);
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value === true
      ).length;
      const failureCount = results.length - successCount;

      if (failureCount === 0) {
        setSavedAttendance({ ...attendance, ...changes });
        console.log(`✅ Successfully saved attendance for ${successCount} student(s)`);
      } else {
        console.error(`❌ Failed to save attendance for ${failureCount} student(s)`);
        throw new Error(`Failed to save attendance for ${failureCount} student(s)`);
      }
    } catch (error: any) {
      console.error('❌ Error saving attendance:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, students, attendance, savedAttendance, saveAttendanceRecord]);

  // Update attendance state (optimistic update)
  const updateAttendance = useCallback((studentId: string, status: string) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  }, []);

  // Mark all students as arrived
  const markAllPresent = useCallback((classId?: string) => {
    setAttendance((prev) => {
      const newAttendance = { ...prev };
      const studentsToMark = classId
        ? students.filter((s) => {
            const sClassId = s.class_id || (s as any).classes?.id;
            return sClassId === classId;
          })
        : students;

      studentsToMark.forEach((s) => {
        newAttendance[s.id] = 'arrived';
      });

      return newAttendance;
    });
  }, [students]);

  return {
    attendance,
    savedAttendance,
    attendanceRecords,
    isLoading,
    isSaving,
    hasLoadedInitial,
    loadAttendance,
    saveAttendance,
    updateAttendance,
    markAllPresent,
  };
}

