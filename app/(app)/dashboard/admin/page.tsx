'use client';

import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { AdminDashboard } from '@/app/components/AdminDashboard';
import Loading from '@/app/components/shared/Loading';

export default function AdminDashboardPage() {
  const { user, loading, isSigningIn } = useRequireAuth('admin');
  const { t } = useLanguage();

  // Show loading ONLY if we have no user yet (avoid flicker after sign-in)
  if (loading && !user) {
    return <Loading fullScreen text={t.loading_admin_dashboard || 'Loading admin dashboard...'} />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-mint-100 dark:bg-slate-950">
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-ds-lg">
        <AdminDashboard />
      </main>
    </div>
  );
}
