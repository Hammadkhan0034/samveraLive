'use client';

import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';

// Translations removed - using centralized translations from @/lib/translations

export default function TeacherLinkStudentPage() {
  const { t, lang } = useLanguage();

  return (
    <TeacherPageLayout>
      <div className="space-y-4">
        <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
          {t.tile_link_student || 'Link Student'}
        </h3>
        <p className="text-ds-body text-slate-700 dark:text-slate-300">
          {t.only_principal_can_link_students || 'Only principals can link guardians to students. Please contact your principal if you need a change made.'}
        </p>
      </div>
    </TeacherPageLayout>
  );
}

