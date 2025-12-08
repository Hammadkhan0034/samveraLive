'use client';

import { useParams } from 'next/navigation';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import { TeacherDetails } from '@/app/components/teachers/TeacherDetails';

export default function PrincipalTeacherDetailPage() {
  const params = useParams();
  const teacherId = params?.id as string;

  return (
    <PrincipalPageLayout>
      <TeacherDetails 
        teacherId={teacherId} 
        backHref="/dashboard/principal/staff"
      />
    </PrincipalPageLayout>
  );
}
