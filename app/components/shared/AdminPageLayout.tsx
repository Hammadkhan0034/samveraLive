'use client';

import React, { useRef, createContext, useContext } from 'react';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import AdminSidebar, { AdminSidebarRef } from './AdminSidebar';
import Loading from './Loading';
import Navbar from '@/app/components/Navbar';

interface AdminPageLayoutProps {
  children: React.ReactNode;
}

interface AdminPageLayoutContextValue {
  sidebarRef: React.RefObject<AdminSidebarRef>;
}

const AdminPageLayoutContext = createContext<AdminPageLayoutContextValue | null>(null);

export function useAdminPageLayout() {
  const context = useContext(AdminPageLayoutContext);
  if (!context) {
    throw new Error('useAdminPageLayout must be used within AdminPageLayout');
  }
  return context;
}

export default function AdminPageLayout({
  children,
}: AdminPageLayoutProps) {
  const { user, loading, isSigningIn } = useRequireAuth('admin');
  const sidebarRef = useRef<AdminSidebarRef>(null);

  // Show loading state while checking authentication
  if (loading || (isSigningIn && !user)) {
    return <Loading fullScreen />;
  }

  // Safety check: if user is still not available after loading, don't render
  if (!loading && !isSigningIn && !user) {
    return null;
  }

  return (
    <AdminPageLayoutContext.Provider value={{ sidebarRef }}>
      {/* Design System: Sidebar + Main Content Structure */}
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar - 280px wide, white background, fixed left position */}
        <AdminSidebar
          ref={sidebarRef}
        />

        {/* Right side: navbar + content column */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Navbar - positioned beside sidebar */}
          <Navbar variant="static" />

          {/* Main content area - mint green background with 32px padding */}
          <main
            className="flex-1 overflow-y-auto"
            style={{
              backgroundColor: 'var(--ds-mint)',
            }}
          >
            <div className="p-ds-lg">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminPageLayoutContext.Provider>
  );
}
