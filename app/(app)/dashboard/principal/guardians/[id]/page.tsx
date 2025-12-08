'use client';

import { useParams } from 'next/navigation';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import { GuardianDetails } from '@/app/components/guardians/GuardianDetails';

export default function PrincipalGuardianDetailPage() {
  const params = useParams();
  const guardianId = params?.id as string;

  return (
    <PrincipalPageLayout>
      <GuardianDetails 
        guardianId={guardianId} 
        backHref="/dashboard/principal/guardians"
      />
    </PrincipalPageLayout>
  );
}
