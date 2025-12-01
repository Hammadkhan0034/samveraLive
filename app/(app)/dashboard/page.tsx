'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, routeForRole } from '../../../lib/auth';

export default function DashboardRouter() {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const roles = auth.roles || ['parent'];
    const active = auth.active || roles[0];
    router.replace(routeForRole(active));
  }, [router]);

  return (
    <main className="mx-auto max-w-md p-ds-md">
      <h1 className="text-ds-h2 font-semibold mb-2">Loading dashboard…</h1>
      <p className="text-ds-small text-slate-600 dark:text-slate-400">Redirecting to your profile.</p>
    </main>
  );
}
