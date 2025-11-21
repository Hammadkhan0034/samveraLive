'use client';

import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import MessagesPanel from '@/app/components/shared/MessagesPanel';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';

export default function GuardianMessagesPage() {
  const { user, loading } = useRequireAuth('parent');
  const { t, lang } = useLanguage();
  const router = useRouter();

  if (!user && loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 mt-10">
          <div className="mb-6">
            <div className="h-10 w-20 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          </div>
          <LoadingSkeleton type="default" rows={8} />
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 mt-10">
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {lang === 'is' ? 'Til baka' : 'Back'}
            </button>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {t.messages_title || 'Messages'}
            </h1>
          </div>
        </div>
        <MessagesPanel role="guardian" />
      </main>
    </div>
  );
}

