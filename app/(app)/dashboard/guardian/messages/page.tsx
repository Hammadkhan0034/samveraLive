'use client';

import React, { Suspense } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import MessagesPanel from '@/app/components/shared/MessagesPanel';
import GuardianPageLayout, { useGuardianPageLayout } from '@/app/components/shared/GuardianPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';

function GuardianMessagesContent() {
  const { t } = useLanguage();
  const { sidebarRef } = useGuardianPageLayout();

  return (
    <>
      <PageHeader
        title={t.messages_title || 'Messages'}
        subtitle={t.messages_desc || 'View and send messages'}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />
      <MessagesPanel role="guardian" />
    </>
  );
}

function GuardianMessagesPageContent() {
  return (
    <GuardianPageLayout>
      <GuardianMessagesContent />
    </GuardianPageLayout>
  );
}

export default function GuardianMessagesPage() {
  return (
    <Suspense fallback={
      <GuardianPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500 dark:text-slate-400">Loading messages...</div>
        </div>
      </GuardianPageLayout>
    }>
      <GuardianMessagesPageContent />
    </Suspense>
  );
}

