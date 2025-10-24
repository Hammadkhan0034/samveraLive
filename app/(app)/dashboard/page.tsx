// app/(app)/dashboard/page.tsx
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
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold mb-2">Loading dashboard…</h1>
      <p className="text-sm text-gray-600">Redirecting to your profile.</p>
    </main>
  );
}
