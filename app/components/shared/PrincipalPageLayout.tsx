'use client';

import React, { createContext, useContext } from 'react';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import Loading from './Loading';
import Navbar from '@/app/components/Navbar';

interface PrincipalPageLayoutProps {
  children: React.ReactNode;
  messagesBadge?: number;
}

interface PrincipalPageLayoutContextValue {
  sidebarRef: React.RefObject<{ open: () => void; close: () => void }> | null;
}

const PrincipalPageLayoutContext = createContext<PrincipalPageLayoutContextValue | null>(null);

export function usePrincipalPageLayout() {
  const context = useContext(PrincipalPageLayoutContext);
  // Return a default context with null sidebarRef if not found
  return context || { sidebarRef: null };
}

export default function PrincipalPageLayout({
  children,
  messagesBadge,
}: PrincipalPageLayoutProps) {
  const { user, loading, isSigningIn } = useRequireAuth('principal');

  // Show loading state while checking authentication
  if (loading || (isSigningIn && !user)) {
    return <Loading fullScreen />;
  }

  // Safety check: if user is still not available after loading, don't render
  if (!loading && !isSigningIn && !user) {
    return null;
  }

  return (
    <PrincipalPageLayoutContext.Provider value={{ sidebarRef: null }}>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Navbar */}
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
    </PrincipalPageLayoutContext.Provider>
  );
}

