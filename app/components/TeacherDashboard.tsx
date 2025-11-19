'use client';
import React, { useState, useEffect, useRef } from 'react';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Users, CalendarDays, Plus, Send, Paperclip, Bell, X, Search, ChevronLeft, ChevronRight, Edit, Trash2, Mail, Menu, Eye, MessageSquarePlus } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import TeacherSidebar from '@/app/components/shared/TeacherSidebar';
import { useLanguage } from '@/lib/contexts/LanguageContext';

type TileId = never;

// Small helpers
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}
const uid = () => Math.random().toString(36).slice(2, 9);

export default function TeacherDashboard() {
  const { t, lang } = useLanguage();
  const [active, setActive] = useState<TileId | null>(null);
  const { session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Set active tab from query parameter
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    // No tabs available in TeacherDashboard anymore
    if (tabParam) {
      // Redirect to appropriate page if needed
      if (tabParam === 'menus') {
        router.replace('/dashboard/teacher/menus');
      } else if (tabParam === 'link_student') {
        router.replace('/dashboard/teacher/link-student');
      } else if (tabParam === 'guardians') {
        router.replace('/dashboard/teacher/guardians');
      }
    }
  }, [searchParams, router]);

  // Prefetch routes for instant navigation
  useEffect(() => {
    try {
      router.prefetch('/dashboard/teacher/menus');
      router.prefetch('/dashboard/teacher/link-student');
      router.prefetch('/dashboard/teacher/guardians');
      router.prefetch('/dashboard/teacher/messages');
    } catch {}
  }, [router]);

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
  
  // Final org_id to use - from metadata, database, or default
  const finalOrgId = orgIdFromMetadata || dbOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

  // Messages count for sidebar badge
  const [messagesCount, setMessagesCount] = useState(0);

  // Define tiles array - empty since all functionality moved to separate pages
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = [];



  // Load messages count for KPI badge - only when messages tab is active or on initial mount
  async function loadMessagesForKPI() {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`/api/messages?userId=${session.user.id}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.threads) {
        const unreadCount = json.threads.filter((t: any) => t.unread).length;
        setMessagesCount(unreadCount);
      }
    } catch (error) {
      console.error('Error loading messages count:', error);
    }
  }

  // Load messages count for sidebar badge
  React.useEffect(() => {
    if (session?.user?.id) {
      loadMessagesForKPI();
    }
  }, [session?.user?.id]);


  return (
    <div className="flex flex-col h-screen overflow-hidden md:pt-14">
      {/* Main content area with sidebar and content - starts below navbar */}
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <TeacherSidebar
          activeTile={active}
          onTileClick={(tileId) => setActive(tileId as TileId)}
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
            badge: messagesCount > 0 ? messagesCount : undefined,
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
          menusTile={{
            title: t.tile_menus,
            desc: t.tile_menus_desc,
          }}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
            {/* Content Header */}
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  aria-label="Toggle sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <ProfileSwitcher />
                <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <CalendarDays className="h-4 w-4" />
                  <span>{t.today_hint}</span>
                </div>
              </div>
            </div>
            {/* Active panel */}
            
            <section>
              {/* All functionality moved to separate pages */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-slate-600 dark:text-slate-400 text-center py-8">
                  {lang === 'is' ? 'Veldu síðu úr valmyndinni til vinstri' : 'Select a page from the sidebar menu'}
                </p>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

