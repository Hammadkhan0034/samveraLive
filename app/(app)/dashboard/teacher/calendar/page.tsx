'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, type CalendarEvent } from '@/app/components/shared/Calendar';
import { EventDetailsModal } from '@/app/components/shared/EventDetailsModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { deleteEvent, getEvents } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTeacherOrgId } from '@/lib/hooks/useTeacherOrgId';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import Loading from '@/app/components/shared/Loading';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';

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
    return (
      <TeacherPageLayout>
        <Loading fullScreen text="Loading calendar..." />
      </TeacherPageLayout>
    );
  }

  return (
    <TeacherPageLayout>
      <div>
        {/* Header */}
        <div className="mb-6">
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
    </TeacherPageLayout>
  );
}

