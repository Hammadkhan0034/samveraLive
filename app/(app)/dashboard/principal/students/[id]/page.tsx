'use client';

import { useParams, useSearchParams } from 'next/navigation';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import { StudentDetails } from '@/app/components/students/StudentDetails';

export default function PrincipalStudentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params?.id as string;
  const from = searchParams?.get('from');
  const backHref = from || '/dashboard/principal/students';

  return (
    <PrincipalPageLayout>
      <StudentDetails 
        studentId={studentId} 
        backHref={backHref}
      />
    </PrincipalPageLayout>
  );
}
