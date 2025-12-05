'use client';

import  { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, type CalendarEvent } from '@/app/components/shared/Calendar';
import { EventDetailsModal } from '@/app/components/shared/EventDetailsModal';
import { getEvents } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { ArrowLeft } from 'lucide-react';

export default function ParentCalendarPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { session } = useAuth();
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);

  const loadCalendarEvents = useCallback(async () => {
    const orgId = (session?.user?.user_metadata as any)?.org_id;
    if (!orgId || !session?.user?.id) return;
    
    try {
      setLoadingEvents(true);
      // Handler now automatically fetches guardian's students' classes
      const events = await getEvents();
      setCalendarEvents(events as CalendarEvent[]);
    } catch (e: any) {
      console.error('❌ Error loading calendar events:', e.message);
    } finally {
      setLoadingEvents(false);
    }
  }, [session?.user?.user_metadata, session?.user?.id]);

  // Load calendar events
  useEffect(() => {
    const orgId = (session?.user?.user_metadata as any)?.org_id;
    if (orgId && session?.user?.id) {
      loadCalendarEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, loadCalendarEvents]);

  return (
    <div className="min-h-screen bg-mint-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-ds-md mt-14 flex items-center gap-ds-sm">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-ds-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-ds-small text-slate-700 hover:bg-mint-50 transition-colors dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.back || 'Back'}
          </button>
          <h1 className="text-ds-h1 font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.calendar || 'Calendar'}
          </h1>
        </div>

        {/* Calendar Container */}
        {loadingEvents && calendarEvents.length === 0 ? (
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-ds-md">
            {/* Calendar Header Skeleton */}
            <div className="mb-6 flex items-center justify-between">
              <div className="h-8 w-32 animate-pulse bg-mint-100 dark:bg-slate-700 rounded-ds-md"></div>
              <div className="flex gap-2">
                <div className="h-8 w-8 animate-pulse bg-mint-100 dark:bg-slate-700 rounded-ds-md"></div>
                <div className="h-8 w-8 animate-pulse bg-mint-100 dark:bg-slate-700 rounded-ds-md"></div>
              </div>
            </div>

            {/* Calendar Grid Skeleton */}
            <div className="space-y-2">
              {/* Day names skeleton */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-4 w-full animate-pulse bg-mint-100 dark:bg-slate-700 rounded-ds-sm"></div>
                ))}
              </div>

              {/* Calendar days skeleton */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="min-h-[80px] p-2 rounded-ds-md border border-slate-200 dark:border-slate-700">
                    <div className="h-4 w-6 mb-2 animate-pulse bg-mint-100 dark:bg-slate-700 rounded-ds-sm"></div>
                    <div className="space-y-1">
                      <div className="h-3 w-full animate-pulse bg-mint-100 dark:bg-slate-700 rounded-ds-sm"></div>
                      <div className="h-3 w-3/4 animate-pulse bg-mint-100 dark:bg-slate-700 rounded-ds-sm"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card">
            <Calendar
              userRole="guardian"
              canEdit={false}
              events={calendarEvents}
              onEventClick={(event) => {
                setSelectedEvent(event);
                setShowEventDetails(true);
              }}
            />
          </div>
        )}

        {/* Event Details Modal (Read-only for parents) */}
        <EventDetailsModal
          isOpen={showEventDetails}
          onClose={() => {
            setShowEventDetails(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          canEdit={false}
          canDelete={false}
        />
      </div>
    </div>
  );
}

