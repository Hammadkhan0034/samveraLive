/**
 * Constants for attendance-related functionality
 */

export const DEFAULT_ORG_ID = '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
} as const;

export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];

export const CACHE_KEYS = {
  TEACHER_CLASSES: 'teacher_classes_cache',
  TEACHER_STUDENTS: 'teacher_students_cache',
} as const;

export const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

