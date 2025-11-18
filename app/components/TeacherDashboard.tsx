'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Users, CalendarDays, Plus, Send, Paperclip, Bell, X, Search, ChevronLeft, ChevronRight, Edit, Trash2, Mail, Menu, Eye, MessageSquarePlus } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import { option } from 'framer-motion/client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import StoryColumn from './shared/StoryColumn';
import { MessageThreadWithParticipants, MessageItem } from '@/lib/types/messages';
import { useMessagesRealtime } from '@/lib/hooks/useMessagesRealtime';
import TeacherSidebar from '@/app/components/shared/TeacherSidebar';

type Lang = 'is' | 'en';
type TileId = never;

// Small helpers
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}
const uid = () => Math.random().toString(36).slice(2, 9);

export default function TeacherDashboard({ lang = 'en' }: { lang?: Lang }) {
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
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
  }> = useMemo(() => [], [t]);



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

/* -------------------- Panels -------------------- */

// MessagesPanel removed - now in /dashboard/teacher/messages page
// MediaPanel removed - now in /dashboard/teacher/media page
// StoriesPanel removed - now in /dashboard/teacher/stories page
// AnnouncementsPanel removed - now in /dashboard/teacher/announcements page
// StudentsPanel removed - now in /dashboard/teacher/students page
// GuardiansPanel removed - now in /dashboard/teacher/guardians page

/* -------------------- Copy -------------------- */

const enText = {
  title: 'Teacher Dashboard',
  kids_checked_in: 'Children checked in',
  today_hint: 'Today · Demo data',
  child: 'Child',
  time: 'Time',
  notes: 'Notes',
  save: 'Save',
  saved: 'Saved',
  today_menu: "Today's Menu",
  empty_menu: 'No menu available for today',

  // Tiles
  tile_att: 'Attendance',
  tile_att_desc: 'Mark in/out and late arrivals.',
  tile_diaper: 'Diapers & Health',
  tile_diaper_desc: 'Log diapers, naps, meds & temperature.',
  tile_msg: 'Messages',
  tile_msg_desc: 'Direct messages and announcements.',
  tile_media: 'Media',
  tile_media_desc: 'Upload photos & albums.',
  tile_stories: 'Stories (24h)',
  tile_stories_desc: 'Post classroom stories that expire in 24h.',
  tile_announcements: 'Announcements',
  tile_announcements_desc: 'Create and view announcements.',
  tile_students: 'Students',
  tile_students_desc: 'Manage your students',
  tile_guardians: 'Guardians',
  tile_guardians_desc: 'Manage guardians',
  tile_link_student: 'Link Student',
  tile_link_student_desc: 'Link a guardian to a student.',
  tile_menus: 'Menus',
  tile_menus_desc: 'Manage daily menus.',

  // Attendance
  att_title: 'Attendance & Check-in',
  att_mark_all_in: 'Mark all present',

  // Diapers/Health
  di_title: 'Diapers & Health Log',
  di_hint: 'Quickly capture diapers, naps, meds and temperature.',
  di_type: 'Type',
  di_wet: 'Wet',
  di_dirty: 'Dirty',
  di_mixed: 'Mixed',
  di_notes_ph: 'Optional notes…',

  // Messages
  msg_title: 'Messages',
  msg_hint: 'Parents and staff can receive updates here.',
  inbox: 'Inbox',
  unread: 'new',
  sample_msg: 'Hi! Just a reminder to bring rain gear tomorrow ☔',
  new_message: 'New message',
  to: 'To',
  message: 'Message',
  msg_ph: 'Write a friendly update…',
  send: 'Send',
  attach: 'Attach',
  sent: 'Sent',
  no_threads: 'No messages yet',
  no_messages: 'No messages in this thread',
  select_recipient: 'Select recipient',
  search_placeholder: 'Search conversations...',
  principal: 'Principal',
  guardian: 'Guardian',

  // Media
  media_title: 'Photos & Albums',
  upload: 'Upload',

  // Stories
  stories_title: 'Class Stories (24h)',
  add_story: 'Add story',
  add: 'Add',
  stories_hint:
    'Stories are only visible to guardians of enrolled children in this class and expire after 24 hours.',
  col_title: 'Title',
  col_scope: 'Scope',
  col_caption: 'Caption',
  no_caption: 'No Caption Added',
  view: 'View',
  delete_story: 'Delete Story',
  delete_story_confirm: 'Are you sure you want to delete this story? This action cannot be undone.',
  class_label: 'Class',
  org_wide: 'Organization-wide',
  loading_stories: 'Loading stories…',
  empty_stories: 'No stories yet.',

  // Announcements
  announcements_title: 'Announcements',
  announcements_list: 'Class Announcements',

  // Common (kept for other panels)
  guardians: 'Guardians',
  cancel: 'Cancel',
  loading: 'Loading...',
  actions: 'Actions',
  edit: 'Edit',
  delete: 'Delete',
};

