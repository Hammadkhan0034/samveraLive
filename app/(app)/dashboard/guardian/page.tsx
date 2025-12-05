'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import ParentDashboard from '../../../components/ParentDashboard';
import { useRequireAuth, useAuth } from '../../../../lib/hooks/useAuth';
import Loading from '@/app/components/shared/Loading';

export default function ParentDashboardPage() {
  const router = useRouter();
  const { user, loading, isSigningIn } = useRequireAuth('guardian');

  // Only show loading if we're actually loading and don't have a user yet
  if (loading && !user) {
    return <Loading fullScreen text="Loading parent dashboard..." />;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-mint-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <ParentDashboard />
    </div>
  );
}