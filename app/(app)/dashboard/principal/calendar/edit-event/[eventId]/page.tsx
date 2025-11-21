'use client';

import { useParams } from 'next/navigation';
import { EditEventPage } from '@/app/components/shared/calendar/EditEventPage';

export default function PrincipalEditEventPage() {
  const params = useParams();
  const eventId = params?.eventId as string;
  
  return <EditEventPage userRole="principal" calendarRoute="/dashboard/principal/calendar" eventId={eventId} />;
}

