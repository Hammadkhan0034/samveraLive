'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeatureGrid, { FeatureItem } from '@/app/components/FeatureGrid';
import { Bell, CalendarDays, MessageSquare, Camera, Utensils, FileText, ClipboardCheck, Baby } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/hooks/useAuth';
import { useNotifications } from '@/lib/hooks/useNotifications';
import AnnouncementList from './AnnouncementList';
import StoryColumn from './shared/StoryColumn';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';

export default function ParentDashboard() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();
  
  // Get notifications
  const userId = session?.user?.id || null;
  const orgId = session?.user?.user_metadata?.org_id || 
                session?.user?.user_metadata?.organization_id || 
                null;
  useNotifications({
    userId,
    orgId,
    enabled: !!userId && !!orgId,
  });
  
  // Prefetch routes for instant navigation
  useEffect(() => {
    router.prefetch('/dashboard/menus-view');
    router.prefetch('/dashboard/stories');
    router.prefetch('/dashboard/attendance');
    router.prefetch('/dashboard/parent/messages');
    router.prefetch('/dashboard/parent/calendar');
    router.prefetch('/dashboard/parent/diapers');
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
  const [attendanceData, setAttendanceData] = useState<Array<{ studentId: string; studentName: string; className?: string; status: string; date: string }>>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [healthLogsCount, setHealthLogsCount] = useState(0);
  const [loadingHealthLogs, setLoadingHealthLogs] = useState(false);
  
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
        let studentsRes: Response;
        try {
          studentsRes = await fetch(`/api/guardian-students?guardianId=${guardianId}`);
        } catch (fetchError: any) {
          // Handle network errors
          console.error('❌ Network error fetching guardian-students:', fetchError);
          if (isMounted) {
            setLinkedStudents([]);
            setDerivedClassId(classId || null);
            setDisplayStudent(null);
          }
          return;
        }
        
        if (!studentsRes.ok) {
          const errorData = await studentsRes.json().catch(() => ({}));
          console.error('❌ Failed to fetch guardian-students:', studentsRes.status, errorData);
          if (isMounted) {
            setLinkedStudents([]);
            setDerivedClassId(classId || null);
            setDisplayStudent(null);
          }
          return;
        }
        
        const studentsData = await studentsRes.json();
        const relationships = studentsData.relationships || [];
        const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);
        console.log('📋 Found linked student IDs:', studentIds);

        if (studentIds.length > 0) {
          let studentsDetailsRes: Response;
          try {
            studentsDetailsRes = await fetch(`/api/students?orgId=${orgId}`);
          } catch (fetchError: any) {
            // Handle network errors
            console.error('❌ Network error fetching students:', fetchError);
            if (isMounted) {
              setLinkedStudents([]);
              setDerivedClassId(classId || null);
              setDisplayStudent(null);
            }
            return;
          }
          
          if (!studentsDetailsRes.ok) {
            const errorData = await studentsDetailsRes.json().catch(() => ({}));
            console.error('❌ Failed to fetch students:', studentsDetailsRes.status, errorData);
            if (isMounted) {
              setLinkedStudents([]);
              setDerivedClassId(classId || null);
              setDisplayStudent(null);
            }
            return;
          }
          
          const studentsDetails = await studentsDetailsRes.json();
          const allStudents = studentsDetails.students || [];
          console.log('📋 Total students fetched:', allStudents.length);
          
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

          console.log('📋 Linked students after filtering:', linked.length, linked);
          
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
        } else {
          console.log('📋 No linked students found');
          if (isMounted) {
            setLinkedStudents([]);
            setDerivedClassId(classId || null);
            setDisplayStudent(null);
            try { if (typeof window !== 'undefined') localStorage.removeItem(`parent_students_${guardianId}`); } catch {}
          }
        }
      } catch (e: any) {
        console.error('❌ Error loading linked students:', e);
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

  // Load attendance for linked students
  useEffect(() => {
    let isMounted = true;

    async function loadAttendance() {
      if (!session?.user?.id || linkedStudents.length === 0) {
        if (isMounted) {
          setAttendanceData([]);
        }
        return;
      }

      try {
        setLoadingAttendance(true);
        const orgId = (session?.user?.user_metadata as any)?.org_id as string | undefined;
        if (!orgId) {
          if (isMounted) {
            setAttendanceData([]);
            setLoadingAttendance(false);
          }
          return;
        }

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        // Fetch attendance for all linked students
        const attendancePromises = linkedStudents.map(async (student) => {
          try {
            const response = await fetch(
              `/api/attendance?orgId=${orgId}&studentId=${student.id}&date=${todayStr}&t=${Date.now()}`,
              { cache: 'no-store' }
            );
            if (response.ok) {
              const data = await response.json();
              // Check if attendance array exists and has records
              if (data.attendance && Array.isArray(data.attendance) && data.attendance.length > 0) {
                // Find the record for today's date
                const record = data.attendance.find((r: any) => r.date === todayStr) || data.attendance[0];
                return {
                  studentId: student.id,
                  studentName: `${student.first_name} ${student.last_name || ''}`.trim(),
                  className: student.classes?.name,
                  status: record?.status || 'not_recorded',
                  date: todayStr,
                };
              }
            }
            // If no attendance found, return not_recorded
            return {
              studentId: student.id,
              studentName: `${student.first_name} ${student.last_name || ''}`.trim(),
              className: student.classes?.name,
              status: 'not_recorded',
              date: todayStr,
            };
          } catch (error) {
            console.error(`Error fetching attendance for student ${student.id}:`, error);
            return {
              studentId: student.id,
              studentName: `${student.first_name} ${student.last_name || ''}`.trim(),
              className: student.classes?.name,
              status: 'not_recorded',
              date: todayStr,
            };
          }
        });

        const results = await Promise.all(attendancePromises);
        if (isMounted) {
          setAttendanceData(results);
          setLoadingAttendance(false);
        }
      } catch (error: any) {
        console.error('Error loading attendance:', error);
        if (isMounted) {
          setAttendanceData([]);
          setLoadingAttendance(false);
        }
      }
    }

    loadAttendance();

    return () => { isMounted = false; };
  }, [session, linkedStudents]);

  const [messagesCount, setMessagesCount] = useState(0);

  // Load messages count
  useEffect(() => {
    if (!session?.user?.id) return;

    async function loadMessagesCount() {
      try {
        if (!session?.user?.id) return;
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

    loadMessagesCount();
    // Refresh every 30 seconds
    const interval = setInterval(loadMessagesCount, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  // Load health logs count for linked students
  useEffect(() => {
    let isMounted = true;

    async function loadHealthLogsCount() {
      if (!session?.user?.id || linkedStudents.length === 0) {
        if (isMounted) {
          setHealthLogsCount(0);
        }
        return;
      }

      try {
        setLoadingHealthLogs(true);
        const response = await fetch(`/api/health-logs?t=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          const healthLogs = data.healthLogs || [];
          // Filter to only show logs for linked students
          const linkedStudentIds = linkedStudents.map(s => s.id);
          const filteredLogs = healthLogs.filter((log: any) => 
            log.student_id && linkedStudentIds.includes(log.student_id)
          );
          if (isMounted) {
            setHealthLogsCount(filteredLogs.length);
          }
        } else {
          if (isMounted) {
            setHealthLogsCount(0);
          }
        }
      } catch (error) {
        console.error('Error loading health logs count:', error);
        if (isMounted) {
          setHealthLogsCount(0);
        }
      } finally {
        if (isMounted) {
          setLoadingHealthLogs(false);
        }
      }
    }

    loadHealthLogsCount();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, linkedStudents]);

  const items: FeatureItem[] = [
    { href: '/notices', title: t.notices, desc: t.notices_desc, Icon: Bell },
    { href: '/dashboard/parent/messages', title: t.messages, desc: t.messages_desc, Icon: MessageSquare, badge: messagesCount > 0 ? messagesCount : undefined },
    { href: '/dashboard/parent/media', title: t.media, desc: t.media_desc, Icon: Camera },
    { href: '#', title: t.stories, desc: t.stories_desc, Icon: FileText },
    { href: '#', title: t.menu, desc: t.menu_desc, Icon: Utensils },
    { href: '#', title: t.attendance, desc: t.attendance_desc, Icon: ClipboardCheck },
    { href: '#', title: t.di_title || 'Diapers & Health', desc: t.di_hint || 'View health logs for your child', Icon: Baby },
  ];


  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Welcome Section */}
      <div className="mb-8 mt-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t.parent_dashboard_title}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {t.parent_dashboard_subtitle}
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
          {/* Calendar Card - Same design as Teacher Dashboard KPI */}
          <button
            onClick={() => {
              router.prefetch('/dashboard/parent/calendar');
              router.push('/dashboard/parent/calendar');
            }}
            className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 dark:border-slate-700 dark:bg-slate-800 text-left w-full cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t.calendar || 'Calendar'}
              </div>
              <span className="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                <CalendarDays className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              </span>
            </div>
            {t.calendar_desc ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.calendar_desc}
              </p>
            ) : null}
          </button>
          {items.map((item, idx) => {
            if (item.href === '#' && (item.title === t.menu || item.title === t.stories || item.title === t.attendance || item.title === (t.di_title || 'Diapers & Health'))) {
              // Custom menu/stories/attendance/diapers tile with onClick
              const getRoute = () => {
                if (item.title === t.menu) return '/dashboard/menus-view';
                if (item.title === t.stories) return '/dashboard/stories';
                if (item.title === t.attendance) return '/dashboard/attendance';
                if (item.title === (t.di_title || 'Diapers & Health')) return '/dashboard/parent/diapers';
                return '#';
              };
              return (
                <button
                  key={idx}
                  onClick={() => {
                    // Instant navigation - prefetch if not already done
                    if (item.title === t.menu) {
                      router.prefetch('/dashboard/menus-view');
                      router.push('/dashboard/menus-view');
                    } else if (item.title === t.stories) {
                      router.prefetch('/dashboard/stories');
                      router.push('/dashboard/stories');
                    } else if (item.title === t.attendance) {
                      router.prefetch('/dashboard/attendance');
                      router.push('/dashboard/attendance');
                    } else if (item.title === (t.di_title || 'Diapers & Health')) {
                      router.prefetch('/dashboard/parent/diapers');
                      router.push('/dashboard/parent/diapers');
                    }
                  }}
                  className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 dark:border-slate-700 dark:bg-slate-800 text-left w-full cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {item.title}
                    </div>
                    {item.Icon ? (
                      <span className="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                        <item.Icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                      </span>
                    ) : null}
                  </div>
                  {item.desc ? (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  ) : null}
                </button>
              );
            }
            // Regular tiles with Link
            return (
              <button
                key={idx}
                onClick={() => {
                  if (item.href && item.href !== '#') {
                    router.push(item.href);
                  }
                }}
                className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 dark:border-slate-700 dark:bg-slate-800 text-left w-full cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {item.title}
                    {item.badge !== undefined ? (
                      <span className="ml-2 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                  {item.Icon ? (
                    <span className="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                      <item.Icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                    </span>
                  ) : null}
                </div>
                {item.desc ? (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                ) : null}
              </button>
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

        {/* Attendance Card */}
        {linkedStudents.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t.attendance_title || 'Today\'s Attendance'}
              </h2>
              <div className="text-sm text-slate-500 dark:text-slate-400" suppressHydrationWarning>
                {mounted ? new Date().toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                }) : ''}
              </div>
            </div>
            {loadingAttendance ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 animate-pulse bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-3 w-24 animate-pulse bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                    <div className="h-6 w-20 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                  </div>
                ))}
              </div>
            ) : attendanceData.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t.no_attendance_data || 'No attendance data available'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {attendanceData.map((att) => {
                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case 'present':
                        return 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300';
                      case 'absent':
                        return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300';
                      case 'late':
                        return 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300';
                      case 'excused':
                        return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300';
                      default:
                        return 'bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300';
                    }
                  };
                  const getStatusText = (status: string) => {
                    switch (status) {
                      case 'present':
                        return t.attendance_present || 'Present';
                      case 'absent':
                        return t.attendance_absent || 'Absent';
                      case 'late':
                        return t.attendance_late || 'Late';
                      case 'excused':
                        return t.attendance_excused || 'Excused';
                      default:
                        return t.attendance_not_recorded || 'Not Recorded';
                    }
                  };
                  return (
                    <div
                      key={att.studentId}
                      className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(att.status)}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{att.studentName}</div>
                        {att.className && (
                          <div className="text-xs opacity-75 mt-0.5">{att.className}</div>
                        )}
                      </div>
                      <div className="text-sm font-semibold">
                        {getStatusText(att.status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Linked Students Table */}
        {linkedStudents.length > 0 && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-md font-medium text-slate-900 dark:text-slate-100 mb-3">{t.my_students || 'My Students'}</h3>
            <div className="overflow-x-auto overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-black">
                    <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300 rounded-tl-xl">
                      {t.student_name || 'Name'}
                    </th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300 rounded-tr-xl">
                      {t.student_class || 'Class'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800">
                  {linkedStudents.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="text-left py-2 px-4 text-sm text-slate-900 dark:text-slate-100">{s.first_name} {s.last_name || ''}</td>
                      <td className="text-left py-2 px-4 text-sm text-slate-600 dark:text-slate-300">{s.classes?.name || '-'}</td>
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
