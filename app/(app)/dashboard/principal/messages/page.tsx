'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import MessagesPanel from '@/app/components/shared/MessagesPanel';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';

function PrincipalMessagesPageContent() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { sidebarRef } = usePrincipalPageLayout();

  return (
    <>
      {/* Content Header */}
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            onClick={() => sidebarRef.current?.open()}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {t.messages_title || 'Messages'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t.messages_subtitle || 'View and manage messages'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProfileSwitcher />
        </div>
      </div>
      <MessagesPanel role="principal" />
    </>
  );
}

export default function PrincipalMessagesPage() {
  return (
    <PrincipalPageLayout>
      <PrincipalMessagesPageContent />
    </PrincipalPageLayout>
  );
}

