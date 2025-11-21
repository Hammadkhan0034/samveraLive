'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, type CalendarEvent } from '@/app/components/shared/Calendar';
import { EventDetailsModal } from '@/app/components/shared/EventDetailsModal';
import { getEvents } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { ArrowLeft } from 'lucide-react';

export default function ParentCalendarPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { session } = useAuth();
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [linkedStudents, setLinkedStudents] = useState<Array<{ id: string; first_name: string; last_name: string | null; classes?: { name: string }; class_id?: string | null }>>([]);
  const [derivedClassId, setDerivedClassId] = useState<string | null>(null);

  // Load linked students
  useEffect(() => {
    let isMounted = true;

    async function loadLinkedStudents() {
      if (!session?.user?.id) return;

      const orgId = (session?.user?.user_metadata as any)?.org_id as string | undefined;
      const classId = (session?.user?.user_metadata as any)?.class_id as string | undefined;
      const guardianId = session?.user?.id;

      if (!orgId || !guardianId) return;

      try {
        const studentsRes = await fetch(`/api/guardian-students?guardianId=${guardianId}`);
        
        if (!studentsRes.ok) {
          if (isMounted) {
            setLinkedStudents([]);
            setDerivedClassId(classId || null);
          }
          return;
        }
        
        const studentsData = await studentsRes.json();
        const relationships = studentsData.relationships || [];
        const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);

        if (studentIds.length > 0) {
          const studentsDetailsRes = await fetch(`/api/students?orgId=${orgId}`);
          
          if (!studentsDetailsRes.ok) {
            if (isMounted) {
              setLinkedStudents([]);
              setDerivedClassId(classId || null);
            }
            return;
          }
          
          const studentsDetails = await studentsDetailsRes.json();
          const allStudents = studentsDetails.students || [];
          
          const linked = allStudents
            .filter((s: any) => studentIds.includes(s.id))
            .map((s: any) => ({
              id: s.id,
              first_name: s.users?.first_name || s.first_name || '',
              last_name: s.users?.last_name || s.last_name || null,
              classes: s.classes || null,
              class_id: s.class_id || s.classes?.id || null,
            }));
          
          if (isMounted) {
            setLinkedStudents(linked);
            const effClassId = classId || (linked.find((s: { class_id?: string | null }) => !!s.class_id)?.class_id || null);
            setDerivedClassId(effClassId);
          }
        } else {
          if (isMounted) {
            setLinkedStudents([]);
            setDerivedClassId(classId || null);
          }
        }
      } catch (e: any) {
        console.error('❌ Error loading linked students:', e);
        if (isMounted) {
          setLinkedStudents([]);
          setDerivedClassId(classId || null);
        }
      }
    }

    loadLinkedStudents();

    return () => {
      isMounted = false;
    };
  }, [session]);

  // Load calendar events
  useEffect(() => {
    const orgId = (session?.user?.user_metadata as any)?.org_id;
    if (orgId && session?.user?.id) {
      loadCalendarEvents();
    }
  }, [session?.user?.id, derivedClassId]);

  const loadCalendarEvents = async () => {
    const orgId = (session?.user?.user_metadata as any)?.org_id;
    if (!orgId || !session?.user?.id) return;
    
    try {
      setLoadingEvents(true);
      const events = await getEvents(orgId, {
        classId: derivedClassId,
        userRole: 'parent',
        userId: session?.user?.id,
      });
      setCalendarEvents(events as CalendarEvent[]);
    } catch (e: any) {
      console.error('❌ Error loading calendar events:', e.message);
    } finally {
      setLoadingEvents(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-6 mt-14 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.back || 'Back'}
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.calendar || 'Calendar'}
          </h1>
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
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <Calendar
              orgId={(session?.user?.user_metadata as any)?.org_id || ''}
              classId={derivedClassId}
              userRole="parent"
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
          classes={linkedStudents.map(s => s.classes ? { id: s.class_id || '', name: s.classes.name } : null).filter(Boolean) as Array<{ id: string; name: string }>}
        />
      </div>
    </div>
  );
}

