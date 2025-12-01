'use client';

import React, { useState, useImperativeHandle, forwardRef, useEffect, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Camera, Timer, Bell, Users, Shield, Link as LinkIcon, Utensils, LayoutDashboard, CalendarDays } from 'lucide-react';
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

const TeacherSidebarContent = forwardRef<TeacherSidebarRef, TeacherSidebarProps>(({
  messagesBadge,
  attendanceBadge,
  mediaBadge,
  tiles = [],
}, ref) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

    // Map tile IDs to their expected routes
    const tileRouteMap: Record<string, string> = {
      'dashboard': '/dashboard/teacher',
      'attendance': '/dashboard/teacher/attendance',
      'diapers': '/dashboard/teacher/diapers',
      'messages': '/dashboard/teacher/messages',
      'media': '/dashboard/teacher/media',
      'stories': '/dashboard/teacher/stories',
      'announcements': '/dashboard/teacher/announcements',
      'students': '/dashboard/teacher/students',
      'guardians': '/dashboard/teacher/guardians',
      'link_student': '/dashboard/teacher/link-student',
      'menus': '/dashboard/teacher/menus',
      'calendar': '/dashboard/teacher/calendar',
    };

    const expectedRoute = tileRouteMap[optimisticActiveTile];
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

    // Use pathname-based detection (route mode) when no optimistic state
    if (tileRoute) {
      // Extract pathname from route (remove query parameters for comparison)
      const routePathname = tileRoute.split('?')[0];
      // Check if pathname matches, or if route has query params, check if we're on the base path
      if (tileRoute.includes('?')) {
        // For routes with query params like /dashboard/teacher?tab=media
        // Check if we're on the base path and the tab matches
        return pathname === routePathname;
      }
      return pathname === tileRoute;
    }
    // For special tiles, check pathname
    if (tileId === 'dashboard') {
      return pathname === '/dashboard/teacher';
    }
    if (tileId === 'attendance') {
      return pathname === '/dashboard/teacher/attendance';
    }
    if (tileId === 'diapers') {
      return pathname === '/dashboard/teacher/diapers';
    }
    if (tileId === 'messages') {
      return pathname === '/dashboard/teacher/messages';
    }
    if (tileId === 'media') {
      return pathname === '/dashboard/teacher/media';
    }
    if (tileId === 'stories') {
      return pathname === '/dashboard/teacher/stories';
    }
    if (tileId === 'announcements') {
      return pathname === '/dashboard/teacher/announcements';
    }
    if (tileId === 'calendar') {
      return pathname === '/dashboard/teacher/calendar';
    }
    if (tileId === 'students') {
      return pathname === '/dashboard/teacher/students';
    }
    if (tileId === 'guardians') {
      return pathname === '/dashboard/teacher/guardians';
    }
    if (tileId === 'link_student') {
      return pathname === '/dashboard/teacher/link-student';
    }
    if (tileId === 'menus') {
      return pathname === '/dashboard/teacher/menus';
    }
    return false;
  };

  // Handle tile click
  const handleTileClick = (tile: TeacherSidebarTile) => {
    if (tile.route) {
      // Set optimistic state immediately for instant feedback
      if (tile.id) {
        setOptimisticActiveTile(tile.id);
      }
      // Route-based navigation - navigate to the new route
      router.push(tile.route);
      handleSidebarClose();
    }
  };

  // Handle dashboard tile click
  const handleDashboardClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('dashboard');
    if (pathname !== '/dashboard/teacher') {
      router.replace('/dashboard/teacher');
    }
    handleSidebarClose();
  };

  // Handle attendance tile click
  const handleAttendanceClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('attendance');
    if (pathname !== '/dashboard/teacher/attendance') {
      router.replace('/dashboard/teacher/attendance');
    }
    handleSidebarClose();
  };

  // Handle diapers tile click
  const handleDiapersClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('diapers');
    if (pathname !== '/dashboard/teacher/diapers') {
      router.replace('/dashboard/teacher/diapers');
    }
    handleSidebarClose();
  };

  // Handle messages tile click
  const handleMessagesClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('messages');
    if (pathname !== '/dashboard/teacher/messages') {
      router.replace('/dashboard/teacher/messages');
    }
    handleSidebarClose();
  };

  // Handle media tile click
  const handleMediaClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('media');
    if (pathname !== '/dashboard/teacher/media') {
      router.replace('/dashboard/teacher/media');
    }
    handleSidebarClose();
  };

  // Handle stories tile click
  const handleStoriesClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('stories');
    if (pathname !== '/dashboard/teacher/stories') {
      router.replace('/dashboard/teacher/stories');
    }
    handleSidebarClose();
  };

  // Handle announcements tile click
  const handleAnnouncementsClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('announcements');
    if (pathname !== '/dashboard/teacher/announcements') {
      router.replace('/dashboard/teacher/announcements');
    }
    handleSidebarClose();
  };

  // Handle calendar tile click
  const handleCalendarClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('calendar');
    if (pathname !== '/dashboard/teacher/calendar') {
      router.replace('/dashboard/teacher/calendar');
    }
    handleSidebarClose();
  };

  // Handle students tile click
  const handleStudentsClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('students');
    if (pathname !== '/dashboard/teacher/students') {
      router.replace('/dashboard/teacher/students');
    }
    handleSidebarClose();
  };

  // Handle guardians tile click
  const handleGuardiansClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('guardians');
    if (pathname !== '/dashboard/teacher/guardians') {
      router.replace('/dashboard/teacher/guardians');
    }
    handleSidebarClose();
  };

  // Handle link student tile click
  const handleLinkStudentClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('link_student');
    if (pathname !== '/dashboard/teacher/link-student') {
      router.replace('/dashboard/teacher/link-student');
    }
    handleSidebarClose();
  };

  // Handle menus tile click
  const handleMenusClick = () => {
    // Set optimistic state immediately for instant feedback
    setOptimisticActiveTile('menus');
    if (pathname !== '/dashboard/teacher/menus') {
      router.replace('/dashboard/teacher/menus');
    }
    handleSidebarClose();
  };

  // Use isTileActive helper for consistent optimistic state handling
  const isDashboardActive = isTileActive('dashboard');
  const isAttendanceActive = isTileActive('attendance');
  const isDiapersActive = isTileActive('diapers');
  const isMessagesActive = isTileActive('messages');
  const isMediaActive = isTileActive('media');
  const isStoriesActive = isTileActive('stories');
  const isAnnouncementsActive = isTileActive('announcements');
  const isCalendarActive = isTileActive('calendar');
  const isStudentsActive = isTileActive('students');
  const isGuardiansActive = isTileActive('guardians');
  const isLinkStudentActive = isTileActive('link_student');
  const isMenusActive = isTileActive('menus');

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
              onClick={handleDashboardClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isDashboardActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isDashboardActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <LayoutDashboard className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isDashboardActive
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
              onClick={handleAttendanceClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isAttendanceActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isAttendanceActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <CheckSquare className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isAttendanceActive
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
              onClick={handleDiapersClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isDiapersActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isDiapersActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Baby className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isDiapersActive
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
              onClick={handleMessagesClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isMessagesActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isMessagesActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <MessageSquare className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isMessagesActive
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
              onClick={handleMediaClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isMediaActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isMediaActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Camera className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isMediaActive
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
              onClick={handleStoriesClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isStoriesActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isStoriesActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Timer className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isStoriesActive
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
              onClick={handleAnnouncementsClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isAnnouncementsActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isAnnouncementsActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Bell className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isAnnouncementsActive
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
              onClick={handleCalendarClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isCalendarActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isCalendarActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isCalendarActive
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
              onClick={handleStudentsClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isStudentsActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isStudentsActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Users className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isStudentsActive
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
              onClick={handleGuardiansClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isGuardiansActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isGuardiansActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Shield className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isGuardiansActive
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
              onClick={handleLinkStudentClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isLinkStudentActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isLinkStudentActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <LinkIcon className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isLinkStudentActive
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
              onClick={handleMenusClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isMenusActive
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isMenusActive
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Utensils className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isMenusActive
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
                  onClick={() => handleTileClick(tile)}
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

