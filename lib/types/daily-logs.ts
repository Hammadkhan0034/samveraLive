/**
 * Type definitions for daily log-related data structures
 */

import type { TeacherClass } from './attendance';

/**
 * Daily log kind enum
 */
export type DailyLogKind = 'arrival' | 'meal' | 'sleep' | 'activity' | 'note';

/**
 * Base DailyLog interface representing a daily log entry
 */
export interface DailyLog {
  id: string;
  org_id: string;
  class_id?: string | null;
  kind: DailyLogKind;
  recorded_at: string;
  created_by?: string | null;
  creator_name: string;
  image?: string | null;
  public: boolean;
  deleted_at?: string | null;
  updated_at: string;
  note?: string | null;
}

/**
 * DailyLog with nested class and user information (used when joined from database)
 */
export interface DailyLogWithRelations extends DailyLog {
  classes?: TeacherClass | null;
  users?: {
    id: string;
    first_name: string;
    last_name: string | null;
    email?: string | null;
  } | null;
}

/**
 * Form data for creating/editing an activity log
 */
export interface ActivityLogFormData {
  class_id?: string | null;
  recorded_at: string;
  note: string;
  image?: string | null;
  public?: boolean;
}

/**
 * Payload for creating a daily log entry
 */
export type CreateDailyLogPayload = {
  class_id?: string | null;
  kind: DailyLogKind;
  recorded_at: string;
  note?: string | null;
  image?: string | null;
  public?: boolean;
};

/**
 * Payload for updating a daily log entry
 */
export type UpdateDailyLogPayload = {
  id: string;
  class_id?: string | null;
  recorded_at?: string;
  note?: string | null;
  image?: string | null;
  public?: boolean;
};

/**
 * Arguments for fetching daily logs, used by the handler's service layer
 */
export type FetchDailyLogsArgs = {
  orgId: string;
  userId: string;
  isTeacher: boolean;
  classId?: string;
  date?: string;
  kind?: DailyLogKind;
};

