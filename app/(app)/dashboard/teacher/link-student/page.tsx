'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Timer, Users, MessageSquare, Camera, Link as LinkIcon, Utensils } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useCurrentUserOrgId } from '@/lib/hooks/useCurrentUserOrgId';
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
  const { user, loading: authLoading, isSigningIn } = useRequireAuth('teacher');
  const sidebarRef = useRef<TeacherSidebarRef>(null);

  // Use universal hook to get org_id (checks metadata first, then API, handles logout if missing)
  const { orgId: finalOrgId } = useCurrentUserOrgId();

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

