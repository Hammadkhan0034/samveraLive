'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { AdminDashboard } from '@/app/components/AdminDashboard';
import Loading from '@/app/components/shared/Loading';

export default function AdminDashboardPage() {
  const { user, loading, isSigningIn } = useRequireAuth('admin');

  // Show loading ONLY if we have no user yet (avoid flicker after sign-in)
  if (loading && !user) {
    return <Loading fullScreen text="Loading admin dashboard..." />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <main className="container mx-auto px-4 py-8">
        <AdminDashboard />
      </main>
    </div>
  );
}
