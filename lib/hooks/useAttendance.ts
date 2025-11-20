'use client';

import { useState, useCallback } from 'react';
import type { TeacherClass, Student, AttendanceRecord } from '@/lib/types/attendance';

/**
 * Hook to manage attendance state, loading, and saving
 * Supports optimistic updates for better UX
 */
export function useAttendance(
  students: Student[],
  classes: TeacherClass[],
  orgId: string | null,
  userId: string | undefined
) {
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [savedAttendance, setSavedAttendance] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load attendance for a specific date
  const loadAttendance = useCallback(async (date: string) => {
    if (!orgId || students.length === 0 || !userId) {
      return;
    }

    try {
      setIsLoading(true);
      const classIds = classes.map(c => c.id).filter(Boolean);
      

      const fetchPromises = classIds.map(async (classId) => {
        try {
          const response = await fetch(
            `/api/attendance?orgId=${orgId}&classId=${classId}&date=${date}`,
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
      const allAttendance: Record<string, boolean> = {};

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          result.value.forEach((record) => {
            allAttendance[record.student_id] = record.status === 'present';
          });
        }
      });

      setAttendance(allAttendance);
      setSavedAttendance(allAttendance);
      console.log('✅ Attendance loaded for date:', date, allAttendance);
    } catch (error) {
      console.error('❌ Error loading attendance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, students.length, classes, userId]);

  // Save single attendance record
  const saveAttendanceRecord = useCallback(async (
    studentId: string,
    isPresent: boolean,
    classId?: string | null
  ): Promise<boolean> => {
    if (!orgId || !userId) return false;

    try {
      const today = new Date().toISOString().split('T')[0];
      const status = isPresent ? 'present' : 'absent';

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          class_id: classId || null,
          student_id: studentId,
          date: today,
          status: status,
          recorded_by: userId,
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
  }, [orgId, userId]);

  // Save all attendance changes (batch)
  const saveAttendance = useCallback(async (changes: Record<string, boolean>) => {
    if (!orgId || !userId || isSaving) {
      return;
    }

    try {
      setIsSaving(true);

      // Find students that have changes
      const studentsToSave = students.filter((student) => {
        const currentStatus = changes[student.id] ?? attendance[student.id] ?? false;
        const savedStatus = savedAttendance[student.id] ?? false;
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
        const isPresent = changes[student.id] ?? attendance[student.id] ?? false;
        const classId = student.class_id || (student as any)?.classes?.id || null;
        return {
          student_id: student.id,
          status: isPresent ? ('present' as const) : ('absent' as const),
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
            org_id: orgId,
            records,
            recorded_by: userId,
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
        const isPresent = changes[student.id] ?? attendance[student.id] ?? false;
        const classId = student.class_id || (student as any)?.classes?.id || null;
        return saveAttendanceRecord(student.id, isPresent, classId);
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
  }, [orgId, userId, isSaving, students, attendance, savedAttendance, saveAttendanceRecord]);

  // Update attendance state (optimistic update)
  const updateAttendance = useCallback((studentId: string, isPresent: boolean) => {
    setAttendance((prev) => ({ ...prev, [studentId]: isPresent }));
  }, []);

  // Mark all students as present
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
        newAttendance[s.id] = true;
      });

      return newAttendance;
    });
  }, [students]);

  return {
    attendance,
    savedAttendance,
    isLoading,
    isSaving,
    loadAttendance,
    saveAttendance,
    updateAttendance,
    markAllPresent,
  };
}

