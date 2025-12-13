'use client';

import { useParams, useSearchParams } from 'next/navigation';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';
import { StudentDetails } from '@/app/components/students/StudentDetails';

export default function TeacherStudentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params?.id as string;
  const from = searchParams?.get('from');
  const backHref = from || '/dashboard/teacher/students';

  return (
    <TeacherPageLayout>
      <StudentDetails 
        studentId={studentId} 
        backHref={backHref}
      />
    </TeacherPageLayout>
  );
}
