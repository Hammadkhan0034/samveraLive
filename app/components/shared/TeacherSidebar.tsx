'use client';

import React, { useState, useImperativeHandle, forwardRef, useEffect, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import {
  SquareCheck as CheckSquare,
  Baby,
  MessageSquare,
  Camera,
  Timer,
  Bell,
  Users,
  Shield,
  Link as LinkIcon,
  Utensils,
  LayoutDashboard,
  CalendarDays,
} from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';

// Small helper
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export interface TeacherSidebarTile {
  id: string;
  title: string;
  desc: string;
  Icon: React.ElementType;
  badge?: string | number;
  route?: string; // For route-based navigation
}

export interface TeacherSidebarProps {
  messagesBadge?: number; // Optional badge count for messages
  attendanceBadge?: number; // Optional badge count for attendance
  mediaBadge?: number; // Optional badge count for media
  tiles?: TeacherSidebarTile[]; // For any custom tiles
}

export interface TeacherSidebarRef {
  open: () => void;
  close: () => void;
}

type BuiltInTileId =
  | 'dashboard'
  | 'attendance'
  | 'diapers'
  | 'messages'
  | 'media'
  | 'stories'
  | 'announcements'
  | 'calendar'
  | 'students'
  | 'guardians'
  | 'link_student'
  | 'menus';

interface BuiltInTileConfig {
  id: BuiltInTileId;
  route: string;
}

const builtInTileRoutes: BuiltInTileConfig[] = [
  { id: 'dashboard', route: '/dashboard/teacher' },
  { id: 'attendance', route: '/dashboard/teacher/attendance' },
  { id: 'diapers', route: '/dashboard/teacher/diapers' },
  { id: 'messages', route: '/dashboard/teacher/messages' },
  { id: 'media', route: '/dashboard/teacher/media' },
  { id: 'stories', route: '/dashboard/teacher/stories' },
  { id: 'announcements', route: '/dashboard/teacher/announcements' },
  { id: 'students', route: '/dashboard/teacher/students' },
  { id: 'guardians', route: '/dashboard/teacher/guardians' },
  { id: 'link_student', route: '/dashboard/teacher/link-student' },
  { id: 'menus', route: '/dashboard/teacher/menus' },
  { id: 'calendar', route: '/dashboard/teacher/calendar' },
];

const getRouteForTileId = (tileId: string): string | undefined => {
  const config = builtInTileRoutes.find((tile) => tile.id === tileId);
  return config?.route;
};

const getBasePathnameFromRoute = (route: string): string => route.split('?')[0];

const TeacherSidebarContent = forwardRef<TeacherSidebarRef, TeacherSidebarProps>(({
  messagesBadge,
  attendanceBadge,
  mediaBadge,
  tiles = [],
}, ref) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [optimisticActiveTile, setOptimisticActiveTile] = useState<string | null>(null);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    open: () => setSidebarOpen(true),
    close: () => setSidebarOpen(false),
  }));

  // Internal handler to close sidebar
  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  // Sync optimistic state with pathname changes
  useEffect(() => {
    if (!optimisticActiveTile) return;

    const expectedRoute = getRouteForTileId(optimisticActiveTile);
    if (expectedRoute && pathname === expectedRoute) {
      // Navigation completed, clear optimistic state
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setOptimisticActiveTile(null);
      }, 0);
    }
  }, [pathname, optimisticActiveTile]);

  // Determine if a tile is active based on optimistic state or pathname
  const isTileActive = (tileId: string, tileRoute?: string): boolean => {
    // If there's an optimistic active tile, only that tile should be active
    // This prevents multiple tiles from being active during navigation
    if (optimisticActiveTile !== null) {
      return optimisticActiveTile === tileId;
    }

    const routeToUse = tileRoute ?? getRouteForTileId(tileId);
    if (!routeToUse) return false;

    const routePathname = getBasePathnameFromRoute(routeToUse);
    return pathname === routePathname;
  };

  const navigateToRoute = (tileId: string, route: string, options?: { replace?: boolean }) => {
    setOptimisticActiveTile(tileId);

    const basePath = getBasePathnameFromRoute(route);
    const shouldReplace = options?.replace ?? true;

    if (pathname !== basePath) {
      if (shouldReplace) {
        router.replace(route);
      } else {
        router.push(route);
      }
    }

    handleSidebarClose();
  };

  const handleBuiltInTileClick = (tileId: BuiltInTileId) => {
    const route = getRouteForTileId(tileId);
    if (!route) return;

    navigateToRoute(tileId, route, { replace: true });
  };

  const handleCustomTileClick = (tile: TeacherSidebarTile) => {
    if (!tile.route) return;
    navigateToRoute(tile.id, tile.route, { replace: false });
  };

  return (
    <>
      {/* Sidebar - Design System: White background, rounded right corners, 280px wide */}
      <aside
        className={clsx(
          'flex-shrink-0 w-[280px] bg-white dark:bg-slate-800 shadow-ds-card transition-transform duration-300 ease-in-out',
          'scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
          'rounded-tr-[24px] rounded-br-[24px]',
          sidebarOpen
            ? 'fixed top-0 bottom-0 left-0 z-50 translate-x-0 md:sticky md:top-0 md:h-screen md:overflow-y-auto md:translate-x-0'
            : 'fixed top-0 bottom-0 left-0 z-50 -translate-x-full md:sticky md:top-0 md:h-screen md:overflow-y-auto md:translate-x-0'
        )}
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="py-6">
          {/* App Logo */}
          <div className="py-4 mb-6 flex items-center justify-start px-6">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
              <span className="inline-block rounded-lg bg-mint-200 dark:bg-mint-500 text-slate-900 dark:text-white py-2 px-4 text-2xl font-bold">S</span>
              <span className="text-2xl ml-2">Samvera</span>
            </div>
          </div>

          {/* Mobile close button */}
          <div className="mb-4 flex items-center justify-between px-6 md:hidden">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Menu</h2>
            <button
              onClick={handleSidebarClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation - Design System: Generous spacing, text-based items */}
          <nav className="space-y-1 px-3">
            {/* Dashboard tile - Design System: Text-based nav with mint active state */}
            <button
              onClick={() => handleBuiltInTileClick('dashboard')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('dashboard')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('dashboard')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <LayoutDashboard className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('dashboard')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.teacher_dashboard}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  View dashboard overview
                </p>
              </div>
            </button>

            {/* Attendance tile */}
            <button
              onClick={() => handleBuiltInTileClick('attendance')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('attendance')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('attendance')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <CheckSquare className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('attendance')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.tile_att}
                  </span>
                  {attendanceBadge !== undefined && attendanceBadge !== null && attendanceBadge !== 0 && (
                    <span className="flex-shrink-0 rounded-full bg-mint-500 px-2 py-0.5 text-xs font-medium text-white" suppressHydrationWarning>
                      {attendanceBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.tile_att_desc}</p>
              </div>
            </button>

            {/* Diapers tile */}
            <button
              onClick={() => handleBuiltInTileClick('diapers')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('diapers')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('diapers')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Baby className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('diapers')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.tile_diaper}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.tile_diaper_desc}</p>
              </div>
            </button>

            {/* Messages tile */}
            <button
              onClick={() => handleBuiltInTileClick('messages')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('messages')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('messages')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <MessageSquare className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('messages')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.tile_msg}
                  </span>
                  {messagesBadge !== undefined && messagesBadge !== null && messagesBadge !== 0 && (
                    <span className="flex-shrink-0 rounded-full bg-mint-500 px-2 py-0.5 text-xs font-medium text-white" suppressHydrationWarning>
                      {messagesBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.tile_msg_desc}</p>
              </div>
            </button>

            {/* Media tile */}
            <button
              onClick={() => handleBuiltInTileClick('media')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('media')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('media')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Camera className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('media')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.tile_media}
                  </span>
                  {mediaBadge !== undefined && mediaBadge !== null && mediaBadge !== 0 && (
                    <span className="flex-shrink-0 rounded-full bg-mint-500 px-2 py-0.5 text-xs font-medium text-white" suppressHydrationWarning>
                      {mediaBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.tile_media_desc}</p>
              </div>
            </button>

            {/* Stories tile */}
            <button
              onClick={() => handleBuiltInTileClick('stories')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('stories')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('stories')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Timer className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('stories')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.tile_stories}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.tile_stories_desc}</p>
              </div>
            </button>

            {/* Announcements tile */}
            <button
              onClick={() => handleBuiltInTileClick('announcements')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('announcements')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('announcements')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Bell className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('announcements')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.tile_announcements}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.tile_announcements_desc}</p>
              </div>
            </button>

            {/* Calendar tile */}
            <button
              onClick={() => handleBuiltInTileClick('calendar')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('calendar')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('calendar')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('calendar')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.tile_calendar}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.tile_calendar_desc}</p>
              </div>
            </button>

            {/* Students tile */}
            <button
              onClick={() => handleBuiltInTileClick('students')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('students')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('students')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Users className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('students')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.tile_students}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.tile_students_desc}</p>
              </div>
            </button>

            {/* Guardians tile */}
            <button
              onClick={() => handleBuiltInTileClick('guardians')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('guardians')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('guardians')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Shield className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('guardians')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.tile_guardians || 'Guardians'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.tile_guardians_desc || 'Manage guardians'}</p>
              </div>
            </button>

            {/* Link Student tile */}
            <button
              onClick={() => handleBuiltInTileClick('link_student')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('link_student')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('link_student')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <LinkIcon className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('link_student')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.tile_link_student || 'Link Student'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.tile_link_student_desc || 'Link a guardian to a student'}</p>
              </div>
            </button>

            {/* Menus tile */}
            <button
              onClick={() => handleBuiltInTileClick('menus')}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('menus')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('menus')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Utensils className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('menus')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.tile_menus || 'Menus'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.tile_menus_desc || 'Manage daily menus'}</p>
              </div>
            </button>

            {/* Other tiles */}
            {tiles.map((tile) => {
              const isActive = isTileActive(tile.id, tile.route);
              return (
                <button
                  key={tile.id}
                  onClick={() => handleCustomTileClick(tile)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                    'hover:bg-slate-100 dark:hover:bg-slate-700',
                    isActive
                      ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                      : 'border-l-4 border-transparent'
                  )}
                >
                  <span className={clsx(
                    'flex-shrink-0 rounded-lg p-2',
                    isActive
                      ? 'bg-mint-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                  )}>
                    <tile.Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={clsx(
                        'font-medium truncate',
                        isActive
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-700 dark:text-slate-300'
                      )}>
                        {tile.title}
                      </span>
                      {tile.badge !== undefined && tile.badge !== null && tile.badge !== 0 && (
                        <span className="flex-shrink-0 rounded-full bg-mint-500 px-2 py-0.5 text-xs font-medium text-white" suppressHydrationWarning>
                          {tile.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{tile.desc}</p>
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
          className="fixed top-0 bottom-0 left-0 right-0 bg-black/50 z-40 md:hidden"
          onClick={handleSidebarClose}
          aria-hidden="true"
        />
      )}
    </>
  );
});

TeacherSidebarContent.displayName = 'TeacherSidebarContent';

const TeacherSidebar = forwardRef<TeacherSidebarRef, TeacherSidebarProps>((props, ref) => {
  return (
    <Suspense fallback={<div className="w-[280px] bg-white dark:bg-slate-800 rounded-tr-[24px] rounded-br-[24px]" />}>
      <TeacherSidebarContent {...props} ref={ref} />
    </Suspense>
  );
});

TeacherSidebar.displayName = 'TeacherSidebar';

export default TeacherSidebar;

