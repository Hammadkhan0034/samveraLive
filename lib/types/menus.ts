/**
 * Type definitions for menu-related data structures
 */

import type { TeacherClass } from './attendance';

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

