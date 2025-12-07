'use client';

import React, { Suspense } from 'react';
import AdminPageLayout, { useAdminPageLayout } from '@/app/components/shared/AdminPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { AdminDashboard } from '@/app/components/AdminDashboard';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { AdminDashboardSkeleton } from '@/app/components/admin/AdminDashboardSkeleton';

function AdminDashboardContent() {
  const { sidebarRef } = useAdminPageLayout();
  const { t } = useLanguage();

  return (
    <>
      {/* Content Header */}
      <PageHeader
        title={t.adminDashboard || 'Admin Dashboard'}
        subtitle={t.manageUsersSchools || 'Manage users, schools, and system settings'}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />

      <AdminDashboard />
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={
      <AdminPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <AdminDashboardSkeleton />
        </div>
      </AdminPageLayout>
    }>
      <AdminPageLayout>
        <AdminDashboardContent />
      </AdminPageLayout>
    </Suspense>
  );
}
