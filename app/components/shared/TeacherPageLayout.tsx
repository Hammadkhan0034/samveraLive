'use client';

import React, { useRef, createContext, useContext } from 'react';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar, { TeacherSidebarRef } from './TeacherSidebar';
import Loading from './Loading';

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
      <div className="flex flex-col h-screen overflow-hidden md:pt-14">
        {/* Main content area with sidebar and content - starts below navbar */}
        <div className="flex flex-1 overflow-hidden h-full">
          {/* Sidebar */}
          <TeacherSidebar
            ref={sidebarRef}
            attendanceBadge={attendanceBadge}
            messagesBadge={messagesBadge}
            mediaBadge={mediaBadge}
          />

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
            <div className="p-2 md:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TeacherPageLayoutContext.Provider>
  );
}

