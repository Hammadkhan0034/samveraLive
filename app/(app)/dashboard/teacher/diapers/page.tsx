'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Camera, Timer, Users, CalendarDays, Plus, Send, Paperclip, Bell, X, Search, ChevronLeft, ChevronRight, Edit, Trash2, Link as LinkIcon, Mail, Utensils, Menu } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Small helpers
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function TeacherDiapersPage() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isSigningIn } = useRequireAuth('teacher');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Show loading state while checking authentication
  if (loading || (isSigningIn && !user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading diapers page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Define tiles array
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      { id: 'attendance', title: t.tile_att, desc: t.tile_att_desc, Icon: CheckSquare, route: '/dashboard/teacher/attendance' },
      { id: 'diapers', title: t.tile_diaper, desc: t.tile_diaper_desc, Icon: Baby, route: '/dashboard/teacher/diapers' },
      { id: 'messages', title: t.tile_msg, desc: t.tile_msg_desc, Icon: MessageSquare, route: '/dashboard/teacher' },
      { id: 'media', title: t.tile_media, desc: t.tile_media_desc, Icon: Camera, route: '/dashboard/teacher' },
      { id: 'stories', title: t.tile_stories, desc: t.tile_stories_desc, Icon: Timer, route: '/dashboard/teacher' },
      { id: 'announcements', title: t.tile_announcements, desc: t.tile_announcements_desc, Icon: Bell, route: '/dashboard/teacher' },
      { id: 'students', title: t.tile_students, desc: t.tile_students_desc, Icon: Users, route: '/dashboard/teacher' },
      { id: 'guardians', title: t.tile_guardians || 'Guardians', desc: t.tile_guardians_desc || 'Manage guardians', Icon: Users, route: '/dashboard/teacher' },
      { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon, route: '/dashboard/teacher' },
      { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils, route: '/dashboard/teacher' },
    ], [t]);

  // Determine active tile based on pathname
  const activeTile = pathname === '/dashboard/teacher/diapers' ? 'diapers' : null;

  // Safety check: if user is still not available after loading, don't render
  // (useRequireAuth hook should have redirected by now)
  if (!loading && !isSigningIn && !user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden md:pt-14">
      {/* Main content area with sidebar and content - starts below navbar */}
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <aside
          className={clsx(
            'flex-shrink-0 w-72 bg-slate-900 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto transition-transform duration-300 ease-in-out',
            sidebarOpen 
              ? 'fixed top-14 bottom-0 left-0 z-50 translate-x-0 md:relative md:top-0 md:translate-x-0' 
              : 'fixed top-14 bottom-0 left-0 z-50 -translate-x-full md:relative md:top-0 md:translate-x-0'
          )}
        >
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between md:hidden">
              <h2 className="text-lg font-semibold text-slate-100 dark:text-slate-100">Menu</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 text-slate-200 dark:text-slate-300"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {/* Attendance tile */}
              <button
                onClick={() => {
                  router.push('/dashboard/teacher/attendance');
                  setSidebarOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                  'hover:bg-slate-800 dark:hover:bg-slate-700',
                  pathname === '/dashboard/teacher/attendance'
                    ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                    : 'border-l-4 border-transparent'
                )}
              >
                <span className={clsx(
                  'flex-shrink-0 rounded-lg p-2',
                  pathname === '/dashboard/teacher/attendance'
                    ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                    : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
                )}>
                  <CheckSquare className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={clsx(
                      'font-medium truncate',
                      pathname === '/dashboard/teacher/attendance'
                        ? 'text-slate-100 dark:text-slate-100'
                        : 'text-slate-200 dark:text-slate-300'
                    )}>
                      {t.tile_att}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_att_desc}</p>
                </div>
              </button>
              {tiles.map(({ id, title, desc, Icon, badge, route }) => (
                <button
                  key={id}
                  onClick={() => {
                    if (route) {
                      router.push(route);
                    }
                    setSidebarOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                    'hover:bg-slate-800 dark:hover:bg-slate-700',
                    activeTile === id
                      ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                      : 'border-l-4 border-transparent'
                  )}
                >
                  <span className={clsx(
                    'flex-shrink-0 rounded-lg p-2',
                    activeTile === id
                      ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                      : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
                  )}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={clsx(
                        'font-medium truncate',
                        activeTile === id
                          ? 'text-slate-100 dark:text-slate-100'
                          : 'text-slate-200 dark:text-slate-300'
                      )}>
                        {title}
                      </span>
                      {badge !== undefined && badge !== null && badge !== 0 && (
                        <span className="flex-shrink-0 rounded-full bg-slate-700 dark:bg-slate-600 px-2 py-0.5 text-xs font-medium text-slate-100 dark:text-slate-300" suppressHydrationWarning>
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed top-14 bottom-0 left-0 right-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

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
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.di_title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <ProfileSwitcher />
              </div>
            </div>
            
            {/* Diapers Panel */}
            <section>
              <DiaperPanel t={t} />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

/* -------------------- Diapers Panel -------------------- */

function DiaperPanel({ t }: { t: typeof enText }) {
  const [child, setChild] = useState('');
  const [kind, setKind] = useState<'wet' | 'dirty' | 'mixed'>('wet');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    // mock save
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    setChild('');
    setKind('wet');
    setTime('');
    setNotes('');
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.di_title}</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t.di_hint}</p>

      <form onSubmit={save} className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm text-slate-700 dark:text-slate-300">
          {t.child}
          <input
            value={child}
            onChange={(e) => setChild(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            placeholder={`${t.child} 1`}
            required
          />
        </label>
        <label className="text-sm text-slate-700 dark:text-slate-300">
          {t.di_type}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <option value="wet">{t.di_wet}</option>
            <option value="dirty">{t.di_dirty}</option>
            <option value="mixed">{t.di_mixed}</option>
          </select>
        </label>
        <label className="text-sm text-slate-700 dark:text-slate-300">
          {t.time}
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            required
          />
        </label>
        <label className="text-sm md:col-span-3 text-slate-700 dark:text-slate-300">
          {t.notes}
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            placeholder={t.di_notes_ph}
          />
        </label>
        <div className="md:col-span-3 flex items-center gap-3">
          <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">
            {t.save}
          </button>
          {saved && <span className="text-sm text-emerald-700 dark:text-emerald-400">✓ {t.saved}</span>}
        </div>
      </form>
    </div>
  );
}

/* -------------------- Translations -------------------- */

const enText = {
  title: 'Teacher Dashboard',
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
  tile_students: 'Students',
  tile_students_desc: 'Manage student requests and enrollment.',
  di_title: 'Diapers & Health Log',
  di_hint: 'Quickly capture diapers, naps, meds and temperature.',
  di_type: 'Type',
  di_wet: 'Wet',
  di_dirty: 'Dirty',
  di_mixed: 'Mixed',
  di_notes_ph: 'Optional notes…',
  child: 'Child',
  time: 'Time',
  notes: 'Notes',
  save: 'Save',
  saved: 'Saved',
};

const isText = {
  title: 'Kennarayfirlit',
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
  tile_announcements: 'Tilkynningar',
  tile_announcements_desc: 'Stofna og skoða tilkynningar',
  tile_link_student: 'Tengja nemanda',
  tile_link_student_desc: 'Tengja forráðamann við nemanda.',
  tile_menus: 'Matseðillar',
  tile_menus_desc: 'Sýsla með daglega matseðla.',
  tile_students: 'Nemendur',
  tile_students_desc: 'Sýsla með beiðnir nemenda og skráningu.',
  di_title: 'Bleyju- og heilsuskráning',
  di_hint: 'Hraðskráning fyrir bleyjur, svefn, lyf og hita.',
  di_type: 'Tegund',
  di_wet: 'Vot',
  di_dirty: 'Skítug',
  di_mixed: 'Blanda',
  di_notes_ph: 'Valfrjálsar athugasemdir…',
  child: 'Barn',
  time: 'Tími',
  notes: 'Athugasemdir',
  save: 'Vista',
  saved: 'Vistað',
};