const isText = {
  title: 'Kennarayfirlit',
  kids_checked_in: 'Börn skráð inn',
  today_hint: 'Í dag · Sýnagögn',
  child: 'Barn',
  time: 'Tími',
  notes: 'Athugasemdir',
  save: 'Vista',
  saved: 'Vistað',
  today_menu: 'Matseðill dagsins',
  empty_menu: 'Enginn matseðill tiltækur fyrir daginn',

  // Tiles
  tile_att: 'Mæting',
  tile_att_desc: 'Skrá inn/út og seinkun.',
  tile_diaper: 'Bleyjur & Heilsa',
  tile_diaper_desc: 'Skrá bleyjur, svefn, lyf og hita.',
  tile_msg: 'Skilaboð',
  tile_msg_desc: 'Bein skilaboð og tilkynningar.',
  tile_media: 'Myndir',
  tile_media_desc: 'Hlaða upp myndum og albúmum.',
  tile_stories: 'Sögur (24 klst)',
  tile_stories_desc: 'Hópsögur sem hverfa eftir 24 klst.',
  tile_announcements: 'Tilkynningar',
  tile_announcements_desc: 'Stofna og skoða tilkynningar',
  tile_students: 'Nemendur',
  tile_students_desc: 'Stjórna nemendum',
  tile_guardians: 'Forráðamenn',
  tile_guardians_desc: 'Stjórna forráðamönnum',
  tile_link_student: 'Tengja nemanda',
  tile_link_student_desc: 'Tengja forráðamann við nemanda.',
  tile_menus: 'Matseðillar',
  tile_menus_desc: 'Sýsla með daglega matseðla.',

  // Attendance
  att_title: 'Mæting & Inn-/útstimplun',
  att_mark_all_in: 'Skrá alla inn',

  // Diapers/Health
  di_title: 'Bleyju- og heilsuskráning',
  di_hint: 'Hraðskráning fyrir bleyjur, svefn, lyf og hita.',
  di_type: 'Tegund',
  di_wet: 'Vot',
  di_dirty: 'Skítug',
  di_mixed: 'Blanda',
  di_notes_ph: 'Valfrjálsar athugasemdir…',

  // Messages
  msg_title: 'Skilaboð',
  msg_hint: 'Foreldrar og starfsfólk fá uppfærslur hér.',
  inbox: 'Innhólf',
  unread: 'ný',
  sample_msg: 'Hæ! Vinsamlegast munið eftir regnfötum á morgun ☔',
  new_message: 'Ný skilaboð',
  to: 'Til',
  message: 'Skilaboð',
  msg_ph: 'Skrifaðu vingjarnlega uppfærslu…',
  send: 'Senda',
  attach: 'Hengja við',
  sent: 'Sent',
  no_threads: 'Engin skilaboð enn',
  no_messages: 'Engin skilaboð í þessum þræði',
  select_recipient: 'Veldu viðtakanda',
  search_placeholder: 'Leita í samtalum...',
  principal: 'Stjórnandi',
  guardian: 'Forráðamaður',

  // Media
  media_title: 'Myndir & Albúm',
  upload: 'Hlaða upp',

  // Stories
  stories_title: 'Hópsögur (24 klst)',
  add_story: 'Bæta við sögu',
  add: 'Bæta við',
  stories_hint:
    'Sögur eru einungis sýnilegar forráðafólki barna í hópnum og hverfa eftir 24 klst.',
  col_title: 'Titill',
  col_scope: 'Svið',
  col_caption: 'Lýsing',
  no_caption: 'Engin lýsing bætt við',
  view: 'Skoða',
  delete_story: 'Eyða sögu',
  delete_story_confirm: 'Ertu viss um að þú viljir eyða þessari sögu? Þessa aðgerð er ekki hægt að afturkalla.',
  class_label: 'Hópur',
  org_wide: 'Stofnunarvítt',
  loading_stories: 'Hleður sögum…',
  empty_stories: 'Engar sögur fundust.',

  // Announcements
  announcements_title: 'Tilkynningar',
  announcements_list: 'Tilkynningar hóps',

  // Common (kept for other panels)
  guardians: 'Forráðamenn',
  cancel: 'Hætta við',
  loading: 'Hleður...',
  actions: 'Aðgerðir',
  edit: 'Breyta',
  delete: 'Eyða',
};

