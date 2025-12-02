/**
 * Type definitions for announcement-related data structures
 */

/**
 * Transformed announcement shape returned by the announcements handler.
 * Includes a denormalized `class_name` alongside the base announcement fields.
 */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author_id: string;
  class_id: string | null;
  class_name: string | null;
}


