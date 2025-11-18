'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Timer, Users, MessageSquare, Camera, Link as LinkIcon, Utensils } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar from '@/app/components/shared/TeacherSidebar';
import LinkStudentGuardian from '@/app/components/LinkStudentGuardian';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Import translations
const enText = {
  tile_announcements: 'Announcements',
  tile_announcements_desc: 'Share announcements',
  tile_stories: 'Stories',
  tile_stories_desc: 'Create and share stories',
  tile_media: 'Media',
  tile_media_desc: 'Upload and manage photos',
  tile_att: 'Attendance',
  tile_att_desc: 'Track student attendance',
  tile_diaper: 'Diapers',
  tile_diaper_desc: 'Log diaper changes',
  tile_msg: 'Messages',
  tile_msg_desc: 'Communicate with parents and staff',
  tile_students: 'Students',
  tile_students_desc: 'Manage your students',
  tile_guardians: 'Guardians',
  tile_guardians_desc: 'Manage guardians',
  tile_link_student: 'Link Student',
  tile_link_student_desc: 'Link a guardian to a student',
  tile_menus: 'Menus',
  tile_menus_desc: 'Manage daily menus',
  link_student_title: 'Link Guardian to Student',
} as const;

const isText = {
  tile_announcements: 'Tilkynningar',
  tile_announcements_desc: 'Deildu tilkynningum',
  tile_stories: 'Sögur',
  tile_stories_desc: 'Búðu til og deildu sögum',
  tile_media: 'Miðlar',
  tile_media_desc: 'Hlaða upp og stjórna myndum',
  tile_att: 'Mæting',
  tile_att_desc: 'Fylgstu með mætingu nemenda',
  tile_diaper: 'Bleia',
  tile_diaper_desc: 'Skrá bleiubreytingar',
  tile_msg: 'Skilaboð',
  tile_msg_desc: 'Samið við foreldra og starfsfólk',
  tile_students: 'Nemendur',
  tile_students_desc: 'Stjórna nemendum',
  tile_guardians: 'Forráðamenn',
  tile_guardians_desc: 'Stjórna forráðamönnum',
  tile_link_student: 'Tengja nemanda',
  tile_link_student_desc: 'Tengdu forráðamann við nemanda',
  tile_menus: 'Matseðlar',
  tile_menus_desc: 'Stjórna daglegum matseðlum',
  link_student_title: 'Tengja forráðamann við nemanda',
} as const;

export default function TeacherLinkStudentPage() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, isSigningIn } = useRequireAuth('teacher');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Try to get org_id from multiple possible locations
  const userMetadata = session?.user?.user_metadata;
  const orgIdFromMetadata = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  
  // If no org_id in metadata, we need to get it from the database
  const [dbOrgId, setDbOrgId] = useState<string | null>(null);
  
  // Fetch org_id from database if not in metadata
  useEffect(() => {
    if (session?.user?.id && !orgIdFromMetadata) {
      const fetchUserOrgId = async () => {
        try {
          const response = await fetch(`/api/user-org-id?user_id=${session.user.id}`);
          const data = await response.json();
          if (response.ok && data.org_id) {
            setDbOrgId(data.org_id);
          }
        } catch (error) {
          console.error('Failed to fetch user org_id:', error);
        }
      };
      fetchUserOrgId();
    }
  }, [session?.user?.id, orgIdFromMetadata]);
  
  // Final org_id to use
  const finalOrgId = orgIdFromMetadata || dbOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

  // Define tiles array (excluding link_student as it's handled separately)
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils, route: '/dashboard/teacher?tab=menus' },
    ], [t]);

  // Show loading state while checking authentication
  if (authLoading || (isSigningIn && !user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading link student page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Safety check: if user is still not available after loading, don't render
  if (!authLoading && !isSigningIn && !user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden md:pt-14">
      <div className="flex flex-1 overflow-hidden h-full">
        <TeacherSidebar
          sidebarOpen={sidebarOpen}
          onSidebarClose={() => setSidebarOpen(false)}
          tiles={tiles}
          pathname={pathname}
          attendanceTile={{
            title: t.tile_att,
            desc: t.tile_att_desc,
          }}
          diapersTile={{
            title: t.tile_diaper,
            desc: t.tile_diaper_desc,
          }}
          messagesTile={{
            title: t.tile_msg,
            desc: t.tile_msg_desc,
          }}
          mediaTile={{
            title: t.tile_media,
            desc: t.tile_media_desc,
          }}
          storiesTile={{
            title: t.tile_stories,
            desc: t.tile_stories_desc,
          }}
          announcementsTile={{
            title: t.tile_announcements,
            desc: t.tile_announcements_desc,
          }}
          studentsTile={{
            title: t.tile_students,
            desc: t.tile_students_desc,
          }}
          guardiansTile={{
            title: t.tile_guardians,
            desc: t.tile_guardians_desc,
          }}
          linkStudentTile={{
            title: t.tile_link_student,
            desc: t.tile_link_student_desc,
          }}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
            {/* Link Student Panel */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <LinkStudentGuardian lang={lang} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

