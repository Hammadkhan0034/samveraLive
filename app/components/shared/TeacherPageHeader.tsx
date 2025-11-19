'use client';

import React from 'react';
import { Menu, Users, CalendarDays } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useTeacherPageLayout } from './TeacherPageLayout';

interface TeacherPageHeaderStats {
  label: string;
  value: number;
  total?: number;
  showToday?: boolean;
  todayHint?: string;
}

interface TeacherPageHeaderProps {
  title: string;
  stats?: TeacherPageHeaderStats;
}

export default function TeacherPageHeader({ title, stats }: TeacherPageHeaderProps) {
  const { sidebarRef } = useTeacherPageLayout();
  return (
    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={() => sidebarRef.current?.open()}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        <ProfileSwitcher />
        {stats && (
          <>
            {/* Desktop stats */}
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Users className="h-4 w-4" />
              <span>
                {stats.label}:{' '}
                <span className="font-medium">{stats.value}</span>
                {stats.total !== undefined && ` / ${stats.total}`}
              </span>
              {stats.showToday && stats.todayHint && (
                <>
                  <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
                  <CalendarDays className="h-4 w-4" />
                  <span>{stats.todayHint}</span>
                </>
              )}
            </div>
            {/* Mobile stats */}
            <div className="md:hidden flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Users className="h-4 w-4" />
              <span>
                {stats.label}:{' '}
                <span className="font-medium">{stats.value}</span>
                {stats.total !== undefined && ` / ${stats.total}`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

