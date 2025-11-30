'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Calendar, type CalendarEvent } from '@/app/components/shared/Calendar';
import { EventDetailsModal } from '@/app/components/shared/EventDetailsModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { deleteEvent, getEvents } from '@/lib/server-actions';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';

interface PrincipalCalendarClientProps {
  initialEvents: CalendarEvent[];
  initialClasses: Array<{ id: string; name: string }>;
  orgId: string;
}

export function PrincipalCalendarClient({
  initialEvents,
  initialClasses,
  orgId,
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
      {/* Content Header */}
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
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.tile_calendar || 'Calendar'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <ProfileSwitcher />
        </div>
      </div>

      {/* Calendar Container */}
      <div className="rounded-2xl bg-white dark:bg-slate-800">
        <Calendar
          orgId={orgId}
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

