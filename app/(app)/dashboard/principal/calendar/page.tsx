'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Calendar, type CalendarEvent } from '@/app/components/shared/Calendar';
import { EventDetailsModal } from '@/app/components/shared/EventDetailsModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { deleteEvent, getEvents } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCurrentUserOrgId } from '@/lib/hooks/useCurrentUserOrgId';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';

function PrincipalCalendarPageContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const { session } = useAuth();
  const { sidebarRef } = usePrincipalPageLayout();
  
  // Use universal hook to get org_id (checks metadata first, then API, handles logout if missing)
  const { orgId, isLoading: isLoadingOrgId } = useCurrentUserOrgId();
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);

  // Load classes
  useEffect(() => {
    if (orgId) {
      fetch(`/api/classes?t=${Date.now()}`, { cache: 'no-store', credentials: 'include' })
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
        {loadingEvents && calendarEvents.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            {/* Calendar Header Skeleton */}
            <div className="mb-6 flex items-center justify-between">
              <div className="h-8 w-32 animate-pulse bg-slate-200 dark:bg-slate-700 rounded"></div>
              <div className="flex gap-2">
                <div className="h-8 w-8 animate-pulse bg-slate-200 dark:bg-slate-700 rounded"></div>
                <div className="h-8 w-8 animate-pulse bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
            </div>
            
            {/* Calendar Grid Skeleton */}
            <div className="space-y-2">
              {/* Day names skeleton */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-4 w-full animate-pulse bg-slate-200 dark:bg-slate-700 rounded"></div>
                ))}
              </div>
              
              {/* Calendar days skeleton */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="min-h-[80px] p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="h-4 w-6 mb-2 animate-pulse bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="space-y-1">
                      <div className="h-3 w-full animate-pulse bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-3 w-3/4 animate-pulse bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
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
          onDateClick={() => {
            router.push('/dashboard/principal/calendar/add-event');
          }}
          onCreateClick={() => {
            router.push('/dashboard/principal/calendar/add-event');
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
        loading={deletingEvent}
      />
    </>
  );
}

export default function PrincipalCalendarPage() {
  return (
    <PrincipalPageLayout>
      <PrincipalCalendarPageContent />
    </PrincipalPageLayout>
  );
}

