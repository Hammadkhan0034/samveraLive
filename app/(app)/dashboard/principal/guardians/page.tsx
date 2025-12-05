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
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
        rightActions={
          <button
            onClick={() => createGuardianRef.current?.()}
            className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 px-ds-sm py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Plus className="h-4 w-4" /> {t.add_guardian}
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


