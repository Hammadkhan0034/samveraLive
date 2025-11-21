'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Calendar, type CalendarEvent } from '@/app/components/shared/Calendar';
import { EventDetailsModal } from '@/app/components/shared/EventDetailsModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { deleteEvent, getEvents } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTeacherOrgId } from '@/lib/hooks/useTeacherOrgId';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import Loading from '@/app/components/shared/Loading';

export default function TeacherCalendarPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { session } = useAuth();
  const { orgId } = useTeacherOrgId();
  const { classes: teacherClasses } = useTeacherClasses();
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);

  // Load calendar events
  useEffect(() => {
    if (orgId) {
      loadCalendarEvents();
    }
  }, [orgId]);

  const loadCalendarEvents = async () => {
    if (!orgId) return;
    
    try {
      setLoadingEvents(true);
      const events = await getEvents(orgId, {
        userRole: 'teacher',
        userId: session?.user?.id,
      });
      setCalendarEvents(events as CalendarEvent[]);
    } catch (e: any) {
      console.error('❌ Error loading calendar events:', e.message);
    } finally {
      setLoadingEvents(false);
    }
  };


  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    
    try {
      setDeletingEvent(true);
      await deleteEvent(eventToDelete);
      setShowDeleteConfirm(false);
      setEventToDelete(null);
      setSelectedEvent(null);
      setShowEventDetails(false);
      await loadCalendarEvents();
    } catch (error: any) {
      console.error('Failed to delete event:', error);
    } finally {
      setDeletingEvent(false);
    }
  };

  if (loadingEvents && calendarEvents.length === 0) {
    return <Loading fullScreen text="Loading calendar..." />;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> {t.back}
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.tile_calendar || 'Calendar'}
          </h1>
        </div>

        {/* Calendar Container */}
        <div className="rounded-2xl bg-white dark:bg-slate-800">
          <Calendar
        orgId={orgId || ''}
        userRole="teacher"
        canEdit={true}
        events={calendarEvents}
        classes={teacherClasses}
        onEventClick={(event) => {
          setSelectedEvent(event);
          setShowEventDetails(true);
        }}
        onDateClick={() => {
          router.push('/dashboard/teacher/calendar/add-event');
        }}
        onCreateClick={() => {
          router.push('/dashboard/teacher/calendar/add-event');
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
            router.push(`/dashboard/teacher/calendar/edit-event/${selectedEvent.id}`);
          }
        }}
        onDelete={() => {
          setShowEventDetails(false);
          setEventToDelete(selectedEvent?.id || null);
          setShowDeleteConfirm(true);
        }}
        classes={teacherClasses}
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
        loading={deletingEvent}
      />
      </div>
    </div>
  );
}

