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

/**
 * Calculate age from date of birth
 */
export function calculateAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  
  try {
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;
    
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Calculate actual age accounting for month and day
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ? age - 1
      : age;
    
    return actualAge >= 0 ? actualAge : null;
  } catch {
    return null;
  }
}

/**
 * Format date to readable string
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return '-';
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Never';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
    if (diffInSeconds < 2592000) {
      const weeks = Math.floor(diffInSeconds / 604800);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    const years = Math.floor(diffInSeconds / 31536000);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  } catch {
    return 'Unknown';
  }
}

/**
 * Mask SSN for display (shows only last 4 digits)
 */
export function maskSSN(ssn: string | null | undefined): string {
  if (!ssn) return 'Not provided';
  if (ssn.length < 4) return '***-**-****';
  return `***-**-${ssn.slice(-4)}`;
}

/**
 * Get initials from name
 */
export function getInitials(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const first = (firstName || '').charAt(0).toUpperCase();
  const last = (lastName || '').charAt(0).toUpperCase();
  return (first + last) || '?';
}

