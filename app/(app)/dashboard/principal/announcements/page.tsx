'use client';

import AnnouncementsPage from '@/app/components/shared/AnnouncementsPage';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';

function PrincipalAnnouncementsPageContent() {
  return (
    <AnnouncementsPage
      viewMode="table"
      showAddButton={true}
      showBackButton={false}
      includeUserParams={true}
      withinLayout={true}
    />
  );
}

export default function PrincipalAnnouncementsPage() {
  return (
    <PrincipalPageLayout>
      <PrincipalAnnouncementsPageContent />
    </PrincipalPageLayout>
  );
}
