'use client';

import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import AttendancePanel from '@/app/components/attendance/AttendancePanel';

function TeacherAttendanceContent() {
  const { t, lang } = useLanguage();
  const { sidebarRef } = useTeacherPageLayout();

  return (
    <>
      <PageHeader
        title={t.att_title}
        subtitle={t.attendance_subtitle}
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />

      {/* Attendance Panel */}
      <section>
        <AttendancePanel />
      </section>
    </>
  );
}

export default function TeacherAttendancePage() {
  return (
    <TeacherPageLayout>
      <TeacherAttendanceContent />
    </TeacherPageLayout>
  );
}
