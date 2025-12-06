'use client';

import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { ActivityLog } from '@/app/components/shared/ActivityLog';

function PrincipalDailyLogsPageContent() {
  const { t } = useLanguage();
  const { sidebarRef } = usePrincipalPageLayout();

  return (
    <ActivityLog 
      canEdit={true} 
      canDelete={true}
      showMobileMenu={true}
      onMobileMenuClick={() => sidebarRef.current?.open()}
    />
  );
}

export default function PrincipalDailyLogsPage() {
  return (
    <PrincipalPageLayout>
      <PrincipalDailyLogsPageContent />
    </PrincipalPageLayout>
  );
}

