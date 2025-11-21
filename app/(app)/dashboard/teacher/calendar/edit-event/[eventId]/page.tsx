'use client';

import { useParams } from 'next/navigation';
import { EditEventPage } from '@/app/components/shared/calendar/EditEventPage';

export default function TeacherEditEventPage() {
  const params = useParams();
  const eventId = params?.eventId as string;
  
  return <EditEventPage userRole="teacher" calendarRoute="/dashboard/teacher/calendar" eventId={eventId} />;
}

