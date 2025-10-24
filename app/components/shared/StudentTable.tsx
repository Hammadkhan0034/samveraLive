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
    classes?: { name: string };
    guardians?: Array<{ 
      id: string; 
      relation: string; 
      users?: { id: string; full_name: string; email: string } 
    }>;
  }>;
  loading: boolean;
  error: string | null;
  onEdit: (student: any) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  translations: {
    students: string;
    student_name: string;
    student_class: string;
    student_guardians: string;
    student_dob: string;
    student_gender: string;
    actions: string;
    create: string;
    loading: string;
    no_students: string;
  };
}

export function StudentTable({
  students,
  loading,
  error,
  onEdit,
  onDelete,
  onCreate,
  translations: t
}: StudentTableProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.students}</h3>
        <div className="flex gap-2">
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-0.5 rounded-lg bg-black text-white px-3 py-2 text-sm dark:bg-black dark:text-white"
          >
            <Plus className="h-3.5 w-3.5 mt-0.5" />
            {t.create}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}
      
      <div className="overflow-y-auto max-h-64 rounded-md border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
            <tr className="text-left text-slate-600 dark:text-slate-300">
              <th className="py-2 pr-3">{t.student_name}</th>
              <th className="py-2 pr-3">{t.student_class}</th>
              <th className="py-2 pr-3">{t.student_guardians}</th>
              <th className="py-2 pr-3">{t.student_dob}</th>
              <th className="py-2 pr-3">{t.student_gender}</th>
              <th className="py-2 pr-3">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {loading ? (
              <tr><td colSpan={6} className="py-4">{t.loading}</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={6} className="py-4">{t.no_students}</td></tr>
            ) : (
              students.map((s) => (
                <tr key={s.id} className="h-12 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 dark:text-slate-100">
                  <td className="py-2 pr-3">{s.first_name} {s.last_name}</td>
                  <td className="py-2 pr-3">{s.classes?.name || '—'}</td>
                  <td className="py-2 pr-3">
                    {s.guardians && s.guardians.length > 0 ? (
                      <div className="space-y-1">
                        {s.guardians.map((guardian: any, index: number) => (
                          <div key={index} className="text-xs text-slate-600 dark:text-slate-400">
                            {guardian.users?.full_name || 'Unknown'} ({guardian.relation})
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{s.dob ? new Date(s.dob).toLocaleDateString() : '—'}</td>
                  <td className="py-2 pr-3">{s.gender}</td>
                  <td className="py-2 pr-3 space-x-2">
                    <button
                      onClick={() => onEdit(s)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 dark:border-slate-700 dark:hover:bg-slate-700"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => onDelete(s.id)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-red-50 text-red-600 border-red-300 dark:border-red-700 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3 w-3" />
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
