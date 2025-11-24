'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Camera, Timer, Users, CalendarDays, X, Link as LinkIcon, Utensils, Menu, Bell } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

// Translations removed - using centralized translations from @/lib/translations

interface TeacherLayoutProps {
  children: React.ReactNode;
  students?: Array<{ id: string }>;
  messagesCount?: number;
  studentRequests?: any[];
  uploads?: string[];
  hideHeader?: boolean;
}

export default function TeacherLayout({ 
  children, 
  students = [], 
  messagesCount = 0, 
  studentRequests = [],
  uploads = [],
  hideHeader = false
}: TeacherLayoutProps) {
  const { lang, t } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Calculate kids checked in from actual students (needed for tiles badge)
  const kidsIn = useMemo(() => {
    return students.length; // Simplified - you can add attendance logic here if needed
  }, [students]);

  // Define tiles array
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
  }> = useMemo(() => [
    { id: 'attendance', title: t.tile_att, desc: t.tile_att_desc, Icon: CheckSquare, badge: kidsIn },
    { id: 'diapers', title: t.tile_diaper, desc: t.tile_diaper_desc, Icon: Baby },
    { id: 'messages', title: t.tile_msg, desc: t.tile_msg_desc, Icon: MessageSquare, badge: messagesCount > 0 ? messagesCount : undefined },
    { id: 'media', title: t.tile_media, desc: t.tile_media_desc, Icon: Camera, badge: uploads.length || undefined },
    { id: 'stories', title: t.tile_stories, desc: t.tile_stories_desc, Icon: Timer },
    { id: 'announcements', title: t.tile_announcements, desc: t.tile_announcements_desc, Icon: Bell },
    { id: 'students', title: t.tile_students, desc: t.tile_students_desc, Icon: Users, badge: studentRequests.filter(r => r.status === 'pending').length || undefined },
    { id: 'guardians', title: t.tile_guardians || 'Guardians', desc: t.tile_guardians_desc || 'Manage guardians', Icon: Users },
    { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon },
    { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils },
  ], [t, kidsIn, uploads, studentRequests, messagesCount]);

  // Determine active tile based on pathname
  const getActiveTile = (): TileId | null => {
    if (pathname?.includes('/guardians')) return 'guardians';
    if (pathname?.includes('/link-student')) return 'link_student';
    if (pathname?.includes('/menus')) return 'menus';
    if (pathname?.includes('/messages')) return 'messages';
    if (pathname?.includes('/stories')) return 'stories';
    if (pathname?.includes('/teacher')) {
      // Check if it's the main teacher dashboard
      if (pathname === '/dashboard/teacher' || pathname === '/dashboard/teacher/') {
        return 'attendance'; // Default active tile
      }
    }
    return null;
  };

  const activeTile = getActiveTile();

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden pt-14">
      {/* Dashboard header - spans full width */}
      {!hideHeader && (
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
          </div>

          {/* Switch profile control (only shows if the user has multiple roles) */}
          <div className="flex items-center gap-3">
            <ProfileSwitcher />
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Users className="h-4 w-4" />
              <span>
                {t.kids_checked_in}:{' '}
                <span className="font-medium">{kidsIn}</span> / {students.length}
              </span>
              <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
              <CalendarDays className="h-4 w-4" />
              <span>{t.today_hint}</span>
            </div>
          </div>

          {/* Small-screen stats row */}
          <div className="md:hidden flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Users className="h-4 w-4" />
            <span>
              {t.kids_checked_in}:{' '}
              <span className="font-medium">{kidsIn}</span> / {students.length}
            </span>
            <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
            <CalendarDays className="h-4 w-4" />
            <span>{t.today_hint}</span>
          </div>
        </div>
      </div>
      )}

      {/* Main content area with sidebar and content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={clsx(
            'flex-shrink-0 w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto transition-transform duration-300 ease-in-out',
            'md:relative',
            sidebarOpen 
              ? 'fixed top-14 left-0 bottom-0 z-50 translate-x-0 md:translate-x-0' 
              : 'fixed top-14 left-0 bottom-0 z-50 -translate-x-full md:relative md:translate-x-0'
          )}
        >
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between md:hidden">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Menu</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {tiles.map(({ id, title, desc, Icon, badge }) => {
                const isActive = activeTile === id || (id === 'attendance' && pathname === '/dashboard/teacher');
                return (
                  <button
                    key={id}
                    onClick={() => {
                      if (id === 'guardians') {
                        router.push('/dashboard/guardians');
                        setSidebarOpen(false);
                        return;
                      }
                      if (id === 'link_student') {
                        router.push('/dashboard/link-student');
                        setSidebarOpen(false);
                        return;
                      }
                      if (id === 'menus') {
                        router.push('/dashboard/menus-list');
                        setSidebarOpen(false);
                        return;
                      }
                      if (id === 'messages') {
                        router.push('/dashboard/teacher/messages');
                        setSidebarOpen(false);
                        return;
                      }
                      if (id === 'stories') {
                        router.push('/dashboard/stories');
                        setSidebarOpen(false);
                        return;
                      }
                      // For other tiles, navigate to teacher dashboard with active state
                      router.push('/dashboard/teacher');
                      setSidebarOpen(false);
                    }}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                      'hover:bg-slate-100 dark:hover:bg-slate-700',
                      isActive
                        ? 'bg-slate-100 dark:bg-slate-700 border-l-4 border-slate-900 dark:border-slate-100'
                        : 'border-l-4 border-transparent'
                    )}
                  >
                    <span className={clsx(
                      'flex-shrink-0 rounded-lg p-2',
                      isActive
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    )}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={clsx(
                          'font-medium truncate',
                          isActive
                            ? 'text-slate-900 dark:text-slate-100'
                            : 'text-slate-700 dark:text-slate-300'
                        )}>
                          {title}
                        </span>
                        {badge !== undefined && badge !== null && badge !== 0 && (
                          <span className="flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-600 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300" suppressHydrationWarning>
                            {badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}

