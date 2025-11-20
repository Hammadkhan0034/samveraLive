'use client';

import React, { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Camera, Timer, Bell, Users, Shield, Link as LinkIcon, Utensils, LayoutDashboard } from 'lucide-react';
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
  pathname: string; // For route-based active state detection
  messagesBadge?: number; // Optional badge count for messages
  attendanceBadge?: number; // Optional badge count for attendance
  mediaBadge?: number; // Optional badge count for media
  tiles?: TeacherSidebarTile[]; // For any custom tiles
}

export interface TeacherSidebarRef {
  open: () => void;
  close: () => void;
}

const TeacherSidebar = forwardRef<TeacherSidebarRef, TeacherSidebarProps>(({
  pathname,
  messagesBadge,
  attendanceBadge,
  mediaBadge,
  tiles = [],
}, ref) => {
  const router = useRouter();
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
    // Check optimistic state first for immediate feedback
    if (optimisticActiveTile === tileId) {
      return true;
    }

    // Use pathname-based detection (route mode)
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
    if (pathname !== '/dashboard/teacher') {
      setOptimisticActiveTile('dashboard');
      router.replace('/dashboard/teacher');
    }
    handleSidebarClose();
  };

  // Handle attendance tile click
  const handleAttendanceClick = () => {
    if (pathname !== '/dashboard/teacher/attendance') {
      setOptimisticActiveTile('attendance');
      router.replace('/dashboard/teacher/attendance');
    }
    handleSidebarClose();
  };

  // Handle diapers tile click
  const handleDiapersClick = () => {
    if (pathname !== '/dashboard/teacher/diapers') {
      setOptimisticActiveTile('diapers');
      router.replace('/dashboard/teacher/diapers');
    }
    handleSidebarClose();
  };

  // Handle messages tile click
  const handleMessagesClick = () => {
    if (pathname !== '/dashboard/teacher/messages') {
      setOptimisticActiveTile('messages');
      router.replace('/dashboard/teacher/messages');
    }
    handleSidebarClose();
  };

  // Handle media tile click
  const handleMediaClick = () => {
    if (pathname !== '/dashboard/teacher/media') {
      setOptimisticActiveTile('media');
      router.replace('/dashboard/teacher/media');
    }
    handleSidebarClose();
  };

  // Handle stories tile click
  const handleStoriesClick = () => {
    if (pathname !== '/dashboard/teacher/stories') {
      setOptimisticActiveTile('stories');
      router.replace('/dashboard/teacher/stories');
    }
    handleSidebarClose();
  };

  // Handle announcements tile click
  const handleAnnouncementsClick = () => {
    if (pathname !== '/dashboard/teacher/announcements') {
      setOptimisticActiveTile('announcements');
      router.replace('/dashboard/teacher/announcements');
    }
    handleSidebarClose();
  };

  // Handle students tile click
  const handleStudentsClick = () => {
    if (pathname !== '/dashboard/teacher/students') {
      setOptimisticActiveTile('students');
      router.replace('/dashboard/teacher/students');
    }
    handleSidebarClose();
  };

  // Handle guardians tile click
  const handleGuardiansClick = () => {
    if (pathname !== '/dashboard/teacher/guardians') {
      setOptimisticActiveTile('guardians');
      router.replace('/dashboard/teacher/guardians');
    }
    handleSidebarClose();
  };

  // Handle link student tile click
  const handleLinkStudentClick = () => {
    if (pathname !== '/dashboard/teacher/link-student') {
      setOptimisticActiveTile('link_student');
      router.replace('/dashboard/teacher/link-student');
    }
    handleSidebarClose();
  };

  // Handle menus tile click
  const handleMenusClick = () => {
    if (pathname !== '/dashboard/teacher/menus') {
      setOptimisticActiveTile('menus');
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
  const isStudentsActive = isTileActive('students');
  const isGuardiansActive = isTileActive('guardians');
  const isLinkStudentActive = isTileActive('link_student');
  const isMenusActive = isTileActive('menus');

  return (
    <>
      {/* Sidebar */}
      <aside
        className={clsx(
          'flex-shrink-0 w-72 bg-slate-900 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto transition-transform duration-300 ease-in-out',
          sidebarOpen 
            ? 'fixed top-14 bottom-0 left-0 z-50 translate-x-0 md:relative md:top-0 md:translate-x-0' 
            : 'fixed top-14 bottom-0 left-0 z-50 -translate-x-full md:relative md:top-0 md:translate-x-0'
        )}
      >
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between md:hidden">
            <h2 className="text-lg font-semibold text-slate-100 dark:text-slate-100">Menu</h2>
            <button
              onClick={handleSidebarClose}
              className="p-2 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 text-slate-200 dark:text-slate-300"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="space-y-1">
            {/* Dashboard tile - always route-based */}
            <button
              onClick={handleDashboardClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isDashboardActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isDashboardActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <LayoutDashboard className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isDashboardActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.teacher_dashboard}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">
                  View dashboard overview
                </p>
              </div>
            </button>

            {/* Attendance tile - always route-based */}
            <button
              onClick={handleAttendanceClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isAttendanceActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isAttendanceActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <CheckSquare className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isAttendanceActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.tile_att}
                  </span>
                  {attendanceBadge !== undefined && attendanceBadge !== null && attendanceBadge !== 0 && (
                    <span className="flex-shrink-0 rounded-full bg-slate-700 dark:bg-slate-600 px-2 py-0.5 text-xs font-medium text-slate-100 dark:text-slate-300" suppressHydrationWarning>
                      {attendanceBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_att_desc}</p>
              </div>
            </button>

            {/* Diapers tile - always route-based */}
            <button
              onClick={handleDiapersClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isDiapersActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isDiapersActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <Baby className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isDiapersActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.tile_diaper}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_diaper_desc}</p>
              </div>
            </button>

            {/* Messages tile - always route-based */}
            <button
              onClick={handleMessagesClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isMessagesActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isMessagesActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <MessageSquare className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isMessagesActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.tile_msg}
                  </span>
                  {messagesBadge !== undefined && messagesBadge !== null && messagesBadge !== 0 && (
                    <span className="flex-shrink-0 rounded-full bg-slate-700 dark:bg-slate-600 px-2 py-0.5 text-xs font-medium text-slate-100 dark:text-slate-300" suppressHydrationWarning>
                      {messagesBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_msg_desc}</p>
              </div>
            </button>

            {/* Media tile - always route-based */}
            <button
              onClick={handleMediaClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isMediaActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isMediaActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <Camera className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isMediaActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.tile_media}
                  </span>
                  {mediaBadge !== undefined && mediaBadge !== null && mediaBadge !== 0 && (
                    <span className="flex-shrink-0 rounded-full bg-slate-700 dark:bg-slate-600 px-2 py-0.5 text-xs font-medium text-slate-100 dark:text-slate-300" suppressHydrationWarning>
                      {mediaBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_media_desc}</p>
              </div>
            </button>

            {/* Stories tile - always route-based */}
            <button
              onClick={handleStoriesClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isStoriesActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isStoriesActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <Timer className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isStoriesActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.tile_stories}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_stories_desc}</p>
              </div>
            </button>

            {/* Announcements tile - always route-based */}
            <button
              onClick={handleAnnouncementsClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isAnnouncementsActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isAnnouncementsActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <Bell className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isAnnouncementsActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.tile_announcements}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_announcements_desc}</p>
              </div>
            </button>

            {/* Students tile - always route-based */}
            <button
              onClick={handleStudentsClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isStudentsActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isStudentsActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <Users className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isStudentsActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.tile_students}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_students_desc}</p>
              </div>
            </button>

            {/* Guardians tile - always route-based */}
            <button
              onClick={handleGuardiansClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isGuardiansActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isGuardiansActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <Shield className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isGuardiansActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.tile_guardians || 'Guardians'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_guardians_desc || 'Manage guardians'}</p>
              </div>
            </button>

            {/* Link Student tile - always route-based */}
            <button
              onClick={handleLinkStudentClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isLinkStudentActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isLinkStudentActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <LinkIcon className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isLinkStudentActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.tile_link_student || 'Link Student'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_link_student_desc || 'Link a guardian to a student'}</p>
              </div>
            </button>

            {/* Menus tile - always route-based */}
            <button
              onClick={handleMenusClick}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isMenusActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isMenusActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <Utensils className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isMenusActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.tile_menus || 'Menus'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_menus_desc || 'Manage daily menus'}</p>
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
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                    'hover:bg-slate-800 dark:hover:bg-slate-700',
                    isActive
                      ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                      : 'border-l-4 border-transparent'
                  )}
                >
                  <span className={clsx(
                    'flex-shrink-0 rounded-lg p-2',
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                      : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
                  )}>
                    <tile.Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={clsx(
                        'font-medium truncate',
                        isActive
                          ? 'text-slate-100 dark:text-slate-100'
                          : 'text-slate-200 dark:text-slate-300'
                      )}>
                        {tile.title}
                      </span>
                      {tile.badge !== undefined && tile.badge !== null && tile.badge !== 0 && (
                        <span className="flex-shrink-0 rounded-full bg-slate-700 dark:bg-slate-600 px-2 py-0.5 text-xs font-medium text-slate-100 dark:text-slate-300" suppressHydrationWarning>
                          {tile.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{tile.desc}</p>
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
          className="fixed top-14 bottom-0 left-0 right-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={handleSidebarClose}
          aria-hidden="true"
        />
      )}
    </>
  );
});

TeacherSidebar.displayName = 'TeacherSidebar';

export default TeacherSidebar;

