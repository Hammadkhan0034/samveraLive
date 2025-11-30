'use client';

import React, { useRef, createContext, useContext } from 'react';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import PrincipalSidebar, { PrincipalSidebarRef } from './PrincipalSidebar';
import Loading from './Loading';
import Navbar from '@/app/components/Navbar';

interface PrincipalPageLayoutProps {
  children: React.ReactNode;
  messagesBadge?: number;
}

interface PrincipalPageLayoutContextValue {
  sidebarRef: React.RefObject<PrincipalSidebarRef>;
}

const PrincipalPageLayoutContext = createContext<PrincipalPageLayoutContextValue | null>(null);

export function usePrincipalPageLayout() {
  const context = useContext(PrincipalPageLayoutContext);
  if (!context) {
    throw new Error('usePrincipalPageLayout must be used within PrincipalPageLayout');
  }
  return context;
}

export default function PrincipalPageLayout({
  children,
  messagesBadge,
}: PrincipalPageLayoutProps) {
  const { user, loading, isSigningIn } = useRequireAuth('principal');
  const sidebarRef = useRef<PrincipalSidebarRef>(null);

  // Show loading state while checking authentication
  if (loading || (isSigningIn && !user)) {
    return <Loading fullScreen />;
  }

  // Safety check: if user is still not available after loading, don't render
  if (!loading && !isSigningIn && !user) {
    return null;
  }

  return (
    <PrincipalPageLayoutContext.Provider value={{ sidebarRef }}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar - full height on left */}
        <PrincipalSidebar
          ref={sidebarRef}
          messagesBadge={messagesBadge}
        />

        {/* Right side: navbar + content column */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Navbar - positioned beside sidebar */}
          <Navbar variant="static" />
          
          {/* Main content area - below navbar */}
          <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
            <div className="p-2 md:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </PrincipalPageLayoutContext.Provider>
  );
}

