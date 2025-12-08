'use client';

import { useParams } from 'next/navigation';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';
import { StudentDetails } from '@/app/components/students/StudentDetails';

export default function TeacherStudentDetailPage() {
  const params = useParams();
  const studentId = params?.id as string;

  return (
    <TeacherPageLayout>
      <StudentDetails 
        studentId={studentId} 
        backHref="/dashboard/teacher/students"
      />
    </TeacherPageLayout>
  );
}
