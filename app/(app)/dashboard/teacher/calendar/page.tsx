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
      const events = await getEvents();
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

  return (
    <TeacherPageLayout>
      <div>
        {/* Header */}
        <div className="mb-ds-md">
          <h1 className="text-ds-h1 font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.tile_calendar || 'Calendar'}
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
          <div className="rounded-ds-lg bg-white shadow-ds-card dark:bg-slate-800">
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
        )}

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

