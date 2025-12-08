'use client';

import { useParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import Loading from '@/app/components/shared/Loading';
import { GuardianDetails } from '@/app/components/guardians/GuardianDetails';

function AdminGuardianDetailPageContent() {
  const params = useParams();
  const guardianId = params?.id as string;

  return (
    <GuardianDetails 
      guardianId={guardianId} 
      backHref="/dashboard/admin"
    />
  );
}

export default function AdminGuardianDetailPage() {
  const { user, loading, isSigningIn } = useRequireAuth('admin');
  const { t } = useLanguage();

  // Show loading ONLY if we have no user yet (avoid flicker after sign-in)
  if (loading && !user) {
    return <Loading fullScreen text={t.loading_guardians || 'Loading guardian...'} />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-mint-100 dark:bg-slate-950">
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-ds-lg">
        <div className="pt-4 sm:pt-6">
          <AdminGuardianDetailPageContent />
        </div>
      </main>
    </div>
  );
}
