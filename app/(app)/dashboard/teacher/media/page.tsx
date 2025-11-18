'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Camera, Timer, Users, Bell, MessageSquare, Link as LinkIcon, Utensils, Plus } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar from '@/app/components/shared/TeacherSidebar';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Import translations (same as TeacherDashboard)
const enText = {
  tile_media: 'Media',
  tile_media_desc: 'Upload and manage photos',
  tile_att: 'Attendance',
  tile_att_desc: 'Track student attendance',
  tile_diaper: 'Diapers',
  tile_diaper_desc: 'Log diaper changes',
  tile_msg: 'Messages',
  tile_msg_desc: 'Communicate with parents and staff',
  tile_stories: 'Stories',
  tile_stories_desc: 'Create and share stories',
  tile_announcements: 'Announcements',
  tile_announcements_desc: 'Share announcements',
  tile_students: 'Students',
  tile_students_desc: 'Manage your students',
  tile_guardians: 'Guardians',
  tile_guardians_desc: 'Manage guardians',
  tile_link_student: 'Link Student',
  tile_link_student_desc: 'Link a guardian to a student',
  tile_menus: 'Menus',
  tile_menus_desc: 'Manage daily menus',
  media_title: 'Media',
  upload: 'Upload',
} as const;

const isText = {
  tile_media: 'Miðlar',
  tile_media_desc: 'Hlaða upp og stjórna myndum',
  tile_att: 'Mæting',
  tile_att_desc: 'Fylgstu með mætingu nemenda',
  tile_diaper: 'Bleia',
  tile_diaper_desc: 'Skrá bleiubreytingar',
  tile_msg: 'Skilaboð',
  tile_msg_desc: 'Samið við foreldra og starfsfólk',
  tile_stories: 'Sögur',
  tile_stories_desc: 'Búðu til og deildu sögum',
  tile_announcements: 'Tilkynningar',
  tile_announcements_desc: 'Deildu tilkynningum',
  tile_students: 'Nemendur',
  tile_students_desc: 'Stjórna nemendum',
  tile_guardians: 'Forráðamenn',
  tile_guardians_desc: 'Stjórna forráðamönnum',
  tile_link_student: 'Tengja nemanda',
  tile_link_student_desc: 'Tengdu forráðamann við nemanda',
  tile_menus: 'Matseðlar',
  tile_menus_desc: 'Stjórna daglegum matseðlum',
  media_title: 'Miðlar',
  upload: 'Hlaða upp',
} as const;

export default function TeacherMediaPage() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, isSigningIn } = useRequireAuth('teacher');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Media state
  const [uploads, setUploads] = useState<string[]>([]); // data URLs for image previews

  // Handle file uploads
  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    Array.from(files).slice(0, 12).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setUploads((prev) => [...prev, String(reader.result)]);
      reader.readAsDataURL(file);
    });
  }

  // Define tiles array (excluding media, attendance, diapers, and messages as they're handled separately)
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      { id: 'messages', title: t.tile_msg, desc: t.tile_msg_desc, Icon: MessageSquare, route: '/dashboard/teacher/messages' },
      { id: 'stories', title: t.tile_stories, desc: t.tile_stories_desc, Icon: Timer, route: '/dashboard/teacher?tab=stories' },
      { id: 'announcements', title: t.tile_announcements, desc: t.tile_announcements_desc, Icon: Bell, route: '/dashboard/teacher?tab=announcements' },
      { id: 'students', title: t.tile_students, desc: t.tile_students_desc, Icon: Users, route: '/dashboard/teacher?tab=students' },
      { id: 'guardians', title: t.tile_guardians || 'Guardians', desc: t.tile_guardians_desc || 'Manage guardians', Icon: Users, route: '/dashboard/teacher?tab=guardians' },
      { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon, route: '/dashboard/teacher?tab=link_student' },
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
              Loading media page...
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
            badge: uploads.length > 0 ? uploads.length : undefined,
          }}
          storiesTile={{
            title: t.tile_stories,
            desc: t.tile_stories_desc,
          }}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
            {/* Media Panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.media_title}</h2>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                  <Plus className="h-4 w-4" />
                  {t.upload}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {uploads.length === 0 ? (
                  <div className="col-span-full text-center text-slate-500 dark:text-slate-400">
                    {'No media uploaded yet'}
                  </div>
                ) : (
                  uploads.map((url, idx) => (
                    <div key={idx} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
                      <img src={url} alt={`Upload ${idx + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

