'use client';

import { AddEventPage } from '@/app/components/shared/calendar/AddEventPage';

export default function PrincipalAddEventPage() {
  return <AddEventPage userRole="principal" calendarRoute="/dashboard/principal/calendar" />;
}

