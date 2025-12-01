import { supabaseAdmin } from '@/lib/supabaseClient';

/**
 * Announcement type based on the database schema.
 */
export type Announcement = {
  id: string;
  org_id: string;
  class_id: string | null;
  author_id: string | null;
  title: string;
  body: string | null;
  week_start: string | null;
  is_public: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Error class for announcement service failures.
 * Keeps low-level details server-side while allowing route handlers
 * to map to safe HTTP responses.
 */
export class AnnouncementServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AnnouncementServiceError';
  }
}

function assertSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new AnnouncementServiceError('Announcement service is not configured');
  }
}

type GetLatestAnnouncementsArgs = {
  orgId: string;
  classId?: string;
  isPrincipal?: boolean;
};

/**
 * Get the latest 5 announcements.
 * 
 * - If classId is provided: returns announcements for "all" (class_id IS NULL) or for that specific class
 * - If classId is not provided and user is principal: returns overall latest 5 announcements (no class filter)
 * - Otherwise: returns empty array
 * 
 * @param args - Object containing orgId, optional classId, and optional isPrincipal flag
 * @returns Promise<Announcement[]> - Array of up to 5 latest announcements
 */
export async function getLatestAnnouncements({
  orgId,
  classId,
  isPrincipal = false,
}: GetLatestAnnouncementsArgs): Promise<Announcement[]> {
  assertSupabaseAdmin();

  try {
    let query = supabaseAdmin!
      .from('announcements')
      .select(
        `
        id,
        org_id,
        class_id,
        author_id,
        title,
        body,
        week_start,
        is_public,
        deleted_at,
        created_at,
        updated_at
      `,
      )
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    // If classId is provided, filter for announcements that are either:
    // - For all classes (class_id IS NULL)
    // - For the specific class (class_id = classId)
    if (classId) {
      query = query.or(`class_id.is.null,class_id.eq.${classId}`);
    } else if (!isPrincipal) {
      // If classId is not provided and user is not principal, return empty array
      return [];
    }
    // If classId is not provided and isPrincipal is true, no additional filter needed
    // (query already filtered by org_id and deleted_at, will return all org announcements)

    const { data, error } = await query.returns<Announcement[]>();

    if (error) {
      throw new AnnouncementServiceError('Failed to fetch announcements', error);
    }

    return data ?? [];
  } catch (error) {
    if (error instanceof AnnouncementServiceError) {
      throw error;
    }
    throw new AnnouncementServiceError('Failed to fetch announcements', error);
  }
}

