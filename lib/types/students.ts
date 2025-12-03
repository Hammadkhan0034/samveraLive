/**
 * Type definitions for student-related data structures
 */

import type { Student, GuardianRelation, StudentClass, StudentUser } from './attendance';

/**
 * Class with assigned teachers (used in students page)
 */
export interface ClassWithTeachers {
  id: string;
  name: string;
  code: string | null;
  assigned_teachers: Array<{
    user_id: string;
    membership_role: string;
  }>;
}

/**
 * Student with all nested relations (used in students page and table)
 * Extends the base Student type to ensure nested relations are properly typed
 */
export interface StudentWithRelations extends Student {
  // Nested relations are already in Student but we ensure they're properly typed
  classes?: StudentClass;
  guardians?: GuardianRelation[];
  users?: StudentUser;
}

/**
 * Filter option for dropdowns
 */
export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Student form data structure used in StudentForm component
 */
export interface StudentFormData {
  id?: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  class_id: string;
  medical_notes: string;
  allergies: string;
  emergency_contact: string;
  guardian_ids: string[];
  phone: string;
  address: string;
  registration_time: string;
  start_date: string;
  barngildi: number;
  student_language: string;
  social_security_number: string;
}

