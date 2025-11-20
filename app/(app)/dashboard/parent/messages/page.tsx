'use client';

import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import MessagesPanel from '@/app/components/shared/MessagesPanel';
import Loading from '@/app/components/shared/Loading';

export default function GuardianMessagesPage() {
  const { user, loading } = useRequireAuth('parent');
  const { lang } = useLanguage();
  const router = useRouter();

  if (loading && !user) {
    return <Loading fullScreen text="Loading messages..." />;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 mt-10">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> {lang === 'is' ? 'Til baka' : 'Back'}
          </button>
        </div>
        <MessagesPanel role="guardian" />
      </main>
    </div>
  );
}

