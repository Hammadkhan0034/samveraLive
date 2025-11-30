'use client';

import React, { useState, useImperativeHandle, forwardRef, useEffect, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { LayoutDashboard, Users, School, ChartBar as BarChart3, MessageSquare, Camera, CalendarDays, Shield, Link as LinkIcon, Utensils, FileText, Megaphone } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';

// Small helper
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export interface PrincipalSidebarTile {
  id: string;
  title: string;
  desc: string;
  Icon: React.ElementType;
  badge?: string | number;
  route?: string; // For route-based navigation
}

export interface PrincipalSidebarProps {
  messagesBadge?: number; // Optional badge count for messages
  tiles?: PrincipalSidebarTile[]; // For any custom tiles
}

export interface PrincipalSidebarRef {
  open: () => void;
  close: () => void;
}

const PrincipalSidebarContent = forwardRef<PrincipalSidebarRef, PrincipalSidebarProps>(({
  messagesBadge,
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
      'dashboard': '/dashboard/principal',
      'students': '/dashboard/principal/students',
      'staff': '/dashboard/principal/staff',
      'classes': '/dashboard/principal/classes',
      'messages': '/dashboard/principal/messages',
      'photos': '/dashboard/principal/photos',
      'calendar': '/dashboard/principal/calendar',
      'guardians': '/dashboard/guardians',
      'link_student': '/dashboard/link-student',
      'menus': '/dashboard/menus-list',
      'stories': '/dashboard/stories',
      'announcements': '/dashboard/announcements',
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
        // For routes with query params like /dashboard/principal?tab=media
        // Check if we're on the base path and the tab matches
        return pathname === routePathname;
      }
      return pathname === tileRoute;
    }
    // For special tiles, check pathname
    if (tileId === 'dashboard') {
      return pathname === '/dashboard/principal';
    }
    if (tileId === 'students') {
      return pathname === '/dashboard/principal/students';
    }
    if (tileId === 'staff') {
      return pathname === '/dashboard/principal/staff';
    }
    if (tileId === 'classes') {
      return pathname === '/dashboard/principal/classes';
    }
    if (tileId === 'messages') {
      return pathname === '/dashboard/principal/messages';
    }
    if (tileId === 'photos') {
      return pathname === '/dashboard/principal/photos';
    }
    if (tileId === 'calendar') {
      return pathname === '/dashboard/principal/calendar';
    }
    if (tileId === 'guardians') {
      return pathname === '/dashboard/guardians';
    }
    if (tileId === 'link_student') {
      return pathname === '/dashboard/link-student';
    }
    if (tileId === 'menus') {
      return pathname === '/dashboard/menus-list';
    }
    if (tileId === 'stories') {
      return pathname === '/dashboard/stories';
    }
    if (tileId === 'announcements') {
      return pathname === '/dashboard/announcements';
    }
    return false;
  };

  // Handle tile click
  const handleTileClick = (tile: PrincipalSidebarTile) => {
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
    if (pathname !== '/dashboard/principal') {
      router.replace('/dashboard/principal');
    }
    handleSidebarClose();
  };

  // Handle students tile click
  const handleStudentsClick = () => {
    setOptimisticActiveTile('students');
    if (pathname !== '/dashboard/principal/students') {
      router.replace('/dashboard/principal/students');
    }
    handleSidebarClose();
  };

  // Handle staff tile click
  const handleStaffClick = () => {
    setOptimisticActiveTile('staff');
    if (pathname !== '/dashboard/principal/staff') {
      router.replace('/dashboard/principal/staff');
    }
    handleSidebarClose();
  };

  // Handle classes tile click
  const handleClassesClick = () => {
    setOptimisticActiveTile('classes');
    if (pathname !== '/dashboard/principal/classes') {
      router.replace('/dashboard/principal/classes');
    }
    handleSidebarClose();
  };

  // Handle messages tile click
  const handleMessagesClick = () => {
    setOptimisticActiveTile('messages');
    if (pathname !== '/dashboard/principal/messages') {
      router.replace('/dashboard/principal/messages');
    }
    handleSidebarClose();
  };

  // Handle photos tile click
  const handlePhotosClick = () => {
    setOptimisticActiveTile('photos');
    if (pathname !== '/dashboard/principal/photos') {
      router.replace('/dashboard/principal/photos');
    }
    handleSidebarClose();
  };

  // Handle calendar tile click
  const handleCalendarClick = () => {
    setOptimisticActiveTile('calendar');
    if (pathname !== '/dashboard/principal/calendar') {
      router.replace('/dashboard/principal/calendar');
    }
    handleSidebarClose();
  };

  // Handle guardians tile click
  const handleGuardiansClick = () => {
    setOptimisticActiveTile('guardians');
    if (pathname !== '/dashboard/guardians') {
      router.replace('/dashboard/guardians');
    }
    handleSidebarClose();
  };

  // Handle link student tile click
  const handleLinkStudentClick = () => {
    setOptimisticActiveTile('link_student');
    if (pathname !== '/dashboard/link-student') {
      router.replace('/dashboard/link-student');
    }
    handleSidebarClose();
  };

  // Handle menus tile click
  const handleMenusClick = () => {
    setOptimisticActiveTile('menus');
    if (pathname !== '/dashboard/menus-list') {
      router.replace('/dashboard/menus-list');
    }
    handleSidebarClose();
  };

  // Handle stories tile click
  const handleStoriesClick = () => {
    setOptimisticActiveTile('stories');
    if (pathname !== '/dashboard/stories') {
      router.replace('/dashboard/stories');
    }
    handleSidebarClose();
  };

  // Handle announcements tile click
  const handleAnnouncementsClick = () => {
    setOptimisticActiveTile('announcements');
    if (pathname !== '/dashboard/announcements') {
      router.replace('/dashboard/announcements');
    }
    handleSidebarClose();
  };

  // Use isTileActive helper for consistent optimistic state handling
  const isDashboardActive = isTileActive('dashboard');
  const isStudentsActive = isTileActive('students');
  const isStaffActive = isTileActive('staff');
  const isClassesActive = isTileActive('classes');
  const isMessagesActive = isTileActive('messages');
  const isPhotosActive = isTileActive('photos');
  const isCalendarActive = isTileActive('calendar');
  const isGuardiansActive = isTileActive('guardians');
  const isLinkStudentActive = isTileActive('link_student');
  const isMenusActive = isTileActive('menus');
  const isStoriesActive = isTileActive('stories');
  const isAnnouncementsActive = isTileActive('announcements');

  return (
    <>
      {/* Sidebar */}
      <aside
        className={clsx(
          'flex-shrink-0 w-[280px] bg-slate-900 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transition-transform duration-300 ease-in-out',
          'scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
          sidebarOpen 
            ? 'fixed top-0 bottom-0 left-0 z-50 translate-x-0 md:sticky md:top-0 md:h-screen md:overflow-y-auto md:translate-x-0' 
            : 'fixed top-0 bottom-0 left-0 z-50 -translate-x-full md:sticky md:top-0 md:h-screen md:overflow-y-auto md:translate-x-0'
        )}
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="py-4">
          {/* App Logo */}
          <div className="py-6 mb-4 flex items-center justify-start px-4">
            <div className="flex items-center gap-2 font-semibold text-slate-100 dark:text-slate-100">
              <span className="inline-block rounded-md bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900 py-2 px-4 text-2xl">S</span>
              <span className="text-2xl ml-2">Samvera</span>
            </div>
          </div>
          
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
          <nav className="space-y-1 px-2">
            {/* Dashboard tile - always route-based */}
            <button
              onClick={handleDashboardClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
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
                    {t.title || 'Principal Dashboard'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">
                  View dashboard overview
                </p>
              </div>
            </button>

            {/* Students tile */}
            <button
              onClick={handleStudentsClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
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

            {/* Staff tile */}
            <button
              onClick={handleStaffClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isStaffActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isStaffActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <School className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isStaffActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.kpi_staff || 'Staff'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">Manage staff members</p>
              </div>
            </button>

            {/* Classes tile */}
            <button
              onClick={handleClassesClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isClassesActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isClassesActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <BarChart3 className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isClassesActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.kpi_classes || 'Classes'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">Manage classes</p>
              </div>
            </button>

            {/* Messages tile */}
            <button
              onClick={handleMessagesClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
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

            {/* Photos tile */}
            <button
              onClick={handlePhotosClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isPhotosActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isPhotosActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <Camera className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isPhotosActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.kpi_photos || 'Photos'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">View and manage photos</p>
              </div>
            </button>

            {/* Calendar tile */}
            <button
              onClick={handleCalendarClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
                'hover:bg-slate-800 dark:hover:bg-slate-700',
                isCalendarActive
                  ? 'bg-slate-800 dark:bg-slate-700 border-l-4 border-slate-100 dark:border-slate-100'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isCalendarActive
                  ? 'bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-900'
                  : 'bg-slate-800 dark:bg-slate-700 text-slate-200 dark:text-slate-300'
              )}>
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isCalendarActive
                      ? 'text-slate-100 dark:text-slate-100'
                      : 'text-slate-200 dark:text-slate-300'
                  )}>
                    {t.tile_calendar}
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{t.tile_calendar_desc}</p>
              </div>
            </button>

            {/* Guardians tile */}
            <button
              onClick={handleGuardiansClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
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

            {/* Link Student tile */}
            <button
              onClick={handleLinkStudentClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
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

            {/* Menus tile */}
            <button
              onClick={handleMenusClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
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

            {/* Stories tile */}
            <button
              onClick={handleStoriesClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
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
                <FileText className="h-5 w-5" />
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

            {/* Announcements tile */}
            <button
              onClick={handleAnnouncementsClick}
              className={clsx(
                'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
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
                <Megaphone className="h-5 w-5" />
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

            {/* Other tiles */}
            {tiles.map((tile) => {
              const isActive = isTileActive(tile.id, tile.route);
              return (
                <button
                  key={tile.id}
                  onClick={() => handleTileClick(tile)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-2 py-3 rounded-lg text-left transition-colors',
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
          className="fixed top-0 bottom-0 left-0 right-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={handleSidebarClose}
          aria-hidden="true"
        />
      )}
    </>
  );
});

PrincipalSidebarContent.displayName = 'PrincipalSidebarContent';

const PrincipalSidebar = forwardRef<PrincipalSidebarRef, PrincipalSidebarProps>((props, ref) => {
  return (
    <Suspense fallback={<div className="w-72 bg-slate-900 dark:bg-slate-800" />}>
      <PrincipalSidebarContent {...props} ref={ref} />
    </Suspense>
  );
});

PrincipalSidebar.displayName = 'PrincipalSidebar';

export default PrincipalSidebar;

