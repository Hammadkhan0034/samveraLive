'use client';

import React from 'react';
import { Edit, Trash2 } from 'lucide-react';

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
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        {/* <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.guardians}</h3> */}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-md overflow-hidden border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-black text-white dark:bg-black z-10">
            <tr className="text-center text-slate-600 dark:text-slate-300">
              <th className="py-2 pr-1 text-white rounded-tl-xl">{t.first_name || 'First Name'}</th>
              <th className="py-2 pr-1 text-white">{t.last_name || 'Last Name'}</th>
              <th className="py-2 pr-1 text-white">{t.email}</th>
              <th className="py-2 pr-1 text-white">{t.phone}</th>
              <th className="py-2 pr-1 text-white">{t.status}</th>
              <th className="py-2 pr-1 text-white rounded-tr-xl">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {guardians.length === 0 ? (
              <tr><td colSpan={6} className="py-4">{t.no_guardians}</td></tr>
            ) : (
              guardians.map((g) => (
                <tr key={g.id} className="h-12 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 dark:text-slate-100 text-center">
                  <td className="py-2 pr-3">{g.first_name}</td>
                  <td className="py-2 pr-3">{g.last_name || '—'}</td>
                  <td className="py-2 pr-3">{g.email || '—'}</td>
                  <td className="py-2 pr-3">{g.phone || '—'}</td>
                  <td className="py-2 pr-3">{g.is_active ? t.active : t.inactive}</td>
                  <td className="py-2 pr-3 space-x-2">
                    <button
                      onClick={() => onEdit(g)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 dark:hover:bg-slate-700"
                    >
                      <Edit className="h-3 w-3" />
                      <span className="text-slate-900 dark:text-slate-100">{t.edit}</span>
                    </button>
                    <button
                      onClick={() => onDelete(g.id)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-red-50 text-red-600 border-red-300 dark:border-red-700 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span className="text-slate-900 dark:text-slate-100">{t.delete}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
