'use client';

import React, { useRef, createContext, useContext } from 'react';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar, { TeacherSidebarRef } from './TeacherSidebar';
import Loading from './Loading';
import Navbar from '@/app/components/Navbar';

interface TeacherPageLayoutProps {
  children: React.ReactNode;
  attendanceBadge?: number;
  messagesBadge?: number;
  mediaBadge?: number;
}

interface TeacherPageLayoutContextValue {
  sidebarRef: React.RefObject<TeacherSidebarRef>;
}

const TeacherPageLayoutContext = createContext<TeacherPageLayoutContextValue | null>(null);

export function useTeacherPageLayout() {
  const context = useContext(TeacherPageLayoutContext);
  if (!context) {
    throw new Error('useTeacherPageLayout must be used within TeacherPageLayout');
  }
  return context;
}

export default function TeacherPageLayout({
  children,
  attendanceBadge,
  messagesBadge,
  mediaBadge,
}: TeacherPageLayoutProps) {
  const { user, loading, isSigningIn } = useRequireAuth('teacher');
  const sidebarRef = useRef<TeacherSidebarRef>(null);

  // Show loading state while checking authentication
  if (loading || (isSigningIn && !user)) {
    return <Loading fullScreen />;
  }

  // Safety check: if user is still not available after loading, don't render
  if (!loading && !isSigningIn && !user) {
    return null;
  }

  return (
    <TeacherPageLayoutContext.Provider value={{ sidebarRef }}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar - full height on left */}
        <TeacherSidebar
          ref={sidebarRef}
          attendanceBadge={attendanceBadge}
          messagesBadge={messagesBadge}
          mediaBadge={mediaBadge}
        />

        {/* Right side: navbar + content column */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Navbar - positioned beside sidebar */}
          <Navbar variant="static" />
          
          {/* Main content area - below navbar */}
          <main 
            className="flex-1 overflow-y-auto"
            style={{
              backgroundColor: 'var(--ds-mint)',
            }}
          >
            <div className="p-3 sm:p-4 md:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TeacherPageLayoutContext.Provider>
  );
}

