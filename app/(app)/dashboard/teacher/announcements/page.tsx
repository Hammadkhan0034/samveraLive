'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Timer, Users, MessageSquare, Camera, Link as LinkIcon, Utensils } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar, { TeacherSidebarRef } from '@/app/components/shared/TeacherSidebar';
import AnnouncementForm from '@/app/components/AnnouncementForm';
import AnnouncementList from '@/app/components/AnnouncementList';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Translations removed - using centralized translations from @/lib/translations

export default function TeacherAnnouncementsPage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, isSigningIn } = useRequireAuth('teacher');
  const sidebarRef = useRef<TeacherSidebarRef>(null);

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
  
  // Final org_id to use
  const finalOrgId = orgIdFromMetadata || dbOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

  // Teacher classes
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Load teacher classes
  useEffect(() => {
    async function loadTeacherClasses() {
      if (!session?.user?.id) return;
      try {
        setLoadingClasses(true);
        const response = await fetch(`/api/teacher-classes?userId=${session.user.id}&t=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();
        if (response.ok && data.classes) {
          setTeacherClasses(data.classes);
        } else {
          setTeacherClasses([]);
        }
      } catch (error) {
        console.error('Error loading teacher classes:', error);
        setTeacherClasses([]);
      } finally {
        setLoadingClasses(false);
      }
    }
    loadTeacherClasses();
  }, [session?.user?.id]);

  // Get classId from session metadata
  const classId = (session?.user?.user_metadata as any)?.class_id as string | undefined;

  // Get all teacher class IDs for filtering announcements
  const teacherClassIds = teacherClasses && teacherClasses.length > 0 
    ? teacherClasses.map(c => c.id).filter(Boolean) 
    : (classId ? [classId] : []);

  // Define tiles array (excluding announcements, attendance, diapers, messages, media, and stories as they're handled separately)
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon, route: '/dashboard/teacher?tab=link_student' },
      { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils, route: '/dashboard/teacher?tab=menus' },
    ], [t, lang]);

  // Show loading state while checking authentication
  if (authLoading || (isSigningIn && !user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading announcements page...
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
          ref={sidebarRef}
          pathname={pathname}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
            {/* Announcements Panel */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">{t.announcements_title}</h2>
                <AnnouncementForm
                  classId={classId}
                  orgId={finalOrgId}
                  showClassSelector={true}
                  onSuccess={() => {
                    // Trigger refresh event instead of reload
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new Event('announcements-refresh'));
                    }
                  }}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <AnnouncementList
                  teacherClassIds={teacherClassIds}
                  orgId={finalOrgId}
                  lang={lang}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

