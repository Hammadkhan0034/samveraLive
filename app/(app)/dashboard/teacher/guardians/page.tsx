'use client';

import React from 'react';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';
import { GuardiansClient } from '@/app/components/shared/GuardiansClient';

export default function TeacherGuardiansPage() {
  return (
    <TeacherPageLayout>
      <GuardiansClient canManage={false} />
    </TeacherPageLayout>
  );
}
