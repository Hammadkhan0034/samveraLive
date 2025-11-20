import type { Student } from '@/lib/types/attendance';

/**
 * Get student's full name from various possible data structures
 * Handles nested users object from API responses
 */
export function getStudentName(student: Student): string {
  const firstName = student.users?.first_name || student.first_name || '';
  const lastName = student.users?.last_name || student.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || 'Unknown';
}

/**
 * Get class name for a student
 */
export function getClassName(
  classId: string | null,
  classes: Array<{ id: string; name: string }>
): string {
  if (!classId) return 'No Class';
  const classInfo = classes.find(c => c.id === classId);
  return classInfo?.name || `Class ${classId.substring(0, 8)}...`;
}

