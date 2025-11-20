'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Timer, Users, MessageSquare, Camera, Link as LinkIcon, Utensils } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar, { TeacherSidebarRef } from '@/app/components/shared/TeacherSidebar';
import LinkStudentGuardian from '@/app/components/LinkStudentGuardian';
import Loading from '@/app/components/shared/Loading';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Translations removed - using centralized translations from @/lib/translations

export default function TeacherLinkStudentPage() {
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

  // Define tiles array (excluding link_student as it's handled separately)
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
    { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils, route: '/dashboard/teacher?tab=menus' },
  ], [t, lang]);

  // Show loading state while checking authentication
  if (authLoading || (isSigningIn && !user)) {
    return <Loading fullScreen text="Loading link student page..." />;
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
            {/* Link Student Panel */}
            <div className="space-y-6">
              <div className="mb-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.tile_link_student_desc}</h3>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <LinkStudentGuardian lang={lang} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

