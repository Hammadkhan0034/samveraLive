'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  class_id: string | null;
  org_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  classes?: { name: string } | null;
}

export interface CalendarProps {
  orgId: string;
  classId?: string | null;
  userRole: 'principal' | 'teacher' | 'guardian';
  canEdit: boolean;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onCreateClick?: () => void;
  classes?: Array<{ id: string; name: string }>;
}

export function Calendar({
  orgId,
  classId,
  userRole,
  canEdit,
  events,
  onEventClick,
  onDateClick,
  onCreateClick,
  classes = [],
}: CalendarProps) {
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get first day of month and number of days
  const firstDayOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }, [currentDate]);

  const lastDayOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  }, [currentDate]);

  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get events for a specific date (compare using local date components to avoid timezone issues)
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();
    
    return events.filter(event => {
      const eventStart = new Date(event.start_at);
      // Compare using local date components to ensure events show on the correct date
      return (
        eventStart.getFullYear() === targetYear &&
        eventStart.getMonth() === targetMonth &&
        eventStart.getDate() === targetDay
      );
    });
  };

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      const date = new Date(firstDayOfMonth);
      date.setDate(date.getDate() - (startingDayOfWeek - i));
      days.push({ date, isCurrentMonth: false });
    }

    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      days.push({ date, isCurrentMonth: true });
    }

    // Fill remaining cells to complete the grid (6 rows x 7 days = 42 cells)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i);
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  }, [currentDate, firstDayOfMonth, daysInMonth, startingDayOfWeek]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="w-full rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
      {/* Calendar Header */}
      <div className="mb-ds-lg flex items-center justify-between">
        <div className="flex items-center gap-ds-md">
          <button
            onClick={goToPreviousMonth}
            className="rounded-ds-md p-2 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-ds-h2 font-semibold text-slate-900 dark:text-slate-100">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={goToNextMonth}
            className="rounded-ds-md p-2 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="rounded-ds-md border border-slate-300 px-3 py-1.5 text-ds-small text-slate-700 hover:bg-mint-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Today
          </button>
          {canEdit && onCreateClick && (
            <button
              onClick={onCreateClick}
              className="flex items-center gap-2 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t.new_event || 'New Event'}
            </button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="w-full">
        {/* Day names header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map(day => (
            <div
              key={day}
              className="p-2 text-center text-ds-small font-medium text-slate-600 dark:text-slate-400"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(({ date, isCurrentMonth }, index) => {
            const dayEvents = isCurrentMonth ? getEventsForDate(date) : [];
            const isTodayDate = isToday(date);

            return (
              <div
                key={index}
                onClick={() => {
                  if (isCurrentMonth && onDateClick) {
                    onDateClick(date);
                  }
                }}
                className={`
                  min-h-[80px] p-2 rounded-ds-md border transition-colors
                  ${isCurrentMonth
                    ? 'border-slate-200 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50 cursor-pointer'
                    : 'border-transparent opacity-40'
                  }
                  ${isTodayDate ? 'bg-mint-50 dark:bg-mint-900/20 border-mint-300 dark:border-mint-700' : ''}
                `}
              >
                <div className={`
                  text-ds-small font-medium mb-1
                  ${isCurrentMonth
                    ? isTodayDate
                      ? 'text-mint-600 dark:text-mint-400'
                      : 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-400 dark:text-slate-600'
                  }
                `}>
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEventClick) {
                          onEventClick(event);
                        }
                      }}
                      className="text-ds-tiny px-1.5 py-0.5 rounded-ds-sm bg-mint-100 dark:bg-mint-900/40 text-mint-700 dark:text-mint-300 truncate cursor-pointer hover:bg-mint-200 dark:hover:bg-mint-900/60"
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-ds-tiny text-slate-500 dark:text-slate-400 px-1.5">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

