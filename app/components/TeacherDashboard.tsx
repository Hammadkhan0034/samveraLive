'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Users, CalendarDays, Plus, Send, Paperclip, Bell, X, Search, ChevronLeft, ChevronRight, Edit, Trash2, Link as LinkIcon, Mail, Utensils, Menu, Eye, MessageSquarePlus } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { option } from 'framer-motion/client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import StoryColumn from './shared/StoryColumn';
import { MessageThreadWithParticipants, MessageItem } from '@/lib/types/messages';
import { useMessagesRealtime } from '@/lib/hooks/useMessagesRealtime';
import { GuardianTable } from '@/app/components/shared/GuardianTable';
import { GuardianForm, type GuardianFormData } from '@/app/components/shared/GuardianForm';
import LinkStudentGuardian from './LinkStudentGuardian';
import TeacherSidebar from '@/app/components/shared/TeacherSidebar';

type Lang = 'is' | 'en';
type TileId = 'guardians' | 'link_student' | 'menus';

// Small helpers
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}
const uid = () => Math.random().toString(36).slice(2, 9);

export default function TeacherDashboard({ lang = 'en' }: { lang?: Lang }) {
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const [active, setActive] = useState<TileId>('guardians');
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
    if (tabParam && ['guardians', 'link_student', 'menus'].includes(tabParam)) {
      setActive(tabParam as TileId);
    }
  }, [searchParams]);

  // Prefetch routes for instant navigation
  useEffect(() => {
    try {
      router.prefetch('/dashboard/menus-view');
      router.prefetch('/dashboard/menus-list');
      router.prefetch('/dashboard/add-menu');
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

  // Define tiles array
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      { id: 'guardians', title: t.tile_guardians || 'Guardians', desc: t.tile_guardians_desc || 'Manage guardians', Icon: Users },
      { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon },
      { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils },
    ], [t]);



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
              {active === 'guardians' && <GuardiansPanel t={t} lang={lang} orgId={finalOrgId} />}
              {active === 'link_student' && <LinkStudentPanel t={t} lang={lang} />}
              {active === 'menus' && <MenusPanel t={t} lang={lang} orgId={finalOrgId} userId={session?.user?.id} isActive={active === 'menus'} />}
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
// StudentsPanel removed - now in /dashboard/teacher/student page

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
  tile_guardians: 'Guardians',
  tile_guardians_desc: 'Add and manage guardians.',
  tile_media: 'Media',
  tile_media_desc: 'Upload photos & albums.',
  tile_stories: 'Stories (24h)',
  tile_stories_desc: 'Post classroom stories that expire in 24h.',
  tile_announcements: 'Announcements',
  tile_announcements_desc: 'Create and view announcements.',
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
  tile_guardians: 'Forráðamenn',
  tile_guardians_desc: 'Bæta við og sýsla með forráðamenn.',
  tile_media: 'Myndir',
  tile_media_desc: 'Hlaða upp myndum og albúmum.',
  tile_stories: 'Sögur (24 klst)',
  tile_stories_desc: 'Hópsögur sem hverfa eftir 24 klst.',
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
  tile_announcements: 'Tilkynningar',
  tile_announcements_desc: 'Stofna og skoða tilkynningar',
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

// Announcements Panel Component
function MenuPanel({ t, lang }: { t: typeof enText; lang: 'is' | 'en' }) {
  const { session } = useAuth();
  const [menu, setMenu] = useState<{ breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null } | null>(null);
  const [menus, setMenus] = useState<Array<{ breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null; class_name?: string }>>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      if (!session?.user?.id) return;

      try {
        setError(null);
        setMenuLoading(true);

        const orgId = (session?.user?.user_metadata as any)?.org_id as string | undefined;
        const classId = (session?.user?.user_metadata as any)?.class_id as string | undefined;

        if (!orgId) {
          if (isMounted) {
            setMenus([]);
            setMenuLoading(false);
          }
          return;
        }

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        let allMenus: Array<{ class_id?: string | null; class_name?: string; breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null }> = [];

        // Get teacher's assigned classes
        let teacherClasses: Array<{ id: string; name: string }> = [];
        if (session?.user?.id) {
          try {
            const teacherClassesRes = await fetch(`/api/teacher-classes?userId=${session.user.id}&t=${Date.now()}`, { cache: 'no-store' });
            const teacherClassesData = await teacherClassesRes.json();
            teacherClasses = teacherClassesData.classes || [];
          } catch (e) {
            console.error('Error loading teacher classes:', e);
          }
        }

        const teacherClassIds = teacherClasses.map((c: any) => c.id);

        // Fetch menus for each assigned class in parallel - filter by created_by to show only teacher's menus
        const classMenuPromises = (teacherClassIds.length > 0 ? teacherClassIds : (classId ? [classId] : [])).map(async (cid: string) => {
          try {
            const { data: classMenu, error: classMenuErr } = await supabase
              .from('menus')
              .select('class_id,breakfast,lunch,snack,notes,day,created_by')
              .eq('org_id', orgId)
              .eq('class_id', cid)
              .eq('day', todayStr)
              .eq('created_by', session.user.id) // Filter by created_by
              .is('deleted_at', null)
              .maybeSingle();
            
            if (classMenu) {
              const className = teacherClasses.find(c => c.id === cid)?.name || 'Class';
              return {
                ...classMenu,
                class_name: className
              };
            } else if (classMenuErr && classMenuErr.code !== 'PGRST116') {
              console.error(`Error fetching menu for class ${cid}:`, classMenuErr);
              return null;
            }
            return null;
          } catch (e) {
            console.error(`Error fetching menu for class ${cid}:`, e);
            return null;
          }
        });

        // Wait for all class menu queries to complete
        const classMenuResults = await Promise.all(classMenuPromises);
        const validClassMenus = classMenuResults.filter((menu): menu is NonNullable<typeof menu> => menu !== null);
        allMenus.push(...validClassMenus);

        // Also get org-wide menu (class_id null) created by this teacher if exists
        const { data: orgMenu, error: orgMenuErr } = await supabase
          .from('menus')
          .select('class_id,breakfast,lunch,snack,notes,day,created_by')
          .eq('org_id', orgId)
          .is('class_id', null)
          .eq('day', todayStr)
          .eq('created_by', session.user.id) // Filter by created_by
          .is('deleted_at', null)
          .maybeSingle();
        
        if (orgMenu) {
          allMenus.push({
            ...orgMenu,
            class_name: 'All Classes'
          });
        } else if (orgMenuErr && orgMenuErr.code !== 'PGRST116') {
          throw orgMenuErr;
        }

        if (isMounted) {
          setMenus(allMenus);
          setMenuLoading(false);
        }
      } catch (e: any) {
        if (isMounted) {
          setError(e?.message || 'Failed to load menu');
          setMenuLoading(false);
        }
      }
    }

    loadMenu();
    return () => { isMounted = false; };
  }, [session]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t.today_menu || "Today's Menu"}
        </h2>
        <div className="text-sm text-slate-500 dark:text-slate-400" suppressHydrationWarning>
          {mounted ? new Date().toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }) : ''}
        </div>
      </div>
      
      {menuLoading ? (
        <div className="space-y-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      ) : menus.length === 0 ? (
        <div className="text-center py-6">
          <Utensils className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500 mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty_menu}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {menus.map((menu, idx) => (
            <div key={idx} className="space-y-3">
              {menu.class_name && (
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">
                  {menu.class_name}
                </div>
              )}
              {menu.breakfast && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-amber-900 dark:text-amber-100">08:30</div>
                    <div className="text-sm text-amber-700 dark:text-amber-300">{menu.breakfast}</div>
                  </div>
                </div>
              )}
              {menu.lunch && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900 dark:text-blue-100">12:00</div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">{menu.lunch}</div>
                  </div>
                </div>
              )}
              {menu.snack && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-900 dark:text-green-100">14:00</div>
                    <div className="text-sm text-green-700 dark:text-green-300">{menu.snack}</div>
                  </div>
                </div>
              )}
              {menu.notes && (
                <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t.notes || 'Notes'}</div>
                  <div className="text-sm text-slate-700 dark:text-slate-300">{menu.notes}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GuardiansPanel({ t, lang, orgId }: { t: typeof enText; lang: Lang; orgId: string | undefined }) {
  const [guardians, setGuardians] = useState<Array<any>>([]);
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [isDeleteGuardianModalOpen, setIsDeleteGuardianModalOpen] = useState(false);
  const [guardianToDelete, setGuardianToDelete] = useState<string | null>(null);
  const [deletingGuardian, setDeletingGuardian] = useState(false);
  const [submittingGuardian, setSubmittingGuardian] = useState(false);
  const [guardianForm, setGuardianForm] = useState<GuardianFormData>({ first_name: '', last_name: '', email: '', phone: '', org_id: orgId || '', is_active: true });
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string; timezone: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const router = useRouter();

  useEffect(() => {
    if (orgId) {
      loadGuardians();
      loadOrgs();
    }
  }, [orgId]);

  async function loadGuardians() {
    if (!orgId) return;
    try {
      setLoadingGuardians(true);
      setGuardianError(null);
      const res = await fetch(`/api/guardians?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setGuardians(json.guardians || []);
    } catch (e: any) {
      console.error('❌ Error loading guardians:', e.message);
      setGuardianError(e.message);
    } finally {
      setLoadingGuardians(false);
    }
  }

  async function loadOrgs() {
    try {
      const res = await fetch('/api/orgs', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setOrgs(json.orgs || []);
    } catch (e: any) {
      console.error('❌ Error loading organizations:', e.message);
    }
  }

  async function submitGuardian(data: GuardianFormData) {
    try {
      setGuardianError(null);
      setSubmittingGuardian(true);
      const res = await fetch('/api/guardians', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsGuardianModalOpen(false);
      setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', org_id: orgId || '', is_active: true });
      await loadGuardians();
    } catch (e: any) {
      console.error('❌ Error submitting guardian:', e.message);
      setGuardianError(e.message);
    } finally {
      setSubmittingGuardian(false);
    }
  }

  function openCreateGuardianModal() {
    setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', org_id: orgId || '', is_active: true });
    setIsGuardianModalOpen(true);
  }

  function openEditGuardianModal(guardian: any) {
    setGuardianForm({
      id: guardian.id,
      first_name: guardian.first_name ?? ((guardian.full_name || '').split(/\s+/)[0] || ''),
      last_name: guardian.last_name ?? ((guardian.full_name || '').split(/\s+/).slice(1).join(' ') || ''),
      email: guardian.email ?? '',
      phone: guardian.phone ?? '',
      org_id: guardian.org_id || orgId || '',
      is_active: guardian.is_active ?? true
    });
    setIsGuardianModalOpen(true);
  }

  function openDeleteGuardianModal(id: string) {
    setGuardianToDelete(id);
    setIsDeleteGuardianModalOpen(true);
  }

  async function confirmDeleteGuardian() {
    if (!guardianToDelete) return;
    try {
      setGuardianError(null);
      setDeletingGuardian(true);
      const res = await fetch(`/api/guardians?id=${encodeURIComponent(guardianToDelete)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsDeleteGuardianModalOpen(false);
      setGuardianToDelete(null);
      await loadGuardians();
    } catch (e: any) {
      setGuardianError(e.message);
    } finally {
      setDeletingGuardian(false);
    }
  }

  const filteredGuardians = searchQuery ? guardians.filter((g: any) => {
    const q = searchQuery.trim().toLowerCase();
    const first = ((g.first_name ?? ((g.full_name || '').split(/\s+/)[0] || ''))).toLowerCase();
    const last = ((g.last_name ?? (((g.full_name || '').split(/\s+/).slice(1).join(' ')) || ''))).toLowerCase();
    const email = ((g.email || '')).toLowerCase();
    return first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q) || email.includes(q);
  }) : guardians;

  const paginatedGuardians = filteredGuardians.slice((currentPage-1)*itemsPerPage, (currentPage-1)*itemsPerPage + itemsPerPage);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.tile_guardians || 'Guardians'}</h2>
        <button
          onClick={openCreateGuardianModal}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Plus className="h-4 w-4" /> {lang === 'is' ? 'Bæta við forráðamanni' : 'Add Guardian'}
        </button>
      </div>
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          placeholder={lang === 'is' ? 'Leita...' : 'Search guardians...'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        />
      </div>
      <GuardianTable
        guardians={paginatedGuardians.map((g: any) => ({
          id: g.id,
          first_name: g.first_name ?? ((g.full_name || '').trim().split(/\s+/)[0] || ''),
          last_name: g.last_name ?? ((g.full_name || '').trim().split(/\s+/).slice(1).join(' ') || ''),
          email: g.email ?? null,
          phone: g.phone ?? null,
          is_active: g.is_active ?? true,
        }))}
        error={guardianError}
        onEdit={openEditGuardianModal}
        onDelete={openDeleteGuardianModal}
        onCreate={openCreateGuardianModal}
        translations={{
          guardians: t.tile_guardians || 'Guardians',
          first_name: lang === 'is' ? 'Fornafn' : 'First Name',
          last_name: lang === 'is' ? 'Eftirnafn' : 'Last Name',
          email: lang === 'is' ? 'Netfang' : 'Email',
          phone: lang === 'is' ? 'Sími' : 'Phone',
          status: lang === 'is' ? 'Staða' : 'Status',
          active: lang === 'is' ? 'Virkur' : 'Active',
          inactive: lang === 'is' ? 'Óvirkur' : 'Inactive',
          actions: lang === 'is' ? 'Aðgerðir' : 'Actions',
          create: lang === 'is' ? 'Búa til' : 'Create',
          no_guardians: lang === 'is' ? 'Engir forráðamenn' : 'No guardians',
          no_guardians_loading: lang === 'is' ? 'Hleður...' : 'Loading...',
          edit: lang === 'is' ? 'Breyta' : 'Edit',
          delete: lang === 'is' ? 'Eyða' : 'Delete',
          send_magic_link: lang === 'is' ? 'Senda töfraslóð' : 'Send Magic Link',
          sending: lang === 'is' ? 'Sendi...' : 'Sending...',
          magic_link_sent: lang === 'is' ? 'Töfraslóð send' : 'Magic link sent',
          magic_link_send_failed: lang === 'is' ? 'Tókst ekki að senda töfraslóð' : 'Failed to send magic link',
          no_students_linked: lang === 'is' ? 'Engir nemendur tengdir' : 'No students linked',
        }}
      />
      {filteredGuardians.length > itemsPerPage && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {lang === 'is' ? 'Fyrri' : 'Prev'}
          </button>
          <span className="px-3 py-1.5 text-sm">{currentPage} / {Math.ceil(filteredGuardians.length / itemsPerPage)}</span>
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage >= Math.ceil(filteredGuardians.length / itemsPerPage)}
            className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {lang === 'is' ? 'Næsta' : 'Next'}
          </button>
        </div>
      )}
      <GuardianForm
        isOpen={isGuardianModalOpen}
        onClose={() => setIsGuardianModalOpen(false)}
        onSubmit={submitGuardian}
        initialData={guardianForm}
        loading={submittingGuardian}
        error={guardianError}
        orgs={orgs}
        translations={{
          create_guardian: lang === 'is' ? 'Búa til forráðamann' : 'Create Guardian',
          edit_guardian: lang === 'is' ? 'Breyta forráðamanni' : 'Edit Guardian',
          first_name: lang === 'is' ? 'Fornafn' : 'First Name',
          last_name: lang === 'is' ? 'Eftirnafn' : 'Last Name',
          email: lang === 'is' ? 'Netfang' : 'Email',
          phone: lang === 'is' ? 'Sími' : 'Phone',
          organization: lang === 'is' ? 'Stofnun' : 'Organization',
          status: lang === 'is' ? 'Staða' : 'Status',
          active: lang === 'is' ? 'Virkur' : 'Active',
          inactive: lang === 'is' ? 'Óvirkur' : 'Inactive',
          create: lang === 'is' ? 'Búa til' : 'Create',
          update: lang === 'is' ? 'Uppfæra' : 'Update',
          cancel: lang === 'is' ? 'Hætta við' : 'Cancel',
          creating: lang === 'is' ? 'Býr til...' : 'Creating...',
          updating: lang === 'is' ? 'Uppfærir...' : 'Updating...',
          first_name_placeholder: lang === 'is' ? 'Sláðu inn fornafn' : 'Enter first name',
          last_name_placeholder: lang === 'is' ? 'Sláðu inn eftirnafn' : 'Enter last name',
          email_placeholder: lang === 'is' ? 'Sláðu inn netfang' : 'Enter email address',
          phone_placeholder: lang === 'is' ? 'Sláðu inn símanúmer' : 'Enter phone number',
          status_placeholder: lang === 'is' ? 'Veldu stöðu' : 'Select status',
        }}
      />
      <DeleteConfirmationModal
        isOpen={isDeleteGuardianModalOpen}
        onClose={() => setIsDeleteGuardianModalOpen(false)}
        onConfirm={confirmDeleteGuardian}
        title={lang === 'is' ? 'Eyða forráðamanni' : 'Delete Guardian'}
        message={lang === 'is' ? 'Ertu viss um að þú viljir eyða þessum forráðamanni?' : 'Are you sure you want to delete this guardian?'}
        loading={deletingGuardian}
        error={guardianError}
        translations={{
          confirm_delete: lang === 'is' ? 'Eyða' : 'Delete',
          cancel: lang === 'is' ? 'Hætta við' : 'Cancel',
        }}
      />
    </div>
  );
}

