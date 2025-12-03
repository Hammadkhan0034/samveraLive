"use client";

import React from 'react';
import StaffManagement from '@/app/components/StaffManagement';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';

function PrincipalStaffPageContent() {
  const { t } = useLanguage();
  const { sidebarRef } = usePrincipalPageLayout();

  return (
    <>
      <PageHeader
        title={t.staff}
        subtitle={t.staff_subtitle}
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />
      {/* Pull staff management section slightly closer to the header to match other principal pages */}
      <StaffManagement />
    </>
  );
}

export default function PrincipalStaffPage() {
  return (
    <PrincipalPageLayout>
      <PrincipalStaffPageContent />
    </PrincipalPageLayout>
  );
}


