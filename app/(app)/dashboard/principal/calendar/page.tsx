'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Calendar, type CalendarEvent } from '@/app/components/shared/Calendar';
import { EventFormModal, type EventFormData } from '@/app/components/shared/EventFormModal';
import { EventDetailsModal } from '@/app/components/shared/EventDetailsModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { createEvent, updateEvent, deleteEvent, getEvents } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import Loading from '@/app/components/shared/Loading';

export default function PrincipalCalendarPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { session } = useAuth();
  
  const [orgId, setOrgId] = useState<string | null>(null);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [eventFormError, setEventFormError] = useState<string | null>(null);
  const [eventFormLoading, setEventFormLoading] = useState(false);

  // Get orgId from user metadata
  useEffect(() => {
    if (session?.user?.id) {
      const userMetadata = session?.user?.user_metadata as any;
      const fetchedOrgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
      
      if (fetchedOrgId) {
        setOrgId(fetchedOrgId);
      } else {
        // Fetch from API if not in metadata
        fetch(`/api/user-org-id?user_id=${session.user.id}`, { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            if (data.org_id) {
              setOrgId(data.org_id);
            }
          })
          .catch(err => console.error('Failed to fetch org_id:', err));
      }
    }
  }, [session?.user?.id]);

  // Load classes
  useEffect(() => {
    if (orgId) {
      fetch(`/api/classes?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store', credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.classes) {
            setClasses(data.classes.map((c: any) => ({ id: c.id, name: c.name })));
          }
        })
        .catch(err => console.error('Failed to fetch classes:', err));
    }
  }, [orgId]);

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
        userRole: 'principal',
        userId: session?.user?.id,
      });
      setCalendarEvents(events as CalendarEvent[]);
    } catch (e: any) {
      console.error('❌ Error loading calendar events:', e.message);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleCreateEvent = async (data: EventFormData) => {
    try {
      setEventFormLoading(true);
      setEventFormError(null);
      if (!orgId) throw new Error('Organization ID is required');
      
      await createEvent({
        org_id: orgId,
        class_id: data.class_id,
        title: data.title,
        description: data.description,
        start_at: data.start_at,
        end_at: data.end_at,
        location: data.location,
      });
      
      setShowEventForm(false);
      await loadCalendarEvents();
    } catch (error: any) {
      setEventFormError(error.message || 'Failed to create event');
    } finally {
      setEventFormLoading(false);
    }
  };

  const handleUpdateEvent = async (data: EventFormData) => {
    if (!selectedEvent) return;
    
    try {
      setEventFormLoading(true);
      setEventFormError(null);
      
      await updateEvent(selectedEvent.id, {
        title: data.title,
        description: data.description,
        start_at: data.start_at,
        end_at: data.end_at,
        location: data.location,
        class_id: data.class_id,
      });
      
      setShowEventForm(false);
      setSelectedEvent(null);
      await loadCalendarEvents();
    } catch (error: any) {
      setEventFormError(error.message || 'Failed to update event');
    } finally {
      setEventFormLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    
    try {
      await deleteEvent(eventToDelete);
      setShowDeleteConfirm(false);
      setEventToDelete(null);
      setSelectedEvent(null);
      setShowEventDetails(false);
      await loadCalendarEvents();
    } catch (error: any) {
      console.error('Failed to delete event:', error);
    }
  };

  if (loadingEvents && calendarEvents.length === 0) {
    return <Loading fullScreen text="Loading calendar..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4 mt-14">
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
        userRole="principal"
        canEdit={true}
        events={calendarEvents}
        classes={classes}
        onEventClick={(event) => {
          setSelectedEvent(event);
          setShowEventDetails(true);
        }}
        onDateClick={(date) => {
          setSelectedEvent(null);
          setShowEventForm(true);
        }}
        onCreateClick={() => {
          setSelectedEvent(null);
          setShowEventForm(true);
        }}
          />
        </div>

        {/* Event Modals */}
      <EventFormModal
        isOpen={showEventForm}
        onClose={() => {
          setShowEventForm(false);
          setSelectedEvent(null);
          setEventFormError(null);
        }}
        onSubmit={selectedEvent ? handleUpdateEvent : handleCreateEvent}
        initialData={selectedEvent}
        loading={eventFormLoading}
        error={eventFormError}
        orgId={orgId || ''}
        classes={classes}
        userRole="principal"
        canSelectClass={true} // Principal can select class or org-wide
      />

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
          setShowEventForm(true);
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
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
      />
      </main>
    </div>
  );
}

