'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import PrincipalDashboard from '../../../components/PrincipalDashboard';
import { useRequireAuth, useAuth } from '../../../../lib/hooks/useAuth';
import LinkStudentGuardian from '../../../components/LinkStudentGuardian';

export default function PrincipalDashboardPage() {
  const router = useRouter();
  const { user, loading, isSigningIn } = useRequireAuth('principal');
  const { lang } = useLanguage();

  // Show loading ONLY if we have no user yet (avoid flicker after sign-in)
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading principal dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <PrincipalDashboard lang={lang} />
      <div className="mx-auto max-w-7xl px-4 md:px-6 mt-6">
        {/* Link Guardian ↔ Student widget */}
        <LinkStudentGuardian lang={lang} />
      </div>
    </div>
  );
}