'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Timer, Users, MessageSquare, Camera, Link as LinkIcon, Utensils } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import AnnouncementForm from '@/app/components/AnnouncementForm';
import AnnouncementList from '@/app/components/AnnouncementList';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Translations removed - using centralized translations from @/lib/translations

export default function TeacherAnnouncementsPage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();

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

  return (
    <TeacherPageLayout>
      <p className="ml-6 font-semibold text-xl text-black dark:text-white">{t.announcements_title}</p>
      {/* Announcements Panel */}
      <div className="space-y-6">
        <div className="rounded-2xl p-6">
          {/* <h2 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">{t.announcements_title}</h2> */}
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

        <div className="rounded-2xl p-6">
          <AnnouncementList
            teacherClassIds={teacherClassIds}
            orgId={finalOrgId}
            lang={lang}
          />
        </div>
      </div>
    </TeacherPageLayout>
  );
}

