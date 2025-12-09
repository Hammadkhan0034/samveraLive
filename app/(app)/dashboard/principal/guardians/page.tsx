'use client';

import React, { useRef } from 'react';
import { Plus } from 'lucide-react';

import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { GuardiansClient } from '@/app/components/shared/GuardiansClient';
import { useLanguage } from '@/lib/contexts/LanguageContext';

function PrincipalGuardiansPageContent() {
  const { t } = useLanguage();
  const { sidebarRef } = usePrincipalPageLayout();
  const createGuardianRef = useRef<(() => void) | null>(null);

  return (
    <>
      <PageHeader
        title={t.guardians || 'Guardians'}
        subtitle={t.tile_guardians_desc || 'Manage guardians'}
        headingLevel="h1"
        backHref="/dashboard/principal"
        showBackButton={true}
        rightActions={
          <button
            onClick={() => createGuardianRef.current?.()}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-ds-md bg-mint-500 px-3 sm:px-ds-sm py-1.5 sm:py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">{t.add_guardian}</span>
            <span className="sm:hidden">{t.add || 'Add'}</span>
          </button>
        }
      />
      <GuardiansClient canManage onCreateClickRef={createGuardianRef} />
    </>
  );
}

export default function PrincipalGuardiansPage() {
  return (
    <PrincipalPageLayout>
      <PrincipalGuardiansPageContent />
    </PrincipalPageLayout>
  );
}


