'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

import LinkStudentGuardian from '@/app/components/LinkStudentGuardian';
import PrincipalPageLayout, {
  usePrincipalPageLayout,
} from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import Loading from '@/app/components/shared/Loading';

function PrincipalLinkStudentContent() {
  const { t, lang } = useLanguage();
  const { sidebarRef } = usePrincipalPageLayout();

  return (
    <>
      <PageHeader
        title={t.tile_link_student || 'Link Student'}
        subtitle={t.tile_link_student_desc || 'Link a guardian to a student'}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />

      <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
        <LinkStudentGuardian lang={lang} />
      </div>
    </>
  );
}

export default function PrincipalLinkStudentPage() {
  const router = useRouter();

  const { user, loading, isSigningIn } = useRequireAuth(['principal']);

  if (loading && !user && isSigningIn) {
    return <Loading fullScreen text="Loading link student page..." />;
  }

  if (!user) {
    // If auth hook has resolved and there is no user, send to sign-in
    router.replace('/signin');
    return null;
  }

  return (
    <PrincipalPageLayout>
      <PrincipalLinkStudentContent />
    </PrincipalPageLayout>
  );
}


