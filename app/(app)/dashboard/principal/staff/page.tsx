"use client";

import React from 'react';
import { Menu } from 'lucide-react';
import StaffManagement from '@/app/components/StaffManagement';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';

function PrincipalStaffPageContent() {
  const { t } = useLanguage();
  const { sidebarRef } = usePrincipalPageLayout();

  return (
    <>
      {/* Content Header */}
      <div className="mb-ds-sm flex flex-col gap-ds-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-ds-sm">
          {/* Mobile menu button */}
          <button
            onClick={() => sidebarRef.current?.open()}
            className="md:hidden p-2 rounded-ds-md hover:bg-mint-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
         
        </div>
        <div className="flex items-center gap-ds-sm">
          <ProfileSwitcher />
        </div>
      </div>
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


