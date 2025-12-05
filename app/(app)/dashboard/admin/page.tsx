'use client';

import { AdminDashboard } from '@/app/components/AdminDashboard';
import AdminPageLayout, { useAdminPageLayout } from '@/app/components/shared/AdminPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { useLanguage } from '@/lib/contexts/LanguageContext';

function AdminDashboardPageContent() {
  const { t } = useLanguage();
  const { sidebarRef } = useAdminPageLayout();

  return (
    <>
      <PageHeader
        title={t.adminDashboard || 'Admin Dashboard'}
        subtitle={t.manageUsersSchools || 'Manage users and schools'}
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
    <AdminPageLayout>
      <AdminDashboardPageContent />
    </AdminPageLayout>
  );
}
