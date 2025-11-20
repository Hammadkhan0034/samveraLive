'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CalendarDays, Menu, ClipboardCheck, Users, MessageSquare, FileText, Megaphone, Utensils } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import TeacherSidebar, { TeacherSidebarRef } from '@/app/components/shared/TeacherSidebar';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useTeacherOrgId } from '@/lib/hooks/useTeacherOrgId';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useTeacherStudents } from '@/lib/hooks/useTeacherStudents';

export default function TeacherDashboard() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const sidebarRef = useRef<TeacherSidebarRef>(null);

  // Set active tab from query parameter
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    // No tabs available in TeacherDashboard anymore
    if (tabParam) {
      // Redirect to appropriate page if needed
      if (tabParam === 'students') {
        router.replace('/dashboard/teacher/students');
      } else if (tabParam === 'menus') {
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

  // Get orgId and classes using hooks
  const { orgId: finalOrgId } = useTeacherOrgId();
  const { classes: teacherClasses } = useTeacherClasses();
  const { students: teacherStudents } = useTeacherStudents(teacherClasses, finalOrgId);

  // KPI states
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [storiesCount, setStoriesCount] = useState(0);
  const [announcementsCount, setAnnouncementsCount] = useState(0);
  const [menusCount, setMenusCount] = useState(0);



  // Load attendance count for today
  const loadAttendanceForKPI = useCallback(async () => {
    if (!finalOrgId || !session?.user?.id || teacherClasses.length === 0) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const classIds = teacherClasses.map(c => c.id).filter(Boolean);
      
      if (classIds.length === 0) {
        setAttendanceCount(0);
        return;
      }

      // Fetch attendance for all classes in parallel
      const fetchPromises = classIds.map(async (classId) => {
        try {
          const res = await fetch(
            `/api/attendance?orgId=${finalOrgId}&classId=${classId}&date=${today}&t=${Date.now()}`,
            { cache: 'no-store' }
          );
          const data = await res.json();
          return res.ok && data.attendance ? data.attendance.length : 0;
        } catch {
          return 0;
        }
      });

      const results = await Promise.allSettled(fetchPromises);
      const total = results.reduce((sum, result) => {
        return sum + (result.status === 'fulfilled' ? result.value : 0);
      }, 0);
      
      setAttendanceCount(total);
    } catch (error) {
      console.error('Error loading attendance count:', error);
    }
  }, [finalOrgId, session?.user?.id, teacherClasses]);

  // Load students count
  const loadStudentsForKPI = useCallback(() => {
    if (teacherStudents.length > 0) {
      setStudentsCount(teacherStudents.length);
    }
  }, [teacherStudents.length]);

  // Load messages count
  const loadMessagesForKPI = useCallback(async () => {
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
  }, [session?.user?.id]);

  // Load stories count (24h)
  const loadStoriesForKPI = useCallback(async () => {
    if (!finalOrgId) return;
    try {
      const res = await fetch(`/api/stories?orgId=${finalOrgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.stories) {
        // Filter stories from last 24 hours
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const recentStories = json.stories.filter((story: any) => {
          const storyDate = new Date(story.created_at || story.updated_at).getTime();
          return storyDate >= oneDayAgo;
        });
        setStoriesCount(recentStories.length);
      }
    } catch (error) {
      console.error('Error loading stories count:', error);
    }
  }, [finalOrgId]);

  // Load announcements count
  const loadAnnouncementsForKPI = useCallback(async () => {
    if (!finalOrgId || !session?.user?.id) return;
    try {
      const userMetadata = session?.user?.user_metadata;
      const params = new URLSearchParams();
      params.set('userId', session.user.id);
      params.set('userRole', (userMetadata?.role || userMetadata?.activeRole || 'teacher') as string);
      params.set('limit', '100');
      
      const res = await fetch(`/api/announcements?${params.toString()}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.announcements) {
        setAnnouncementsCount(json.announcements.length);
      }
    } catch (error) {
      console.error('Error loading announcements count:', error);
    }
  }, [finalOrgId, session?.user?.id, session?.user?.user_metadata]);

  // Load menus count
  const loadMenusForKPI = useCallback(async () => {
    if (!finalOrgId) return;
    try {
      const res = await fetch(`/api/menus?orgId=${finalOrgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.menus) {
        setMenusCount(json.menus.length);
      }
    } catch (error) {
      console.error('Error loading menus count:', error);
    }
  }, [finalOrgId]);

  // Load all KPIs when data is available
  useEffect(() => {
    if (session?.user?.id && finalOrgId) {
      Promise.allSettled([
        loadAttendanceForKPI(),
        loadStudentsForKPI(),
        loadMessagesForKPI(),
        loadStoriesForKPI(),
        loadAnnouncementsForKPI(),
        loadMenusForKPI(),
      ]);
    }
  }, [session?.user?.id, finalOrgId, teacherClasses.length, teacherStudents.length, loadAttendanceForKPI, loadStudentsForKPI, loadMessagesForKPI, loadStoriesForKPI, loadAnnouncementsForKPI, loadMenusForKPI]);

  // Update students count when students change
  useEffect(() => {
    loadStudentsForKPI();
  }, [loadStudentsForKPI]);

  // Listen for stories refresh event
  useEffect(() => {
    const handleStoriesRefresh = () => {
      loadStoriesForKPI();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('stories-refresh', handleStoriesRefresh);
      return () => {
        window.removeEventListener('stories-refresh', handleStoriesRefresh);
      };
    }
  }, [loadStoriesForKPI]);

  // Listen for announcements refresh event
  useEffect(() => {
    const handleAnnouncementsRefresh = () => {
      loadAnnouncementsForKPI();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('announcements-refresh', handleAnnouncementsRefresh);
      return () => {
        window.removeEventListener('announcements-refresh', handleAnnouncementsRefresh);
      };
    }
  }, [loadAnnouncementsForKPI]);

  // Listen for visibility change to refresh data
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible' && session?.user?.id && finalOrgId) {
        Promise.allSettled([
          loadAttendanceForKPI(),
          loadMessagesForKPI(),
          loadStoriesForKPI(),
          loadAnnouncementsForKPI(),
          loadMenusForKPI(),
        ]);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [session?.user?.id, finalOrgId, loadAttendanceForKPI, loadMessagesForKPI, loadStoriesForKPI, loadAnnouncementsForKPI, loadMenusForKPI]);

  // Memoize KPIs array
  const kpis = useMemo(() => [
    {
      label: t.attendance || 'Attendance',
      value: attendanceCount,
      icon: ClipboardCheck,
      onClick: () => router.push('/dashboard/teacher/attendance')
    },
    {
      label: t.kpi_students || 'Students',
      value: studentsCount,
      icon: Users,
      onClick: () => router.push('/dashboard/teacher/students')
    },
    {
      label: t.kpi_messages || 'Messages',
      value: messagesCount,
      icon: MessageSquare,
      onClick: () => router.push('/dashboard/teacher/messages')
    },
    {
      label: `${t.kpi_stories || 'Stories'} (24h)`,
      value: storiesCount,
      icon: FileText,
      onClick: () => router.push('/dashboard/stories')
    },
    {
      label: t.kpi_announcements || 'Announcements',
      value: announcementsCount,
      icon: Megaphone,
      onClick: () => router.push('/dashboard/announcements')
    },
    {
      label: t.kpi_menus || 'Menus',
      value: menusCount,
      icon: Utensils,
      onClick: () => router.push('/dashboard/teacher/menus')
    },
  ], [t, attendanceCount, studentsCount, messagesCount, storiesCount, announcementsCount, menusCount, router]);


  return (
    <div className="flex flex-col h-screen overflow-hidden md:pt-10">
      {/* Main content area with sidebar and content - starts below navbar */}
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <TeacherSidebar
          ref={sidebarRef}
          pathname={pathname}
          messagesBadge={messagesCount > 0 ? messagesCount : undefined}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-2 lg:p-8">
            {/* Content Header */}
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                <button
                  onClick={() => sidebarRef.current?.open()}
                  className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  aria-label="Toggle sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.teacher_dashboard}</h2>
              </div>
              <div className="flex items-center gap-3">
                <ProfileSwitcher />
                <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <CalendarDays className="h-4 w-4" />
                  <span>{t.today_hint}</span>
                </div>
              </div>
            </div>
            {/* KPIs Section */}
            <section className="mb-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {kpis.map(({ label, value, icon: Icon, onClick }, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                    onClick={onClick}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
                      <span className="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                        <Icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                      </span>
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

