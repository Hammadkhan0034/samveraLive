'use client';

import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { ActivityLog } from '@/app/components/shared/ActivityLog';

function TeacherDailyLogsPageContent() {
  const { t } = useLanguage();
  const { sidebarRef } = useTeacherPageLayout();

  return (
      <ActivityLog 
        canEdit={true} 
        canDelete={true}
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />
  );
}

export default function TeacherDailyLogsPage() {
  return (
    <TeacherPageLayout>
      <TeacherDailyLogsPageContent />
    </TeacherPageLayout>
  );
}

