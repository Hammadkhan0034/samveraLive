'use client';

import React, { useState, useImperativeHandle, forwardRef, useEffect, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { LayoutDashboard, Users, School, Shield, Building2, GraduationCap, BookOpen, UserPlus } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';

// Small helper
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export interface AdminSidebarTile {
  id: string;
  title: string;
  desc: string;
  Icon: React.ElementType;
  badge?: string | number;
  route?: string; // For route-based navigation
}

export interface AdminSidebarProps {
  tiles?: AdminSidebarTile[]; // For any custom tiles
}

export interface AdminSidebarRef {
  open: () => void;
  close: () => void;
}

type BuiltInTileId =
  | 'dashboard'
  | 'organizations'
  | 'principals'
  | 'teachers'
  | 'guardians'
  | 'students';

interface BuiltInTileConfig {
  id: BuiltInTileId;
  route: string;
}

const builtInTileRoutes: BuiltInTileConfig[] = [
  { id: 'dashboard', route: '/dashboard/admin' },
  { id: 'organizations', route: '/dashboard/admin' }, // Organizations managed on main dashboard
  { id: 'principals', route: '/dashboard/admin' }, // Principals managed on main dashboard
  { id: 'teachers', route: '/dashboard/admin' }, // Teachers managed on main dashboard
  { id: 'guardians', route: '/dashboard/admin' }, // Guardians managed on main dashboard
  { id: 'students', route: '/dashboard/admin' }, // Students managed on main dashboard
];

const getRouteForTileId = (tileId: string): string | undefined => {
  const config = builtInTileRoutes.find((tile) => tile.id === tileId);
  return config?.route;
};

const getBasePathnameFromRoute = (route: string): string => route.split('?')[0];

const AdminSidebarContent = forwardRef<AdminSidebarRef, AdminSidebarProps>(({
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
      setTimeout(() => {
        setOptimisticActiveTile(null);
      }, 0);
    }
  }, [pathname, optimisticActiveTile]);

  // Determine if a tile is active based on optimistic state or pathname
  const isTileActive = (tileId: string, tileRoute?: string): boolean => {
    // If there's an optimistic active tile, only that tile should be active
    if (optimisticActiveTile !== null) {
      return optimisticActiveTile === tileId;
    }

    // For admin dashboard, all tiles point to the same route, so we check if we're on the admin dashboard
    if (pathname === '/dashboard/admin') {
      // Default to dashboard being active
      return tileId === 'dashboard';
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

  // Handle custom tiles that provide explicit routes
  const handleCustomTileClick = (tile: AdminSidebarTile) => {
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
        <div className="p-ds-md">
          {/* App Logo */}
          <div className="py-ds-sm mb-ds-md flex items-center justify-start">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
              <span className="inline-block rounded-lg bg-mint-200 dark:bg-mint-500 text-slate-900 dark:text-white py-2 px-4 text-2xl font-bold">S</span>
              <span className="text-2xl ml-2">Samvera</span>
            </div>
          </div>

          {/* Mobile close button */}
          <div className="mb-ds-sm flex items-center justify-between md:hidden">
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
          <nav className="space-y-3">
            {/* Dashboard tile */}
            <button
              onClick={() => handleBuiltInTileClick('dashboard')}
              className={clsx(
                'w-full flex items-center gap-3 px-ds-sm py-ds-sm rounded-ds-md text-left transition-all duration-200',
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
                    {t.adminDashboard || 'Admin Dashboard'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  View dashboard overview
                </p>
              </div>
            </button>

            {/* Organizations tile */}
            <button
              onClick={() => handleBuiltInTileClick('organizations')}
              className={clsx(
                'w-full flex items-center gap-3 px-ds-sm py-ds-sm rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('organizations')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('organizations')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Building2 className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('organizations')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.organizations || 'Organizations'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Manage organizations
                </p>
              </div>
            </button>

            {/* Principals tile */}
            <button
              onClick={() => handleBuiltInTileClick('principals')}
              className={clsx(
                'w-full flex items-center gap-3 px-ds-sm py-ds-sm rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('principals')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('principals')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <Shield className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('principals')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.principals || 'Principals'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Manage principals
                </p>
              </div>
            </button>

            {/* Teachers tile */}
            <button
              onClick={() => handleBuiltInTileClick('teachers')}
              className={clsx(
                'w-full flex items-center gap-3 px-ds-sm py-ds-sm rounded-ds-md text-left transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                isTileActive('teachers')
                  ? 'bg-mint-200 dark:bg-slate-700 border-l-4 border-mint-500'
                  : 'border-l-4 border-transparent'
              )}
            >
              <span className={clsx(
                'flex-shrink-0 rounded-lg p-2',
                isTileActive('teachers')
                  ? 'bg-mint-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              )}>
                <GraduationCap className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('teachers')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.teachers || 'Teachers'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Manage teachers
                </p>
              </div>
            </button>

            {/* Guardians tile */}
            <button
              onClick={() => handleBuiltInTileClick('guardians')}
              className={clsx(
                'w-full flex items-center gap-3 px-ds-sm py-ds-sm rounded-ds-md text-left transition-all duration-200',
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
                <UserPlus className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('guardians')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.parents || 'Guardians'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Manage guardians
                </p>
              </div>
            </button>

            {/* Students tile */}
            <button
              onClick={() => handleBuiltInTileClick('students')}
              className={clsx(
                'w-full flex items-center gap-3 px-ds-sm py-ds-sm rounded-ds-md text-left transition-all duration-200',
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
                <BookOpen className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx(
                    'font-medium truncate',
                    isTileActive('students')
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {t.students || 'Students'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Manage students
                </p>
              </div>
            </button>

            {/* Custom tiles */}
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

AdminSidebarContent.displayName = 'AdminSidebarContent';

const AdminSidebar = forwardRef<AdminSidebarRef, AdminSidebarProps>((props, ref) => {
  return (
    <Suspense fallback={<div className="w-[280px] bg-white dark:bg-slate-800 rounded-tr-[24px] rounded-br-[24px]" />}>
      <AdminSidebarContent {...props} ref={ref} />
    </Suspense>
  );
});

AdminSidebar.displayName = 'AdminSidebar';

export default AdminSidebar;
