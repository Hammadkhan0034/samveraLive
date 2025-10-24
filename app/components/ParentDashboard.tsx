'use client';
import React, { useMemo, useEffect, useState } from 'react';
import FeatureGrid, { FeatureItem } from '@/app/components/FeatureGrid';
import { Bell, CalendarDays, MessageSquare, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/hooks/useAuth';
import AnnouncementList from './AnnouncementList';

type Lang = 'is' | 'en';

export default function ParentDashboard({ lang = 'en' }: { lang?: Lang }) {
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { session } = useAuth();

  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; body: string | null; created_at: string }>>([]);
  const [menu, setMenu] = useState<{ breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const orgId = (session?.user?.user_metadata as any)?.org_id as string | undefined;
        const classId = (session?.user?.user_metadata as any)?.class_id as string | undefined;

        // Guard: require org scope at minimum
        if (!orgId) {
          if (isMounted) {
            setAnnouncements([]);
            setMenu(null);
            setLoading(false);
          }
          return;
        }

        // Announcements: latest 5 scoped to class (if available) else org
        const annQuery = supabase
          .from('announcements')
          .select('id,title,body,created_at')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(5);
        const { data: annData, error: annErr } = classId
          ? await annQuery.eq('class_id', classId)
          : await annQuery;
        if (annErr) throw annErr;

        // Today menu: org + optional class on today
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`; // ISO date (YYYY-MM-DD)

        const menuQuery = supabase
          .from('menus')
          .select('breakfast,lunch,snack,notes,day')
          .eq('org_id', orgId)
          .eq('day', todayStr)
          .limit(1)
          .single();
        const { data: menuData, error: menuErr } = classId
          ? await supabase
              .from('menus')
              .select('breakfast,lunch,snack,notes,day')
              .eq('org_id', orgId)
              .eq('class_id', classId)
              .eq('day', todayStr)
              .limit(1)
              .maybeSingle()
          : await menuQuery;
        if (menuErr && menuErr.code !== 'PGRST116') throw menuErr; // ignore no rows

        if (isMounted) {
          setAnnouncements(annData || []);
          setMenu(menuData || null);
        }
      } catch (e: any) {
        if (isMounted) setError(e?.message || 'Failed to load data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [session]);

  const items: FeatureItem[] = [
    { href: '/notices', title: t.notices, desc: t.notices_desc, Icon: Bell },
    { href: '/calendar', title: t.calendar, desc: t.calendar_desc, Icon: CalendarDays },
    { href: '/messages', title: t.messages, desc: t.messages_desc, Icon: MessageSquare, badge: 2 },
    { href: '/media', title: t.media, desc: t.media_desc, Icon: Camera },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t.title}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {t.welcome_message}
        </p>
      </div>

      {/* Shared FeatureGrid for tiles */}
      <div className="mt-6">
        <FeatureGrid items={items} />
      </div>

      {/* Feed + Schedule */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Class Feed Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.class_feed}
            </h2>
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          </div>
          <div className="mt-3">
            <AnnouncementList 
              classId={(session?.user?.user_metadata as any)?.class_id}
              orgId={(session?.user?.user_metadata as any)?.org_id}
              showAuthor={false}
              limit={3}
              lang={lang}
            />
          </div>
        </div>

        {/* Today's Schedule Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.today}
            </h2>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {new Date().toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
          
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
              <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          ) : !menu ? (
            <div className="text-center py-6">
              <div className="text-slate-400 dark:text-slate-500 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty_menu}</p>
            </div>
          ) : (
            <div className="space-y-3">
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
                <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t.notes}</div>
                  <div className="text-sm text-slate-700 dark:text-slate-300">{menu.notes}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {t.quick_actions}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.contact_teacher}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.contact_teacher_desc}</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.view_calendar}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.view_calendar_desc}</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.send_message}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.send_message_desc}</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <Camera className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.view_photos}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.view_photos_desc}</div>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}

/* ---------------- Copy ---------------- */

const enText = {
  title: 'Parent Dashboard',
  welcome_message: 'Stay connected with your child\'s learning journey',
  notices: 'Notices',
  notices_desc: 'Announcements and reminders from your child\'s class.',
  calendar: 'Calendar',
  calendar_desc: 'Upcoming events, trips and menus.',
  messages: 'Messages',
  messages_desc: 'Direct messages with staff.',
  media: 'Photos',
  media_desc: 'Albums shared with your class.',
  class_feed: 'Class feed',
  today: "Today's schedule",
  empty_menu: 'No menu available for today',
  breakfast: 'Breakfast',
  outdoor: 'Outdoor play',
  lunch: 'Lunch',
  nap: 'Nap time',
  feed1: 'Photos from outdoor time were added',
  feed2: 'Reminder: Bring rain gear tomorrow',
  feed3: 'Allergy note updated for Arnar',
  notes: 'Notes',
  quick_actions: 'Quick Actions',
  contact_teacher: 'Contact Teacher',
  contact_teacher_desc: 'Send a message to your child\'s teacher',
  view_calendar: 'View Calendar',
  view_calendar_desc: 'See upcoming events and activities',
  send_message: 'Send Message',
  send_message_desc: 'Message the school staff',
  view_photos: 'View Photos',
  view_photos_desc: 'Browse shared photos and albums',
};

const isText = {
  title: 'Foreldrasvæði',
  welcome_message: 'Vertu tengdur við námsferil barnsins þíns',
  notices: 'Tilkynningar',
  notices_desc: 'Tilkynningar og áminningar frá hópnum.',
  calendar: 'Dagatal',
  calendar_desc: 'Komandi viðburðir, ferðir og matseðlar.',
  messages: 'Skilaboð',
  messages_desc: 'Bein skilaboð við starfsfólk.',
  media: 'Myndir',
  media_desc: 'Albúm deilt með hópnum.',
  class_feed: 'Flæði hóps',
  today: 'Dagskrá dagsins',
  empty_menu: 'Enginn matseðill fyrir daginn',
  breakfast: 'Morgunmatur',
  outdoor: 'Útivera',
  lunch: 'Hádegismatur',
  nap: 'Hvíld',
  feed1: 'Bætt var við myndum úr útiveru',
  feed2: 'Áminning: Regnföt á morgun',
  feed3: 'Ofnæmisathugasemd uppfærð fyrir Arnar',
  notes: 'Athugasemdir',
  quick_actions: 'Flýtiaðgerðir',
  contact_teacher: 'Hafa samband við kennara',
  contact_teacher_desc: 'Sendu skilaboð til kennara barnsins þíns',
  view_calendar: 'Skoða dagatal',
  view_calendar_desc: 'Sjá komandi viðburði og starfsemi',
  send_message: 'Senda skilaboð',
  send_message_desc: 'Skilaboð til starfsmanna skólans',
  view_photos: 'Skoða myndir',
  view_photos_desc: 'Fletta í deildum myndum og albúmum',
};
