'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import type { TeacherClass } from '@/lib/types/attendance';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';

interface AttendanceFiltersProps {
  classes: TeacherClass[];
  selectedClassId: string;
  onClassChange: (classId: string) => void;
  onMarkAll: (classId?: string) => void;
  translations: typeof enText | typeof isText;
}

export const AttendanceFilters = React.memo<AttendanceFiltersProps>(
  function AttendanceFilters({
    classes,
    selectedClassId,
    onClassChange,
    onMarkAll,
    translations: t,
  }) {
    return (
      <div className="flex items-center gap-3">
        {/* Class Filter Dropdown */}
        {classes.length > 0 ? (
          <select
            value={selectedClassId}
            onChange={(e) => onClassChange(e.target.value)}
            className="rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <option value="all">{t.all_classes || 'All Classes'}</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-ds-small text-slate-500 dark:text-slate-400">
            {t.no_class_assigned || 'No class assigned'}
          </div>
        )}
        <button
          onClick={() => onMarkAll(selectedClassId !== 'all' ? selectedClassId : undefined)}
          disabled={classes.length === 0}
          className="inline-flex items-center gap-2 rounded-ds-md border border-slate-300 bg-white px-4 py-2 text-ds-small hover:bg-mint-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          <Plus className="h-4 w-4" />
          {t.att_mark_all_in}
        </button>
      </div>
    );
  }
);

