import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseClient';

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author_id: string;
  class_id?: string | null;
  class_name?: string | null;
}

interface AnnouncementListServerProps {
  classId?: string;
  orgId?: string;
  userId?: string;
  userRole?: string;
  showAuthor?: boolean;
  limit?: number;
  lang?: 'is' | 'en';
}

const enText = {
  failed_to_load: 'Failed to load announcements',
  no_announcements: 'No announcements yet.',
  class_announcements_note: 'Class announcements will appear here.',
  org_announcements_note: 'Organization announcements will appear here.',
  by: 'By',
  class_announcement: 'Class Announcement',
  organization_wide: 'Organization-wide',
};

const isText = {
  failed_to_load: 'Mistókst að hlaða tilkynningum',
  no_announcements: 'Engar tilkynningar enn.',
  class_announcements_note: 'Tilkynningar hóps munu birtast hér.',
  org_announcements_note: 'Tilkynningar stofnunar munu birtast hér.',
  by: 'Eftir',
  class_announcement: 'Tilkynning hóps',
  organization_wide: 'Alla stofnunina',
};

export default async function AnnouncementListServer({
  classId,
  orgId,
  userId,
  userRole,
  showAuthor = false,
  limit = 5,
  lang = 'en',
}: AnnouncementListServerProps) {
  const t = lang === 'is' ? isText : enText;

  if (!orgId) {
    return (
      <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6 text-center">
        <p className="text-gray-600 dark:text-slate-400">{t.no_announcements}</p>
      </div>
    );
  }

  try {
    const supabase = supabaseAdmin || await createSupabaseServer();

    // Build query - simplified for server component (show latest 5 org-wide or class-specific)
    let query = supabase
      .from('announcements')
      .select('id,title,body,created_at,author_id,class_id,classes(id,name)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by org_id if available
    if (orgId) {
      // Try to filter by org_id, but if column doesn't exist, filter by class_id or show all
      try {
        query = query.eq('org_id', orgId);
      } catch {
        // If org_id column doesn't exist, continue without it
      }
    }

    // Filter by class if provided
    if (classId) {
      query = query.or(`class_id.eq.${classId},class_id.is.null`);
    } else {
      // Show only org-wide announcements if no classId
      query = query.is('class_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading announcements:', error);
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{t.failed_to_load}</p>
        </div>
      );
    }

    const announcements: Announcement[] = (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      created_at: row.created_at,
      author_id: row.author_id,
      class_id: row.class_id ?? undefined,
      class_name: row.classes?.name || null,
    }));

    if (announcements.length === 0) {
      return (
        <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-slate-400">{t.no_announcements}</p>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            {classId ? t.class_announcements_note : t.org_announcements_note}
          </p>
        </div>
      );
    }

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    // Get org name if needed
    let orgName: string | null = null;
    if (orgId) {
      try {
        const { data: orgData } = await supabase
          .from('orgs')
          .select('name')
          .eq('id', orgId)
          .maybeSingle();
        orgName = orgData?.name || null;
      } catch {
        // Ignore errors fetching org name
      }
    }

    return (
      <div className="space-y-4">
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {announcement.title}
              </h3>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {formatDate(announcement.created_at)}
              </span>
            </div>

            <p className="text-gray-700 dark:text-slate-300 mb-3 whitespace-pre-wrap">
              {announcement.body}
            </p>

            <div className="flex justify-between items-center text-sm text-gray-500 dark:text-slate-400">
              <div className="flex items-center space-x-4">
                {announcement.class_id ? (
                  <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full text-xs">
                    {announcement.class_name || t.class_announcement}
                  </span>
                ) : (
                  <span className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-2 py-1 rounded-full text-xs">
                    {orgName || t.organization_wide}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  } catch (err: any) {
    console.error('Error in AnnouncementListServer:', err);
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">{t.failed_to_load}</p>
      </div>
    );
  }
}

