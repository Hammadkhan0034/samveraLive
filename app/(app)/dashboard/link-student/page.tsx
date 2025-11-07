'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import LinkStudentGuardian from '../../../components/LinkStudentGuardian';
import { useRequireAuth, useAuth } from '../../../../lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';

export default function LinkStudentPage() {
  const router = useRouter();
  const { user, loading, isSigningIn } = useRequireAuth(['teacher', 'principal']);
  const { lang } = useLanguage();


  if (loading && !user && isSigningIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 mt-10">
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {lang === 'is' ? 'Til baka' : 'Back'}
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {lang === 'is' ? 'Tengja nemanda' : 'Link Student'}
            </h1>
          </div>
          <LinkStudentGuardian lang={lang} />
      </main>
    </div>
  );
}


