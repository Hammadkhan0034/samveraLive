'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import Loading from '@/app/components/shared/Loading';
import { useRequireAuth } from '@/lib/hooks/useAuth';

export default function LinkStudentPage() {
  const { user, loading, isSigningIn } = useRequireAuth(['principal']);
  const router = useRouter();

  useEffect(() => {
    // While auth is resolving, show a loading state
    if (loading && !user && isSigningIn) {
      return;
    }

    // If no user after auth resolution, send to sign-in
    if (!user) {
      router.replace('/signin');
      return;
    }

    // Principal-only: redirect to the new principal route
    router.replace('/dashboard/principal/link-student');
  }, [loading, user, isSigningIn, router]);

  return <Loading fullScreen text="Redirecting to principal link student page..." />;
}
