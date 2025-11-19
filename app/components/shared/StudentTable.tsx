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
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg dark:border-slate-700">
      {/* <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.students}</h3>
      </div> */}
      
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}
      
      <div className="rounded-md dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black text-white  dark:bg-black z-10 ">
            <tr className="text-center  dark:border-slate-700 text-slate-600 dark:text-slate-300">
              {/* <th className="py-2 pr-3 text-white">{t.student_name}</th> */}
              <th className="py-2 pr-3 text-white">{t.student_first_name}</th>
              <th className="py-2 pr-3 text-white">{t.student_last_name}</th>
              <th className="py-2 pr-3 text-white">{t.student_class}</th>
              <th className="py-2 pr-3 text-white">{t.student_dob}</th>
              <th className="py-2 pr-3 text-white">{t.student_gender}</th>
              <th className="py-2 pr-3 text-white">{t.student_guardians}</th>
              <th className="py-2 pr-3 text-white">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {students.length === 0 ? (
              <tr><td colSpan={8} className="py-4 text-center">{t.no_students}</td></tr>
            ) : (
              students.map((s) => (
                <tr key={s.id} className="h-12 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 dark:text-slate-100 text-center">
                  <td className="py-2 pr-3">{(s as any).users?.first_name ?? s.first_name ?? '—'}</td>
                  <td className="py-2 pr-3">{(s as any).users?.last_name ?? s.last_name ?? '—'}</td>
                  <td className="py-2 pr-3">{s.classes?.name || '—'}</td>
                  <td className="py-2 pr-3">
                    {(s as any).users?.dob 
                      ? (typeof (s as any).users.dob === 'string' ? new Date((s as any).users.dob).toLocaleDateString() : '—')
                      : (s.dob && typeof s.dob === 'string' ? new Date(s.dob).toLocaleDateString() : '—')
                    }
                  </td>
                  <td className="py-2 pr-3">{(s as any).users?.gender ?? s.gender ?? '—'}</td>
                  <td className="py-2 pr-3">
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
                  <td className="py-2 pr-3 space-x-1">
                    <button
                      onClick={() => onEdit(s)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 dark:border-slate-700 dark:hover:bg-slate-700"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span className="text-slate-900 dark:text-slate-100">{t.edit}</span>
                    </button>
                    <button
                      onClick={() => onDelete(s.id)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-red-50 text-red-600 border-red-300 dark:border-red-700 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
