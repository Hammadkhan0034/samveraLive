// /components/ProfileSwitcher.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAuth, switchRole, type SamveraRole } from '@/lib/auth';

const roleToPath: Record<SamveraRole, string> = {
  teacher: '/dashboard/teacher',
  principal: '/dashboard/principal',
  guardian: '/dashboard/guardian',
  admin: '/dashboard/admin',
  parent: '/dashboard/guardian',
};

type Props = {
  className?: string;
  labelIs?: string; // optional Icelandic label override
  labelEn?: string; // optional English label override
};

export default function ProfileSwitcher({ className = '', labelIs, labelEn }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Load roles + active from cookies using lazy initialization to avoid setState in effect
  const [roles, setRoles] = useState<SamveraRole[]>(() => {
    const auth = getAuth();
    return auth.roles || [];
  });
  const [active, setActive] = useState<SamveraRole | ''>(() => {
    const auth = getAuth();
    const rs = auth.roles || [];
    const a =
      (auth.active as SamveraRole | null) && rs.includes(auth.active as SamveraRole)
        ? (auth.active as SamveraRole)
        : (rs[0] as SamveraRole | undefined) || '';
    return a || '';
  });

  const label = useMemo(() => {
    // very light i18n: use document lang or fall back to en
    const lang =
      typeof document !== 'undefined'
        ? document.documentElement.lang?.toLowerCase()
        : 'en';
    if (lang?.startsWith('is')) return labelIs || 'Skipta um notanda';
    return labelEn || 'Switch profile';
  }, [labelIs, labelEn]);

  // Hide if no choice to switch
  if (!roles || roles.length <= 1) return null;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as SamveraRole;
    if (!next || next === active) return; // no-op
    setActive(next);
    switchRole(next); // updates cookie
    const target = roleToPath[next];
    if (pathname !== target) router.replace(target);
  }

  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <span className="text-slate-600">{label}</span>
      <select
        value={active}
        onChange={onChange}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1"
        aria-label={label}
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {r === 'teacher' ? 'Teacher' : r === 'principal' ? 'Principal' : r === 'admin' ? 'Admin' : 'Parent'}
          </option>
        ))}
      </select>
    </label>
  );
}
