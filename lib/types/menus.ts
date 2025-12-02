/**
 * Type definitions for menu-related data structures
 */

import type { TeacherClass } from './attendance';

/**
 * Payload for creating or upserting a menu entry.
 * Mirrors the shape expected by the menus handler and Supabase `menus` table.
 */
export type UpsertMenuPayload = {
  class_id?: string | null;
  day: string;
  breakfast?: string | null;
  lunch?: string | null;
  snack?: string | null;
  notes?: string | null;
  is_public?: boolean;
  created_by?: string;
};

/**
 * Payload for updating an existing menu entry by id.
 */
export type UpdateMenuPayload = {
  id: string;
  breakfast?: string | null;
  lunch?: string | null;
  snack?: string | null;
  notes?: string | null;
  is_public?: boolean;
};

/**
 * Arguments for fetching menus, used by the menus handler's service layer.
 */
export type FetchMenusArgs = {
  orgId: string;
  userId: string;
  isTeacher: boolean;
  classId?: string;
  day?: string;
};

/**
 * Base Menu interface representing a menu entry
 */
export interface Menu {
  id: string;
  org_id: string;
  class_id?: string | null;
  day: string;
  breakfast?: string | null;
  lunch?: string | null;
  snack?: string | null;
  notes?: string | null;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Menu with nested class information (used when classes are joined from database)
 */
export interface MenuWithClass extends Menu {
  classes?: TeacherClass | null;
}

