'use client';

import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import MessagesPanel from '@/app/components/shared/MessagesPanel';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';

function PrincipalMessagesPageContent() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { sidebarRef } = usePrincipalPageLayout();

  return (
    <>
      <PageHeader
        title={t.messages_title || 'Messages'}
        subtitle={t.messages_subtitle || 'View and manage messages'}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />
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

