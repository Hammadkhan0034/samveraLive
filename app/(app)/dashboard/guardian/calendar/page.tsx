'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Calendar as CalendarComponent, type CalendarEvent } from '@/app/components/shared/Calendar';
import { Calendar } from 'lucide-react';
import { EventDetailsModal } from '@/app/components/shared/EventDetailsModal';
import { PageHeader } from '@/app/components/shared/PageHeader';
import GuardianPageLayout, { useGuardianPageLayout } from '@/app/components/shared/GuardianPageLayout';
import { getEvents } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import EmptyState from '@/app/components/EmptyState';

function GuardianCalendarContent() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const { sidebarRef } = useGuardianPageLayout();
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);

  const loadCalendarEvents = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoadingEvents(true);
      const events = await getEvents();
      setCalendarEvents(events as CalendarEvent[]);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load calendar events';
      console.error('Error loading calendar events:', errorMessage);
    } finally {
      setLoadingEvents(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      loadCalendarEvents();
    }
  }, [session?.user?.id, loadCalendarEvents]);

  return (
    <>
      <PageHeader
        title={t.calendar || 'Calendar'}
        subtitle={t.calendar_subtitle || ''}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />

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
      ) : !loadingEvents && calendarEvents.length === 0 ? (
        <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-12">
          <EmptyState
            lang={lang}
            icon={Calendar}
            title={t.no_events_title || 'No Events'}
            description={t.no_events_description || 'No events scheduled. Check back later for updates.'}
          />
        </div>
      ) : (
        <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card">
          <CalendarComponent
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

      {/* Event Details Modal (Read-only for guardians) */}
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
    </>
  );
}

function GuardianCalendarPageContent() {
  return (
    <GuardianPageLayout>
      <GuardianCalendarContent />
    </GuardianPageLayout>
  );
}

export default function GuardianCalendarPage() {
  return (
    <Suspense fallback={
      <GuardianPageLayout>
        <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-ds-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-8 w-32 animate-pulse bg-mint-100 dark:bg-slate-700 rounded-ds-md"></div>
            <div className="flex gap-2">
              <div className="h-8 w-8 animate-pulse bg-mint-100 dark:bg-slate-700 rounded-ds-md"></div>
              <div className="h-8 w-8 animate-pulse bg-mint-100 dark:bg-slate-700 rounded-ds-md"></div>
            </div>
          </div>
        </div>
      </GuardianPageLayout>
    }>
      <GuardianCalendarPageContent />
    </Suspense>
  );
}
