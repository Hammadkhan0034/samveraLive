'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Camera, Timer, Bell, Users } from 'lucide-react';

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
  activeTile?: string | null; // For active state mode (used in main dashboard)
  onTileClick?: (tileId: string) => void; // For active state mode (used in main dashboard)
  sidebarOpen: boolean;
  onSidebarClose: () => void;
  tiles: TeacherSidebarTile[];
  pathname: string; // For route-based active state detection
  // Special tiles that are always route-based
  attendanceTile?: {
    title: string;
    desc: string;
    badge?: string | number;
  };
  diapersTile?: {
    title: string;
    desc: string;
  };
  messagesTile?: {
    title: string;
    desc: string;
    badge?: string | number;
  };
  mediaTile?: {
    title: string;
    desc: string;
    badge?: string | number;
  };
  storiesTile?: {
    title: string;
    desc: string;
  };
  announcementsTile?: {
    title: string;
    desc: string;
  };
  studentsTile?: {
    title: string;
    desc: string;
  };
}

export default function TeacherSidebar({
  activeTile,
  onTileClick,
  sidebarOpen,
  onSidebarClose,
  tiles,
  pathname,
  attendanceTile,
  diapersTile,
  messagesTile,
  mediaTile,
  storiesTile,
  announcementsTile,
  studentsTile,
}: TeacherSidebarProps) {
  const router = useRouter();

  // Determine if a tile is active
  const isTileActive = (tileId: string, tileRoute?: string): boolean => {
    // If activeTile is provided (active state mode), use it
    if (activeTile !== undefined && activeTile !== null) {
      return activeTile === tileId;
    }
    // Otherwise, use pathname-based detection (route mode)
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
    return false;
  };

  // Handle tile click
  const handleTileClick = (tile: TeacherSidebarTile) => {
    if (tile.route) {
      // Route-based navigation - navigate to the new route
      // This will completely replace the current page (e.g., messages page will be hidden)
      router.push(tile.route);
      onSidebarClose();
    } else if (onTileClick) {
      // Active state-based navigation
      onTileClick(tile.id);
      onSidebarClose();
    }
  };

  // Handle attendance tile click
  const handleAttendanceClick = () => {
    if (pathname !== '/dashboard/teacher/attendance') {
      router.replace('/dashboard/teacher/attendance');
    }
    onSidebarClose();
  };

  // Handle diapers tile click
  const handleDiapersClick = () => {
    if (pathname !== '/dashboard/teacher/diapers') {
      router.replace('/dashboard/teacher/diapers');
    }
    onSidebarClose();
  };

  // Handle messages tile click
  const handleMessagesClick = () => {
    if (pathname !== '/dashboard/teacher/messages') {
      router.replace('/dashboard/teacher/messages');
    }
    onSidebarClose();
  };

  // Handle media tile click
  const handleMediaClick = () => {
    if (pathname !== '/dashboard/teacher/media') {
      router.replace('/dashboard/teacher/media');
    }
    onSidebarClose();
  };

  // Handle stories tile click
  const handleStoriesClick = () => {
    if (pathname !== '/dashboard/teacher/stories') {
      router.replace('/dashboard/teacher/stories');
    }
    onSidebarClose();
  };

  // Handle announcements tile click
  const handleAnnouncementsClick = () => {
    if (pathname !== '/dashboard/teacher/announcements') {
      router.replace('/dashboard/teacher/announcements');
    }
    onSidebarClose();
  };

  // Handle students tile click
  const handleStudentsClick = () => {
    if (pathname !== '/dashboard/teacher/students') {
      router.replace('/dashboard/teacher/students');
    }
    onSidebarClose();
  };

  const isAttendanceActive = pathname === '/dashboard/teacher/attendance';
  const isDiapersActive = pathname === '/dashboard/teacher/diapers';
  const isMessagesActive = pathname === '/dashboard/teacher/messages';
  const isMediaActive = pathname === '/dashboard/teacher/media';
  const isStoriesActive = pathname === '/dashboard/teacher/stories';
  const isAnnouncementsActive = pathname === '/dashboard/teacher/announcements';
  const isStudentsActive = pathname === '/dashboard/teacher/students';

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
              onClick={onSidebarClose}
              className="p-2 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 text-slate-200 dark:text-slate-300"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="space-y-1">
            {/* Attendance tile - always route-based */}
            {attendanceTile && (
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
                      {attendanceTile.title}
                    </span>
                    {attendanceTile.badge !== undefined && attendanceTile.badge !== null && attendanceTile.badge !== 0 && (
                      <span className="flex-shrink-0 rounded-full bg-slate-700 dark:bg-slate-600 px-2 py-0.5 text-xs font-medium text-slate-100 dark:text-slate-300" suppressHydrationWarning>
                        {attendanceTile.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{attendanceTile.desc}</p>
                </div>
              </button>
            )}

            {/* Diapers tile - always route-based */}
            {diapersTile && (
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
                      {diapersTile.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{diapersTile.desc}</p>
                </div>
              </button>
            )}

            {/* Messages tile - always route-based */}
            {messagesTile && (
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
                      {messagesTile.title}
                    </span>
                    {messagesTile.badge !== undefined && messagesTile.badge !== null && messagesTile.badge !== 0 && (
                      <span className="flex-shrink-0 rounded-full bg-slate-700 dark:bg-slate-600 px-2 py-0.5 text-xs font-medium text-slate-100 dark:text-slate-300" suppressHydrationWarning>
                        {messagesTile.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{messagesTile.desc}</p>
                </div>
              </button>
            )}

            {/* Media tile - always route-based */}
            {mediaTile && (
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
                      {mediaTile.title}
                    </span>
                    {mediaTile.badge !== undefined && mediaTile.badge !== null && mediaTile.badge !== 0 && (
                      <span className="flex-shrink-0 rounded-full bg-slate-700 dark:bg-slate-600 px-2 py-0.5 text-xs font-medium text-slate-100 dark:text-slate-300" suppressHydrationWarning>
                        {mediaTile.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{mediaTile.desc}</p>
                </div>
              </button>
            )}

            {/* Stories tile - always route-based */}
            {storiesTile && (
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
                      {storiesTile.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{storiesTile.desc}</p>
                </div>
              </button>
            )}

            {/* Announcements tile - always route-based */}
            {announcementsTile && (
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
                      {announcementsTile.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{announcementsTile.desc}</p>
                </div>
              </button>
            )}

            {/* Students tile - always route-based */}
            {studentsTile && (
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
                      {studentsTile.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">{studentsTile.desc}</p>
                </div>
              </button>
            )}

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
          onClick={onSidebarClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}

