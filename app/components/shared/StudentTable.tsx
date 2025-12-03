'use client';

import React from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';
import type { StudentWithRelations } from '@/lib/types/students';

interface StudentTableProps {
  students: StudentWithRelations[];
  error: string | null;
  onEdit: (student: StudentWithRelations) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  translations: {
    students: string;
    student_name: string;
    student_first_name: string;
    student_last_name: string;
    student_class: string;
    student_guardians: string;
    student_dob: string;
    student_gender: string;
    actions: string;
    create: string;
    no_students: string;
    edit: string;
    delete: string;
  };
}

export function StudentTable({
  students,
  error,
  onEdit,
  onDelete,
  onCreate,
  translations: t
}: StudentTableProps) {
  return (
    <>
      {error && (
        <div className="mb-ds-md rounded-ds-md bg-red-50 border border-red-200 px-ds-md py-ds-sm text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto overflow-hidden border border-slate-200 dark:border-slate-700 rounded-ds-lg shadow-ds-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-mint-200 dark:bg-slate-700 sticky top-0 z-10">
              <th className="text-left py-2 px-ds-md text-ds-small font-medium text-ds-text-primary dark:text-slate-300 rounded-tl-ds-lg">
                {t.student_first_name}
              </th>
              <th className="text-left py-2 px-ds-md text-ds-small font-medium text-ds-text-primary dark:text-slate-300">
                {t.student_last_name}
              </th>
              <th className="text-left py-2 px-ds-md text-ds-small font-medium text-ds-text-primary dark:text-slate-300">
                {t.student_class}
              </th>
              <th className="text-left py-2 px-ds-md text-ds-small font-medium text-ds-text-primary dark:text-slate-300">
                {t.student_dob}
              </th>
              <th className="text-left py-2 px-ds-md text-ds-small font-medium text-ds-text-primary dark:text-slate-300">
                {t.student_gender}
              </th>
              <th className="text-left py-2 px-ds-md text-ds-small font-medium text-ds-text-primary dark:text-slate-300">
                {t.student_guardians}
              </th>
              <th className="text-left py-2 px-ds-md text-ds-small font-medium text-ds-text-primary dark:text-slate-300 rounded-tr-ds-lg">
                {t.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-ds-md px-ds-md text-ds-small text-ds-text-muted dark:text-slate-400">
                  {t.no_students}
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50">
                  <td className="text-left py-2 px-ds-md text-ds-small text-ds-text-primary dark:text-slate-100">
                    {s.users?.first_name ?? s.first_name ?? '—'}
                  </td>
                  <td className="text-left py-2 px-ds-md text-ds-small text-ds-text-primary dark:text-slate-100">
                    {s.users?.last_name ?? s.last_name ?? '—'}
                  </td>
                  <td className="text-left py-2 px-ds-md text-ds-small text-ds-text-secondary dark:text-slate-400">
                    {s.classes?.name || '—'}
                  </td>
                  <td className="text-left py-2 px-ds-md text-ds-small text-ds-text-secondary dark:text-slate-400">
                    {s.users?.dob
                      ? (typeof s.users.dob === 'string' ? new Date(s.users.dob).toLocaleDateString() : '—')
                      : (s.dob && typeof s.dob === 'string' ? new Date(s.dob).toLocaleDateString() : '—')
                    }
                  </td>
                  <td className="text-left py-2 px-ds-md text-ds-small text-ds-text-secondary dark:text-slate-400">
                    {s.users?.gender ?? s.gender ?? '—'}
                  </td>
                  <td className="text-left py-2 px-ds-md text-ds-small text-ds-text-secondary dark:text-slate-400">
                    {s.guardians && s.guardians.length > 0
                      ? s.guardians
                          .map((g) => {
                            const firstName = g.users?.first_name || '';
                            const lastName = g.users?.last_name || '';
                            const name = `${firstName} ${lastName}`.trim();
                            return name || '—';
                          })
                          .filter((name) => name !== '—')
                          .join(', ') || '—'
                      : '—'}
                  </td>
                  <td className="text-left py-2 px-ds-md text-ds-small">
                    <div className="flex items-center gap-ds-xs">
                      <button
                        onClick={() => onEdit(s)}
                        className="inline-flex items-center gap-ds-xs rounded-ds-sm border border-input-stroke bg-input-fill px-2 py-1 text-ds-small text-ds-text-primary hover:bg-mint-50 hover:border-mint-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>{t.edit}</span>
                      </button>
                      <button
                        onClick={() => onDelete(s.id)}
                        className="inline-flex items-center gap-ds-xs rounded-ds-sm border border-red-300 px-2 py-1 text-ds-small text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{t.delete}</span>
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
