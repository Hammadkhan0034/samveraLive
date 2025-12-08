'use client';

import { useParams } from 'next/navigation';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import { StudentDetails } from '@/app/components/students/StudentDetails';

export default function PrincipalStudentDetailPage() {
  const params = useParams();
  const studentId = params?.id as string;

  return (
    <PrincipalPageLayout>
      <StudentDetails 
        studentId={studentId} 
        backHref="/dashboard/principal/students"
      />
    </PrincipalPageLayout>
  );
}
