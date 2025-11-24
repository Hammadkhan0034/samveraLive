'use client';

import React from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';

interface StudentTableProps {
  students: Array<{
    id: string;
    first_name: string;
    last_name: string | null;
    dob: string | null;
    gender: string;
    phone: string | null;
    address: string | null;
    registration_number: string | null;
    start_date: string | null;
    child_value: string | null;
    language: string | null;
    social_security_number: string | null;
    users?: {
      id: string;
      first_name: string;
      last_name: string | null;
      dob: string | null;
      gender: string | null;
      phone: string | null;
      address: string | null;
      ssn: string | null;
    };
    classes?: { name: string };
    guardians?: Array<{ 
      id: string; 
      relation: string; 
      users?: { id: string; full_name: string; email: string } 
    }>;
  }>;
  error: string | null;
  onEdit: (student: any) => void;
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
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}
      
      <div className="overflow-x-auto overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-black sticky top-0 z-10">
              <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300 rounded-tl-xl">
                {t.student_first_name}
              </th>
              <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                {t.student_last_name}
              </th>
              <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                {t.student_class}
              </th>
              <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                {t.student_dob}
              </th>
              <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                {t.student_gender}
              </th>
              <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                {t.student_guardians}
              </th>
              <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300 rounded-tr-xl">
                {t.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-left py-2 px-4 text-sm text-slate-600 dark:text-slate-400 text-center py-4">
                  {t.no_students}
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="text-left py-2 px-4 text-sm text-slate-900 dark:text-slate-100">
                    {(s as any).users?.first_name ?? s.first_name ?? '—'}
                  </td>
                  <td className="text-left py-2 px-4 text-sm text-slate-900 dark:text-slate-100">
                    {(s as any).users?.last_name ?? s.last_name ?? '—'}
                  </td>
                  <td className="text-left py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {s.classes?.name || '—'}
                  </td>
                  <td className="text-left py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {(s as any).users?.dob 
                      ? (typeof (s as any).users.dob === 'string' ? new Date((s as any).users.dob).toLocaleDateString() : '—')
                      : (s.dob && typeof s.dob === 'string' ? new Date(s.dob).toLocaleDateString() : '—')
                    }
                  </td>
                  <td className="text-left py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {(s as any).users?.gender ?? s.gender ?? '—'}
                  </td>
                  <td className="text-left py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {s.guardians && s.guardians.length > 0
                      ? s.guardians
                          .map((g: any) => {
                            const firstName = g.users?.first_name || '';
                            const lastName = g.users?.last_name || '';
                            const name = `${firstName} ${lastName}`.trim();
                            return name || '—';
                          })
                          .filter((name: string) => name !== '—')
                          .join(', ') || '—'
                      : '—'}
                  </td>
                  <td className="text-left py-2 px-4 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit(s)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>{t.edit}</span>
                      </button>
                      <button
                        onClick={() => onDelete(s.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
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
