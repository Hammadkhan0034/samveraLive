'use client';
import React, { useState, useEffect, useRef } from 'react';
import { CalendarDays, Menu } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import TeacherSidebar, { TeacherSidebarRef } from '@/app/components/shared/TeacherSidebar';
import { useLanguage } from '@/lib/contexts/LanguageContext';

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

  // Messages count for sidebar badge
  const [messagesCount, setMessagesCount] = useState(0);



  // Load messages count for sidebar badge
  useEffect(() => {
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
          ref={sidebarRef}
          pathname={pathname}
          messagesBadge={messagesCount > 0 ? messagesCount : undefined}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
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

