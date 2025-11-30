'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateEvent, getEvents } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTeacherOrgId } from '@/lib/hooks/useTeacherOrgId';
import { useCurrentUserOrgId } from '@/lib/hooks/useCurrentUserOrgId';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import Loading from '@/app/components/shared/Loading';
import type { EventFormData } from '@/app/components/shared/EventFormModal';
import type { CalendarEvent } from '@/app/components/shared/Calendar';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';

export interface EditEventPageProps {
  userRole: 'principal' | 'teacher';
  calendarRoute: string;
  eventId: string;
}

export function EditEventPage({ userRole, calendarRoute, eventId }: EditEventPageProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { session } = useAuth();
  
  // Teacher-specific hooks
  const { orgId: teacherOrgId } = useTeacherOrgId();
  const { classes: teacherClasses } = useTeacherClasses();
  
  // Principal-specific state
  const { orgId: principalOrgId } = useCurrentUserOrgId();
  const [principalClasses, setPrincipalClasses] = useState<Array<{ id: string; name: string }>>([]);
  
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    start_at: '',
    end_at: '',
    location: '',
    class_id: null,
  });
  const [loading, setLoading] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get orgId based on role
  const orgId = userRole === 'teacher' ? teacherOrgId : principalOrgId;
  const classes = userRole === 'teacher' ? teacherClasses : principalClasses;

  // Principal: Load classes
  useEffect(() => {
    if (userRole === 'principal' && principalOrgId) {
      fetch(`/api/classes?t=${Date.now()}`, { cache: 'no-store', credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.classes) {
            setPrincipalClasses(data.classes.map((c: any) => ({ id: c.id, name: c.name })));
          }
        })
        .catch(err => console.error('Failed to fetch classes:', err));
    }
  }, [userRole, principalOrgId]);

  // Load event data
  useEffect(() => {
    if (orgId && eventId) {
      loadEvent();
    }
  }, [orgId, eventId]);

  const loadEvent = async () => {
    if (!orgId || !eventId) return;
    
    try {
      setLoadingEvent(true);
      const events = await getEvents(orgId, {
        userRole: userRole,
        userId: session?.user?.id,
      });
      
      const foundEvent = events.find((e: CalendarEvent) => e.id === eventId);
      
      if (!foundEvent) {
        setError('Event not found');
        return;
      }
      
      setEvent(foundEvent);
      
      // Initialize form data
      const startDate = new Date(foundEvent.start_at);
      const endDate = foundEvent.end_at ? new Date(foundEvent.end_at) : null;
      
      setFormData({
        title: foundEvent.title,
        description: foundEvent.description || '',
        start_at: startDate.toISOString().slice(0, 16),
        end_at: endDate ? endDate.toISOString().slice(0, 16) : '',
        location: foundEvent.location || '',
        class_id: foundEvent.class_id,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load event');
    } finally {
      setLoadingEvent(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!event) return;

    try {
      setLoading(true);
      setError(null);
      
      // Teachers can only edit class-based events
      if (userRole === 'teacher' && !formData.class_id) {
        setError('Teachers can only edit class-based events');
        setLoading(false);
        return;
      }
      
      // Convert datetime-local format to ISO string
      const startAtISO = new Date(formData.start_at).toISOString();
      const endAtISO = formData.end_at ? new Date(formData.end_at).toISOString() : null;

      // Validate end_at is after start_at
      if (endAtISO && new Date(endAtISO) < new Date(startAtISO)) {
        setError('End date must be after start date');
        setLoading(false);
        return;
      }

      await updateEvent(event.id, {
        title: formData.title,
        description: formData.description || null,
        start_at: startAtISO,
        end_at: endAtISO,
        location: formData.location || null,
        class_id: formData.class_id,
      });
      
      // Redirect to calendar page
      router.push(calendarRoute);
    } catch (err: any) {
      setError(err.message || t.failed_to_update_event);
    } finally {
      setLoading(false);
    }
  };

  if (loadingEvent) {
    const loadingContent = <Loading fullScreen text="Loading event..." />;
    if (userRole === 'teacher') {
      return <TeacherPageLayout>{loadingContent}</TeacherPageLayout>;
    }
    return <PrincipalPageLayout>{loadingContent}</PrincipalPageLayout>;
  }

  if (!event) {
    const errorContent = (
      <>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-slate-600 dark:text-slate-400">{error || 'Event not found'}</p>
        </div>
      </>
    );
    
    if (userRole === 'teacher') {
      return <TeacherPageLayout>{errorContent}</TeacherPageLayout>;
    }
    return <PrincipalPageLayout>{errorContent}</PrincipalPageLayout>;
  }

  const content = (
    <>
      {/* Content Header */}
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.edit_event}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <ProfileSwitcher />
        </div>
      </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Form Container */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.event_title} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                placeholder={t.event_title_placeholder}
              />
            </div>

            {/* Class Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {userRole === 'teacher' ? (
                  <>
                    {t.event_scope_class} <span className="text-red-500">*</span>
                  </>
                ) : (
                  t.event_scope
                )}
              </label>
              <select
                required={userRole === 'teacher'}
                value={formData.class_id || ''}
                onChange={(e) => setFormData({ ...formData, class_id: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {userRole === 'principal' && (
                  <option value="">{t.event_scope_org_wide}</option>
                )}
                {userRole === 'teacher' && (
                  <option value="">{t.select_class || 'Select Class'}</option>
                )}
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date/Time */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.event_start_date} <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formData.start_at}
                onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>

            {/* End Date/Time */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.event_end_date} ({t.optional})
              </label>
              <input
                type="datetime-local"
                value={formData.end_at || ''}
                onChange={(e) => setFormData({ ...formData, end_at: e.target.value || null })}
                min={formData.start_at}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.event_location} ({t.optional})
              </label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                placeholder={t.event_location_placeholder}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.event_description} ({t.optional})
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                placeholder={t.event_description_placeholder}
              />
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.push(calendarRoute)}
                disabled={loading}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    {t.updating_event}
                  </div>
                ) : (
                  t.update_event
                )}
              </button>
            </div>
          </form>
        </div>
    </>
  );

  // Wrap in appropriate layout based on role
  if (userRole === 'teacher') {
    return <TeacherPageLayout>{content}</TeacherPageLayout>;
  }

  // Principal uses PrincipalPageLayout
  return <PrincipalPageLayout>{content}</PrincipalPageLayout>;
}