function LinkStudentPanel({ t, lang }: { t: typeof enText; lang: Lang }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <LinkStudentGuardian lang={lang} />
    </div>
  );
}

function MenusPanel({ t, lang, orgId, userId, isActive = false }: { t: typeof enText; lang: Lang; orgId: string | undefined; userId: string | undefined; isActive?: boolean }) {
  const [menus, setMenus] = useState<Array<{ id: string; org_id: string; class_id?: string | null; day: string; breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null; created_at?: string; classes?: { id: string; name: string } }>>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState<string | null>(null);
  const [deletingMenu, setDeletingMenu] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<Array<{ id: string; name: string }>>([]);
  const router = useRouter();

  // Load menus ONLY when panel is active
  useEffect(() => {
    if (isActive && orgId && userId) {
      loadMenus();
    }
  }, [isActive, orgId, userId]);

  // Listen for menu updates (when menu is created/edited from add-menu page)
  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;
    
    const handleMenuUpdate = () => {
      // Clear cache and reload
      if (userId) {
        localStorage.removeItem(`teacher_menus_cache_${userId}`);
      }
      if (orgId && userId) {
        loadMenus();
      }
    };
    
    window.addEventListener('menu-updated', handleMenuUpdate);
    
    // Also check localStorage flag on mount
    if (userId) {
      const menuUpdated = localStorage.getItem('menu_data_updated');
      if (menuUpdated === 'true') {
        localStorage.removeItem('menu_data_updated');
        handleMenuUpdate();
      }
    }
    
    return () => {
      window.removeEventListener('menu-updated', handleMenuUpdate);
    };
  }, [isActive, orgId, userId]);

  async function loadMenus() {
    if (!orgId || !userId) return;
    
    // Load cached data first
    if (typeof window !== 'undefined') {
      try {
        const cachedMenus = localStorage.getItem(`teacher_menus_cache_${userId}`);
        const cachedClasses = localStorage.getItem('teacher_classes_cache');
        if (cachedMenus) {
          const parsed = JSON.parse(cachedMenus);
          if (Array.isArray(parsed)) setMenus(parsed);
        }
        if (cachedClasses) {
          const parsed = JSON.parse(cachedClasses);
          if (Array.isArray(parsed)) setTeacherClasses(parsed);
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    
    try {
      setLoadingMenus(true);
      setError(null);
      
      // Load teacher classes (use cache if available)
      let classes: any[] = [];
      if (teacherClasses.length === 0) {
        try {
          const teacherClassesRes = await fetch(`/api/teacher-classes?userId=${userId}&t=${Date.now()}`, { cache: 'no-store' });
          const teacherClassesData = await teacherClassesRes.json();
          classes = teacherClassesData.classes || [];
          setTeacherClasses(classes);
          
          // Cache classes
          if (typeof window !== 'undefined') {
            localStorage.setItem('teacher_classes_cache', JSON.stringify(classes));
          }
        } catch (e: any) {
          console.warn('⚠️ Error loading teacher classes:', e.message);
          // Continue with cached classes if available
          classes = teacherClasses;
        }
      } else {
        classes = teacherClasses;
      }
      
      // Optimize: Use single API call to get all menus for the user
      // Instead of multiple calls per class, fetch all at once
      let allMenus: any[] = [];
      try {
        const res = await fetch(`/api/menus?orgId=${orgId}&createdBy=${userId}`, { cache: 'no-store' });
        const json = await res.json();
        
        if (res.ok && json.menus) {
          allMenus = (json.menus || []).map((m: any) => ({
            ...m,
            classes: m.class_id ? (classes.find((c: any) => c.id === m.class_id) || null) : null
          }));
        } else if (res.status === 429) {
          // Rate limit error
          setError('Too many requests. Please wait a moment and try again.');
          // Use cached data if available
          return;
        } else {
          throw new Error(json.error || `Failed with ${res.status}`);
        }
      } catch (fetchError: any) {
        if (fetchError.message?.includes('rate limit') || fetchError.message?.includes('429')) {
          setError('Request rate limit reached. Please wait a moment and refresh.');
          console.warn('⚠️ Rate limit reached, using cached data');
          return;
        }
        throw fetchError;
      }
      
      setMenus(allMenus);
      
      // Cache menus
      if (typeof window !== 'undefined') {
        localStorage.setItem(`teacher_menus_cache_${userId}`, JSON.stringify(allMenus));
      }
    } catch (e: any) {
      console.error('❌ Error loading menus:', e);
      setError(e.message || 'Failed to load menus');
    } finally {
      setLoadingMenus(false);
    }
  }

  function openDeleteModal(menuId: string) {
    setMenuToDelete(menuId);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  }

  function closeDeleteModal() {
    setIsDeleteModalOpen(false);
    setMenuToDelete(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!menuToDelete) return;
    
    setDeletingMenu(true);
    setDeleteError(null);
    
    try {
      const res = await fetch(`/api/menus?id=${menuToDelete}`, {
        method: 'DELETE',
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || `Failed to delete menu: ${res.status}`);
      }
      
      // Remove from local state
      setMenus(prev => prev.filter(m => m.id !== menuToDelete));
      
      // Update cache
      if (typeof window !== 'undefined') {
        const updatedMenus = menus.filter(m => m.id !== menuToDelete);
        localStorage.setItem(`teacher_menus_cache_${userId}`, JSON.stringify(updatedMenus));
      }
      
      closeDeleteModal();
    } catch (e: any) {
      setDeleteError(e.message);
    } finally {
      setDeletingMenu(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.tile_menus || 'Menus'}</h2>
        <button
          onClick={() => router.push('/dashboard/add-menu')}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Plus className="h-4 w-4" /> {lang === 'is' ? 'Bæta við matseðli' : 'Add Menu'}
        </button>
      </div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}
      {loadingMenus ? (
        <div className="text-center py-8 text-slate-600 dark:text-slate-400">{lang === 'is' ? 'Hleður...' : 'Loading...'}</div>
      ) : menus.length === 0 ? (
        <div className="text-center py-12">
          <Utensils className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-500 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">{lang === 'is' ? 'Engir matseðillar fundust. Smelltu á "Bæta við matseðli" til að búa til einn.' : 'No menus found. Click "Add Menu" to create one.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-black">
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Dagur' : 'Date'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Hópur' : 'Class'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Morgunmatur' : 'Breakfast'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Hádegismatur' : 'Lunch'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Kvöldmatur' : 'Snack'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Athugasemdir' : 'Notes'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {t.actions || 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {menus.map((menu) => (
                <tr key={menu.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-2 px-4 text-sm text-slate-900 dark:text-slate-100">
                    {menu.day ? (
                      <span suppressHydrationWarning>
                        {typeof window !== 'undefined' ? new Date(menu.day).toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : ''}
                      </span>
                    ) : (
                      menu.created_at ? (
                        <span suppressHydrationWarning>
                          {typeof window !== 'undefined' ? new Date(menu.created_at).toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US') : ''}
                        </span>
                      ) : (
                        '—'
                      )
                    )}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {menu.classes?.name || (menu.class_id ? `Class ${menu.class_id.substring(0, 8)}...` : lang === 'is' ? 'Allir hópar' : 'All Classes')}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {menu.breakfast || '—'}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {menu.lunch || '—'}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {menu.snack || '—'}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {menu.notes ? (
                      <span className="line-clamp-2" title={menu.notes}>{menu.notes}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/add-menu?id=${menu.id}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[13px] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        title={t.edit || 'Edit'}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        {t.edit || 'Edit'}
                      </button>
                      <button
                        onClick={() => openDeleteModal(menu.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-[13px] text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        title={t.delete || 'Delete'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t.delete || 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title={lang === 'is' ? 'Eyða matseðli' : 'Delete Menu'}
        message={lang === 'is' ? 'Ertu viss um að þú viljir eyða þessum matseðli? Þessa aðgerð er ekki hægt að afturkalla.' : 'Are you sure you want to delete this menu? This action cannot be undone.'}
        loading={deletingMenu}
        error={deleteError}
        confirmButtonText={t.delete || 'Delete'}
        cancelButtonText={t.cancel || 'Cancel'}
      />
    </div>
  );
}
