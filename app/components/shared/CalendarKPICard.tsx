'use client';

import React, { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import type { CalendarEvent } from './Calendar';

export interface CalendarKPICardProps {
  events: CalendarEvent[];
  onClick?: () => void;
  className?: string;
}

export function CalendarKPICard({ events, onClick, className = '' }: CalendarKPICardProps) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Get events for current month
  const currentMonthEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.start_at);
      return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
    });
  }, [events, currentMonth, currentYear]);

  return (
    <div
      onClick={onClick}
      className={`
        rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200' : ''}
        ${className}
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-600 dark:text-slate-400">Calendar</div>
        <span className="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
          <CalendarDays className="h-4 w-4 text-slate-700 dark:text-slate-300" />
        </span>
      </div>
      
      <div className="mt-3">
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          {currentMonthEvents.length}
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400">
          {currentMonthEvents.length === 1 ? 'event' : 'events'} this month
        </div>
      </div>
    </div>
  );
}

