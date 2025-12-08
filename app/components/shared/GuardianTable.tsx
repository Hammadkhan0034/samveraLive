'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Trash2, UserCheck } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import EmptyState from '@/app/components/EmptyState';

interface GuardianTableProps {
  guardians: Array<{
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    is_active: boolean;
  }>;
  error: string | null;
  onEdit: (guardian: any) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  translations: {
    guardians: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    status: string;
    active: string;
    inactive: string;
    actions: string;
    create: string;
    no_guardians: string;
    no_guardians_loading: string;
    edit: string;
    delete: string;
    send_magic_link?: string;
    sending?: string;
    magic_link_sent?: string;
    magic_link_send_failed?: string;
    no_students_linked?: string;
  };
}

export function GuardianTable({
  guardians,
  error,
  onEdit,
  onDelete,
  onCreate,
  translations: t
}: GuardianTableProps) {
  const { lang, t: translations } = useLanguage();
  const router = useRouter();
  
  const handleGuardianClick = (guardianId: string) => {
    // Check if we're in an admin context by checking the current pathname
    const isAdminContext = typeof window !== 'undefined' && window.location.pathname.includes('/dashboard/admin');
    if (isAdminContext) {
      router.push(`/dashboard/admin/guardians/${guardianId}`);
    } else {
      router.push(`/dashboard/principal/guardians/${guardianId}`);
    }
  };
  
  return (
    <>
      {error && (
        <div className="mb-3 sm:mb-4 rounded-ds-md bg-red-50 border border-red-200 px-3 sm:px-4 py-2 sm:py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto border border-input-stroke dark:border-slate-700 rounded-ds-md">
        <table className="w-full min-w-[640px] text-ds-small border-collapse">
          <thead className="sticky top-0 bg-mint-200 text-ds-text-primary dark:bg-mint-700 dark:text-white z-10">
            <tr className="text-center">
              <th className="py-2 px-2 sm:px-3 text-ds-text-primary dark:text-white rounded-tl-ds-md font-semibold whitespace-nowrap">{t.first_name || 'First Name'}</th>
              <th className="py-2 px-2 sm:px-3 text-ds-text-primary dark:text-white font-semibold whitespace-nowrap">{t.last_name || 'Last Name'}</th>
              <th className="py-2 px-2 sm:px-3 text-ds-text-primary dark:text-white font-semibold whitespace-nowrap hidden md:table-cell">{t.email}</th>
              <th className="py-2 px-2 sm:px-3 text-ds-text-primary dark:text-white font-semibold whitespace-nowrap hidden lg:table-cell">{t.phone}</th>
              <th className="py-2 px-2 sm:px-3 text-ds-text-primary dark:text-white font-semibold whitespace-nowrap hidden lg:table-cell">{t.status}</th>
              <th className="py-2 px-2 sm:px-3 text-ds-text-primary dark:text-white rounded-tr-ds-md font-semibold whitespace-nowrap">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {guardians.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 px-2 sm:px-3">
                  <EmptyState
                    icon={UserCheck}
                    title={translations.no_guardians_title || 'No Guardians'}
                    description={translations.no_guardians_description || 'No guardians found. Click \'Add Guardian\' to create one.'}
                  />
                </td>
              </tr>
            ) : (
              guardians.map((g) => (
                <tr key={g.id} className="h-12 hover:bg-input-fill dark:hover:bg-slate-700/30 dark:text-slate-100 text-center">
                  <td className="py-2 px-2 sm:px-3 whitespace-nowrap">
                    <button
                      onClick={() => handleGuardianClick(g.id)}
                      className="text-mint-600 dark:text-mint-400 hover:text-mint-700 dark:hover:text-mint-300 hover:underline transition-colors"
                    >
                      {g.first_name}
                    </button>
                  </td>
                  <td className="py-2 px-2 sm:px-3 whitespace-nowrap">
                    <button
                      onClick={() => handleGuardianClick(g.id)}
                      className="text-mint-600 dark:text-mint-400 hover:text-mint-700 dark:hover:text-mint-300 hover:underline transition-colors"
                    >
                      {g.last_name || '—'}
                    </button>
                  </td>
                  <td className="py-2 px-2 sm:px-3 hidden md:table-cell whitespace-nowrap">{g.email || '—'}</td>
                  <td className="py-2 px-2 sm:px-3 hidden lg:table-cell whitespace-nowrap">{g.phone || '—'}</td>
                  <td className="py-2 px-2 sm:px-3 hidden lg:table-cell whitespace-nowrap">{g.is_active ? t.active : t.inactive}</td>
                  <td className="py-2 px-2 sm:px-3">
                    <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                      <button
                        onClick={() => onEdit(g)}
                        className="inline-flex items-center gap-1 rounded-ds-sm border border-input-stroke dark:border-slate-700 px-1.5 sm:px-2 py-1 hover:bg-input-fill dark:hover:bg-slate-700 transition-colors text-ds-small"
                      >
                        <Edit className="h-3 w-3 flex-shrink-0" />
                        <span className="hidden sm:inline text-ds-text-primary dark:text-slate-100">{t.edit}</span>
                      </button>
                      <button
                        onClick={() => onDelete(g.id)}
                        className="inline-flex items-center gap-1 rounded-ds-sm border px-1.5 sm:px-2 py-1 hover:bg-red-50 text-red-600 border-red-300 dark:border-red-700 dark:hover:bg-red-900/20 transition-colors text-ds-small"
                      >
                        <Trash2 className="h-3 w-3 flex-shrink-0" />
                        <span className="hidden sm:inline text-ds-text-primary dark:text-slate-100">{t.delete}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
