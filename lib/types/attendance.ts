/**
 * Type definitions for attendance-related data structures
 */

export interface TeacherClass {
  id: string;
  name: string;
  code?: string | null;
}

export interface StudentUser {
  id: string;
  first_name: string;
  last_name: string | null;
  dob: string | null;
  gender: string;
  phone?: string | null;
  address?: string | null;
  ssn?: string | null;
}

export interface StudentClass {
  id: string;
  name: string;
}

export interface GuardianRelation {
  id: string;
  relation: string;
  guardian_id?: string;
  student_id?: string;
  users?: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string;
  };
}

export interface Student {
  id: string;
  user_id?: string;
  class_id: string | null;
  first_name: string;
  last_name: string | null;
  dob: string | null;
  gender: string;
  created_at: string;
  updated_at?: string | null;
  // Nested data from API joins
  users?: StudentUser;
  classes?: StudentClass;
  guardians?: GuardianRelation[];
  // Additional fields that may be present
  registration_time?: string | null;
  start_date?: string | null;
  barngildi?: number | null;
  student_language?: string | null;
  medical_notes_encrypted?: string | null;
  allergies_encrypted?: string | null;
  emergency_contact_encrypted?: string | null;
}

export interface AttendanceRecord {
  id: string;
  org_id: string;
  class_id: string | null;
  student_id: string;
  date: string;
  status: 'absent' | 'late' | 'excused' | 'arrived' | 'away_holiday' | 'away_sick' | 'gone';
  notes?: string | null;
  recorded_by?: string | null;
  left_at?: string | null;
  created_at: string;
  updated_at?: string;
  // Nested data from API joins
  students?: {
    id: string;
    user_id: string;
    users?: {
      id: string;
      first_name: string;
      last_name: string | null;
    };
    classes?: {
      id: string;
      name: string;
    };
  };
}

export interface AttendanceState {
  attendance: Record<string, string>;
  savedAttendance: Record<string, string>;
  isSaving: boolean;
}

export interface BatchAttendanceRecord {
  student_id: string;
  status: 'absent' | 'late' | 'excused' | 'arrived' | 'away_holiday' | 'away_sick' | 'gone';
  date: string;
  class_id?: string | null;
  notes?: string | null;
  left_at?: string | null;
}

