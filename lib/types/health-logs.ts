/**
 * Type definitions for health log-related data structures
 */

import type { Student, TeacherClass } from './attendance';

/**
 * Health log type enum matching the database enum
 */
export type HealthLogType = 
  | 'diaper_wet'
  | 'diaper_dirty'
  | 'diaper_mixed'
  | 'temperature'
  | 'medication'
  | 'nap'
  | 'symptom'
  | 'injury'
  | 'meal'
  | 'other';

/**
 * Base HealthLog interface representing a health log entry
 */
export interface HealthLog {
  id: string;
  org_id: string;
  class_id?: string | null;
  student_id: string;
  type: HealthLogType;
  recorded_at: string;
  temperature_celsius?: number | null;
  data: Record<string, unknown>; // JSONB field
  notes?: string | null;
  severity?: number | null; // 1-5
  recorded_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Health log with nested student and class information (used when joined from database)
 */
export interface HealthLogWithRelations extends HealthLog {
  students?: {
    id: string;
    user_id?: string;
    first_name?: string;
    last_name?: string | null;
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
  classes?: TeacherClass | null;
}

/**
 * Form data interface for creating/updating health logs
 */
export interface HealthLogFormData {
  student_id: string;
  type: HealthLogType;
  recorded_at: string; // ISO datetime string
  temperature_celsius?: number | null;
  notes?: string | null;
  severity?: number | null;
  data?: Record<string, unknown>;
}

