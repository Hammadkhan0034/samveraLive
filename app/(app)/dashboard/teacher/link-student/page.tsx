'use client';

import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import LinkStudentGuardian from '@/app/components/LinkStudentGuardian';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';

// Translations removed - using centralized translations from @/lib/translations

export default function TeacherLinkStudentPage() {
  const { t, lang } = useLanguage();

  return (
    <TeacherPageLayout>
      {/* Link Student Panel */}
      <div className="space-y-6">
        <div className="mb-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.tile_link_student_desc}</h3>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <LinkStudentGuardian lang={lang} />
        </div>
      </div>
    </TeacherPageLayout>
  );
}

