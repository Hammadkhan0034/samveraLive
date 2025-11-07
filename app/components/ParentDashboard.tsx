'use client';
import React, { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeatureGrid, { FeatureItem } from '@/app/components/FeatureGrid';
import { Bell, CalendarDays, MessageSquare, Camera, Utensils, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/hooks/useAuth';
import AnnouncementList from './AnnouncementList';
import StoryColumn from './shared/StoryColumn';

type Lang = 'is' | 'en';

export default function ParentDashboard({ lang = 'en' }: { lang?: Lang }) {
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { session } = useAuth();
  const router = useRouter();
  
  // Prefetch menu routes for instant navigation
  useEffect(() => {
    router.prefetch('/dashboard/menus-view');
    router.prefetch('/dashboard/stories');
  }, [router]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; body: string | null; created_at: string }>>([]);
  const [menu, setMenu] = useState<{ breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null } | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedStudents, setLinkedStudents] = useState<Array<{ id: string; first_name: string; last_name: string | null; email: string | null; classes?: { name: string }; class_id?: string | null }>>([]);
  const [derivedClassId, setDerivedClassId] = useState<string | null>(null);
  const [displayStudent, setDisplayStudent] = useState<{ name: string; className?: string } | null>(null);
  const [menusForStudents, setMenusForStudents] = useState<Array<{ studentName: string; className?: string; menu: { breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null } }>>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadLinkedStudentsAndDerive() {
      if (!session?.user?.id) return;

      const orgId = (session?.user?.user_metadata as any)?.org_id as string | undefined;
      const classId = (session?.user?.user_metadata as any)?.class_id as string | undefined;
      const guardianId = session?.user?.id;

      if (!orgId || !guardianId) return;

      // Instant: hydrate from cache to avoid UI delay
      try {
        if (typeof window !== 'undefined') {
          const studentsKey = `parent_students_${guardianId}`;
          const cached = localStorage.getItem(studentsKey);
          if (cached) {
            const parsed = JSON.parse(cached) as Array<{ id: string; first_name: string; last_name: string | null; email: string | null; classes?: { name: string }; class_id?: string | null }>;
            if (Array.isArray(parsed)) {
              setLinkedStudents(parsed);
              const effClassIdCached = classId || (parsed.find((s: { class_id?: string | null }) => !!s.class_id)?.class_id || null);
              setDerivedClassId(effClassIdCached);
              const firstCached = parsed[0];
              if (firstCached) setDisplayStudent({ name: `${firstCached.first_name} ${firstCached.last_name || ''}`.trim(), className: firstCached.classes?.name });
            }
          }
        }
      } catch {}

      try {
        const studentsRes = await fetch(`/api/guardian-students?guardianId=${guardianId}`);
        if (studentsRes.ok) {
          const studentsData = await studentsRes.json();
          const relationships = studentsData.relationships || [];
          const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);

          if (studentIds.length > 0) {
            const studentsDetailsRes = await fetch(`/api/students?orgId=${orgId}`);
            if (studentsDetailsRes.ok) {
              const studentsDetails = await studentsDetailsRes.json();
              const allStudents = studentsDetails.students || [];
              const linked = allStudents
                .filter((s: any) => studentIds.includes(s.id))
                .map((s: any) => ({
                  id: s.id,
                  first_name: s.users?.first_name || s.first_name || '',
                  last_name: s.users?.last_name || s.last_name || null,
                  email: s.users?.email || null,
                  classes: s.classes || null,
                  class_id: s.class_id || s.classes?.id || null,
                }));

              if (isMounted) {
                setLinkedStudents(linked);
                // Cache for instant load next time
                try { if (typeof window !== 'undefined') localStorage.setItem(`parent_students_${guardianId}`, JSON.stringify(linked)); } catch {}
                // Prefer metadata class_id; else use first linked student's class
                const effClassId = classId || (linked.find((s: { class_id?: string | null }) => !!s.class_id)?.class_id || null);
                setDerivedClassId(effClassId);
                const first = linked[0];
                if (first) setDisplayStudent({ name: `${first.first_name} ${first.last_name || ''}`.trim(), className: first.classes?.name });
              }
            }
          } else {
            if (isMounted) {
              setLinkedStudents([]);
              setDerivedClassId(classId || null);
              setDisplayStudent(null);
              try { if (typeof window !== 'undefined') localStorage.removeItem(`parent_students_${guardianId}`); } catch {}
            }
          }
        }
      } catch (e) {
        if (isMounted) {
          setLinkedStudents([]);
          setDerivedClassId(classId || null);
          setDisplayStudent(null);
        }
      }
    }

    loadLinkedStudentsAndDerive();

    return () => {
      isMounted = false;
    };
  }, [session]);

  // Fetch today's menu after class is derived
  useEffect(() => {
    let isMounted = true;

    async function loadMenuByPriority() {
      if (!session?.user?.id) return;

      try {
        setError(null);
        setMenuLoading(true);

        const orgId = (session?.user?.user_metadata as any)?.org_id as string | undefined;
        if (!orgId) {
          if (isMounted) {
            setMenu(null);
            setMenusForStudents([]);
            setMenuLoading(false);
          }
          return;
        }

        const guardianId = session.user.id;
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        // Instant: hydrate menu from cache
        try {
          if (typeof window !== 'undefined') {
            const menuKey = `parent_menu_${guardianId}_${todayStr}`;
            const cached = localStorage.getItem(menuKey);
            if (cached) {
              const parsed = JSON.parse(cached) as { perStudentMenus?: Array<{ studentName: string; className?: string; menu: any }>; menuData?: any; displayStudent?: { name: string; className?: string } };
              if (parsed.perStudentMenus) setMenusForStudents(parsed.perStudentMenus);
              if (parsed.menuData) setMenu(parsed.menuData);
              if (parsed.displayStudent) setDisplayStudent(parsed.displayStudent);
            }
          }
        } catch {}

        let menuData: any = null;
        let menuErr: any = null;
        let chosenStudentForMenu: { name: string; className?: string } | null = null;

        // Build menus for all linked students' classes
        const perStudentMenus: Array<{ studentName: string; className?: string; menu: any }> = [];
        for (const s of linkedStudents) {
          const cid = s.class_id;
          if (!cid) continue;
          const { data: classMenu, error: classMenuErr } = await supabase
            .from('menus')
            .select('breakfast,lunch,snack,notes,day')
            .eq('org_id', orgId)
            .eq('class_id', cid)
            .eq('day', todayStr)
            .is('deleted_at', null)
            .maybeSingle();
          if (classMenu) {
            perStudentMenus.push({
              studentName: `${s.first_name} ${s.last_name || ''}`.trim(),
              className: s.classes?.name,
              menu: classMenu,
            });
            if (!menuData) {
              menuData = classMenu;
              chosenStudentForMenu = { name: `${s.first_name} ${s.last_name || ''}`.trim(), className: s.classes?.name };
            }
          } else if (classMenuErr && classMenuErr.code !== 'PGRST116') { menuErr = classMenuErr; break; }
        }

        // Fallback to org-wide if no class menu found
        if (!menuData && !menuErr) {
          const { data: orgMenu, error: orgMenuErr } = await supabase
            .from('menus')
            .select('breakfast,lunch,snack,notes,day')
            .eq('org_id', orgId)
            .is('class_id', null)
            .eq('day', todayStr)
            .is('deleted_at', null)
            .maybeSingle();
          if (orgMenu) {
            menuData = orgMenu;
            const first = linkedStudents[0];
            if (first) chosenStudentForMenu = { name: `${first.first_name} ${first.last_name || ''}`.trim(), className: first.classes?.name };
          } else if (orgMenuErr && orgMenuErr.code !== 'PGRST116') {
            menuErr = orgMenuErr;
          }
        }

        if (menuErr) throw menuErr;

        if (isMounted) {
          setMenu(menuData || null);
          setMenusForStudents(perStudentMenus);
          if (chosenStudentForMenu) {
            setDisplayStudent(chosenStudentForMenu);
          } else if (!menuData) {
            const first = linkedStudents[0];
            if (first) setDisplayStudent({ name: `${first.first_name} ${first.last_name || ''}`.trim(), className: first.classes?.name });
          }
          // Cache for instant load next time
          try {
            if (typeof window !== 'undefined') localStorage.setItem(`parent_menu_${guardianId}_${todayStr}`, JSON.stringify({ perStudentMenus, menuData, displayStudent: chosenStudentForMenu }));
          } catch {}
          setMenuLoading(false);
        }
      } catch (e: any) {
        if (isMounted) {
          setError(e?.message || 'Failed to load data');
          setMenuLoading(false);
        }
      }
    }

    loadMenuByPriority();

    return () => { isMounted = false; };
  }, [session, derivedClassId, linkedStudents]);

  const items: FeatureItem[] = [
    { href: '/notices', title: t.notices, desc: t.notices_desc, Icon: Bell },
    { href: '/calendar', title: t.calendar, desc: t.calendar_desc, Icon: CalendarDays },
    { href: '/messages', title: t.messages, desc: t.messages_desc, Icon: MessageSquare, badge: 2 },
    { href: '/media', title: t.media, desc: t.media_desc, Icon: Camera },
    { href: '#', title: t.stories, desc: t.stories_desc, Icon: FileText },
    { href: '#', title: t.menu, desc: t.menu_desc, Icon: Utensils },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 mt-10">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t.title}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {t.welcome_message}
        </p>
      </div>

      {/* Stories Column */}
      <StoryColumn
        lang={lang}
        orgId={(session?.user?.user_metadata as any)?.org_id}
        userId={session?.user?.id}
        userRole="parent"
        parentClassIds={linkedStudents.map(s => s.class_id).filter(Boolean) as string[]}
      />

      {/* Shared FeatureGrid for tiles */}
      <div className="mt-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, idx) => {
            if (item.href === '#' && (item.title === t.menu || item.title === t.stories)) {
              // Custom menu tile with onClick - navigate to menus view page
              return (
                <button
                  key={idx}
                  onClick={() => {
                    // Instant navigation - prefetch if not already done
                    if (item.title === t.menu) {
                      router.prefetch('/dashboard/menus-view');
                      router.push('/dashboard/menus-view');
                    } else {
                      router.prefetch('/dashboard/stories');
                      router.push('/dashboard/stories');
                    }
                  }}
                  className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow dark:border-slate-700 dark:bg-slate-800 text-left w-full"
                >
                  <div className="mb-4 flex items-center gap-3">
                    {item.Icon ? (
                      <span className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700">
                        <item.Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                      </span>
                    ) : null}
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </div>
                    </div>
                  </div>
                  {item.desc ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  ) : null}
                </button>
              );
            }
            // Regular tiles with Link
            return (
              <a
                key={idx}
                href={item.href}
                className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="mb-4 flex items-center gap-3">
                  {item.Icon ? (
                    <span className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700">
                      <item.Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                    </span>
                  ) : null}
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </div>
                    {item.badge !== undefined ? (
                      <span className="ml-auto rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                </div>
                {item.desc ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                ) : null}
              </a>
            );
          })}
        </div>
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
              userId={session?.user?.id}
              userRole={(session?.user?.user_metadata as any)?.role || (session?.user?.user_metadata as any)?.activeRole || 'parent'}
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
            <div className="text-sm text-slate-500 dark:text-slate-400" suppressHydrationWarning>
              {mounted ? new Date().toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }) : ''}
            </div>
          </div>
          {displayStudent && (
            <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              {displayStudent.name}{displayStudent.className ? ` · ${displayStudent.className}` : ''}
            </div>
          )}
          
          {error ? (
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

        {/* Linked Students Table */}
        {linkedStudents.length > 0 && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-md font-medium text-slate-900 dark:text-slate-100 mb-3">{t.my_students || 'My Students'}</h3>
            <div className="overflow-x-auto rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black text-white dark:bg-slate-800">
                    <th className="text-left py-2 px-4">{t.student_name || 'Name'}</th>
                    <th className="text-left py-2 px-4">{t.student_class || 'Class'}</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedStudents.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700">
                      <td className="py-2 px-4 text-slate-900 dark:text-slate-100">{s.first_name} {s.last_name || ''}</td>
                      <td className="py-2 px-4 text-slate-600 dark:text-slate-300">{s.classes?.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Linked Students Section */}
      {false && linkedStudents.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            {t.my_students || 'My Students'}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {linkedStudents.map((student) => (
              <div key={student.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {student.first_name} {student.last_name || ''}
                    </div>
                    {student.classes?.name && (
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {student.classes.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
  stories: 'Stories',
  stories_desc: 'View school and class stories.',
  menu: 'Menu',
  menu_desc: 'View today\'s menu and meal schedule.',
  menu_title: "Today's Menu",
  class_feed: 'Class feed',
  today: "Today's schedule",
  empty_menu: 'No menu available for today',
  breakfast: 'Breakfast',
  outdoor: 'Outdoor play',
  lunch: 'Lunch',
  snack: 'Snack',
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
  my_students: 'My Students',
  student_name: 'Name',
  student_class: 'Class',
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
  stories: 'Sögur',
  stories_desc: 'Skoða sögur skólans og hópsins.',
  menu: 'Matseðill',
  menu_desc: 'Skoða matseðil dagsins og máltíma.',
  menu_title: 'Matseðill dagsins',
  class_feed: 'Flæði hóps',
  today: 'Dagskrá dagsins',
  empty_menu: 'Enginn matseðill fyrir daginn',
  breakfast: 'Morgunmatur',
  outdoor: 'Útivera',
  lunch: 'Hádegismatur',
  snack: 'Snakk',
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
  my_students: 'Nemendur mínir',
  student_name: 'Nafn',
  student_class: 'Klasi',
};
