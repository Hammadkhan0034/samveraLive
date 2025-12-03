'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, type CalendarEvent } from '@/app/components/shared/Calendar';
import { EventDetailsModal } from '@/app/components/shared/EventDetailsModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { deleteEvent, getEvents } from '@/lib/server-actions';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';

interface PrincipalCalendarClientProps {
  initialEvents: CalendarEvent[];
  initialClasses: Array<{ id: string; name: string }>;
}

export function PrincipalCalendarClient({
  initialEvents,
  initialClasses,
}: PrincipalCalendarClientProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { sidebarRef } = usePrincipalPageLayout();
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(initialEvents);
  const [classes] = useState<Array<{ id: string; name: string }>>(initialClasses);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshEvents = () => {
    startTransition(async () => {
      try {
        const events = await getEvents();
        setCalendarEvents(events as CalendarEvent[]);
      } catch (error: any) {
        console.error('❌ Error refreshing calendar events:', error.message);
      }
    });
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    
    try {
      await deleteEvent(eventToDelete);
      setShowDeleteConfirm(false);
      setEventToDelete(null);
      setSelectedEvent(null);
      setShowEventDetails(false);
      refreshEvents();
    } catch (error: any) {
      console.error('Failed to delete event:', error);
    }
  };

  return (
    <>
      <PageHeader
        title={t.tile_calendar || 'Calendar'}
        subtitle={t.calendar_subtitle}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />

      {/* Calendar Container */}
      <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
        <Calendar
          userRole="principal"
          canEdit={true}
          events={calendarEvents}
          classes={classes}
          onEventClick={(event) => {
            setSelectedEvent(event);
            setShowEventDetails(true);
          }}
          onDateClick={() => {
            router.push('/dashboard/principal/calendar/add-event');
          }}
          onCreateClick={() => {
            router.push('/dashboard/principal/calendar/add-event');
          }}
        />
      </div>

      {/* Event Modals */}
      <EventDetailsModal
        isOpen={showEventDetails}
        onClose={() => {
          setShowEventDetails(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        canEdit={true}
        canDelete={true}
        onEdit={() => {
          setShowEventDetails(false);
          if (selectedEvent) {
            router.push(`/dashboard/principal/calendar/edit-event/${selectedEvent.id}`);
          }
        }}
        onDelete={() => {
          setShowEventDetails(false);
          setEventToDelete(selectedEvent?.id || null);
          setShowDeleteConfirm(true);
        }}
        classes={classes}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setEventToDelete(null);
        }}
        onConfirm={handleDeleteEvent}
        title={t.delete_event_confirm}
        message={t.delete_event_message}
        loading={isPending}
      />
    </>
  );
}

