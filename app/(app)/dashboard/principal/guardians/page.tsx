import React, { Suspense } from 'react';

import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import { GuardiansClient } from '@/app/components/shared/GuardiansClient';
import { ServerRoleGuard } from '@/app/components/ServerRoleGuard';

function PrincipalGuardiansPageContent() {
  return (
    <PrincipalPageLayout>
      <GuardiansClient canManage />
    </PrincipalPageLayout>
  );
}

export default async function PrincipalGuardiansPage() {
  return (
    <ServerRoleGuard
      requiredRole="principal"
      fallback={
        <PrincipalPageLayout>
          <div className="flex min-h-[300px] items-center justify-center text-ds-body text-slate-500 dark:text-slate-300">
            You do not have permission to view this page.
          </div>
        </PrincipalPageLayout>
      }
    >
      <Suspense
        fallback={
          <PrincipalPageLayout>
            <div className="flex min-h-[300px] items-center justify-center text-ds-body text-slate-500 dark:text-slate-300">
              Loading guardians...
            </div>
          </PrincipalPageLayout>
        }
      >
        <PrincipalGuardiansPageContent />
      </Suspense>
    </ServerRoleGuard>
  );
}


