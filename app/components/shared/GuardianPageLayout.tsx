'use client';

import React, { useRef, createContext, useContext } from 'react';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import GuardianSidebar, { GuardianSidebarRef } from './GuardianSidebar';
import Loading from './Loading';
import Navbar from '@/app/components/Navbar';

interface GuardianPageLayoutProps {
  children: React.ReactNode;
  messagesBadge?: number;
}

interface GuardianPageLayoutContextValue {
  sidebarRef: React.RefObject<GuardianSidebarRef>;
}

const GuardianPageLayoutContext = createContext<GuardianPageLayoutContextValue | null>(null);

export function useGuardianPageLayout() {
  const context = useContext(GuardianPageLayoutContext);
  if (!context) {
    throw new Error('useGuardianPageLayout must be used within GuardianPageLayout');
  }
  return context;
}

export default function GuardianPageLayout({
  children,
  messagesBadge,
}: GuardianPageLayoutProps) {
  const { user, loading, isSigningIn } = useRequireAuth('guardian');
  const sidebarRef = useRef<GuardianSidebarRef>(null);

  // Show loading state while checking authentication
  if (loading || (isSigningIn && !user)) {
    return <Loading fullScreen />;
  }

  // Safety check: if user is still not available after loading, don't render
  if (!loading && !isSigningIn && !user) {
    return null;
  }

  return (
    <GuardianPageLayoutContext.Provider value={{ sidebarRef }}>
      {/* Design System: Sidebar + Main Content Structure */}
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar - 280px wide, white background, fixed left position */}
        <GuardianSidebar
          ref={sidebarRef}
          messagesBadge={messagesBadge}
        />

        {/* Right side: navbar + content column */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Navbar - positioned beside sidebar */}
          <Navbar variant="static" hideLogo={true} />

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
    </GuardianPageLayoutContext.Provider>
  );
}
