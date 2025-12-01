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
        rounded-ds-lg border border-slate-200 bg-white p-ds-sm shadow-ds-card dark:border-slate-700 dark:bg-slate-800
        ${onClick ? 'cursor-pointer hover:shadow-ds-md hover:border-mint-300 dark:hover:border-slate-600 transition-all duration-200' : ''}
        ${className}
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-ds-small text-slate-600 dark:text-slate-400">Calendar</div>
        <span className="rounded-ds-md border border-slate-200 p-2 dark:border-slate-600">
          <CalendarDays className="h-4 w-4 text-mint-600 dark:text-mint-400" />
        </span>
      </div>

      <div className="mt-3">
        <div className="text-ds-h2 font-semibold text-slate-900 dark:text-slate-100 mb-2">
          {currentMonthEvents.length}
        </div>
        <div className="text-ds-tiny text-slate-600 dark:text-slate-400">
          {currentMonthEvents.length === 1 ? 'event' : 'events'} this month
        </div>
      </div>
    </div>
  );
}

