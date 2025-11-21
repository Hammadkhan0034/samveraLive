'use client';

import { AddEventPage } from '@/app/components/shared/calendar/AddEventPage';

export default function TeacherAddEventPage() {
  return <AddEventPage userRole="teacher" calendarRoute="/dashboard/teacher/calendar" />;
}

