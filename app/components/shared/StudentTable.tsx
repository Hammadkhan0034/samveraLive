'use client';

import React from 'react';
import { Edit, Plus, Trash2, Users } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import EmptyState from '@/app/components/EmptyState';
import type { StudentWithRelations } from '@/lib/types/students';

interface StudentTableProps {
  students: StudentWithRelations[];
  error: string | null;
  onEdit: (student: StudentWithRelations) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onRowClick?: (student: StudentWithRelations) => void;
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
  onRowClick,
  translations: t
}: StudentTableProps) {
  const { lang, t: translations } = useLanguage();
  
  return (
    <>
      {error && (
        <div className="mb-ds-md rounded-ds-md bg-red-50 border border-red-200 px-ds-md py-ds-sm text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-ds-lg shadow-ds-card">
        <table className="w-full min-w-[640px] border-collapse text-ds-small">
          <thead className="sticky top-0 bg-mint-500 text-white z-10">
            <tr className="text-white dark:bg-slate-700 sticky top-0 z-10">
              <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-lg whitespace-nowrap">
                {t.student_first_name}
              </th>
              <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 whitespace-nowrap">
                {t.student_last_name}
              </th>
              <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 whitespace-nowrap hidden md:table-cell">
                {t.student_class}
              </th>
              <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 whitespace-nowrap hidden lg:table-cell">
                {t.student_dob}
              </th>
              <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 whitespace-nowrap hidden lg:table-cell">
                {t.student_gender}
              </th>
              <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 whitespace-nowrap hidden xl:table-cell">
                {t.student_guardians}
              </th>
              <th className="text-left py-2 px-2 sm:px-ds-md text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-lg whitespace-nowrap">
                {t.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-ds-md px-ds-md">
                  <EmptyState
                    icon={Users}
                    title={translations.no_students_title || 'No Students Found'}
                    description={translations.no_students_description || 'No students found. Click \'Add Student\' to create one.'}
                  />
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr 
                  key={s.id} 
                  onClick={() => onRowClick?.(s)}
                  className={`border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  <td className="text-left py-2 px-2 sm:px-ds-md text-ds-small text-ds-text-primary dark:text-slate-100">
                    {s.users?.first_name ?? s.first_name ?? '—'}
                  </td>
                  <td className="text-left py-2 px-2 sm:px-ds-md text-ds-small text-ds-text-primary dark:text-slate-100">
                    {s.users?.last_name ?? s.last_name ?? '—'}
                  </td>
                  <td className="text-left py-2 px-2 sm:px-ds-md text-ds-small text-ds-text-secondary dark:text-slate-400 hidden md:table-cell">
                    {s.classes?.name || '—'}
                  </td>
                  <td className="text-left py-2 px-2 sm:px-ds-md text-ds-small text-ds-text-secondary dark:text-slate-400 hidden lg:table-cell">
                    {s.users?.dob
                      ? (typeof s.users.dob === 'string' ? new Date(s.users.dob).toLocaleDateString() : '—')
                      : (s.dob && typeof s.dob === 'string' ? new Date(s.dob).toLocaleDateString() : '—')
                    }
                  </td>
                  <td className="text-left py-2 px-2 sm:px-ds-md text-ds-small text-ds-text-secondary dark:text-slate-400 hidden lg:table-cell">
                    {s.users?.gender ?? s.gender ?? '—'}
                  </td>
                  <td className="text-left py-2 px-2 sm:px-ds-md text-ds-small text-ds-text-secondary dark:text-slate-400 hidden xl:table-cell">
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
                  <td className="text-left py-2 px-2 sm:px-ds-md text-ds-small" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-ds-xs flex-wrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(s);
                        }}
                        className="inline-flex items-center gap-1 rounded-ds-sm border border-input-stroke bg-input-fill px-2 py-1 text-ds-small text-ds-text-primary hover:bg-mint-50 hover:border-mint-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t.edit}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(s.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-ds-sm border border-red-300 px-2 py-1 text-ds-small text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t.delete}</span>
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
