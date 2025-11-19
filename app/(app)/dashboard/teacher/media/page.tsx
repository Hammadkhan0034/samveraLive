'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Camera, Timer, Users, Bell, MessageSquare, Link as LinkIcon, Utensils, Plus } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar, { TeacherSidebarRef } from '@/app/components/shared/TeacherSidebar';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Translations removed - using centralized translations from @/lib/translations

export default function TeacherMediaPage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, isSigningIn } = useRequireAuth('teacher');
  const sidebarRef = useRef<TeacherSidebarRef>(null);

  // Media state
  const [uploads, setUploads] = useState<string[]>([]); // data URLs for image previews

  // Handle file uploads
  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    Array.from(files).slice(0, 12).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setUploads((prev) => [...prev, String(reader.result)]);
      reader.readAsDataURL(file);
    });
  }

  // Define tiles array (excluding media, attendance, diapers, and messages as they're handled separately)
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
              Loading media page...
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
          mediaBadge={uploads.length > 0 ? uploads.length : undefined}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
            {/* Media Panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.media_title}</h2>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                  <Plus className="h-4 w-4" />
                  {t.upload}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {uploads.length === 0 ? (
                  <div className="col-span-full text-center text-slate-500 dark:text-slate-400">
                    {'No media uploaded yet'}
                  </div>
                ) : (
                  uploads.map((url, idx) => (
                    <div key={idx} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
                      <img src={url} alt={`Upload ${idx + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

