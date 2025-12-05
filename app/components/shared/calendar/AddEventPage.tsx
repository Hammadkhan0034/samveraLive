'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createEvent } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { EventFormData } from '@/app/components/shared/EventFormModal';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';

export interface AddEventPageProps {
  userRole: 'principal' | 'teacher';
  calendarRoute: string;
}

export function AddEventPage({ userRole, calendarRoute }: AddEventPageProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { session } = useAuth();
  
  // Teacher-specific hooks
  const { classes: teacherClasses } = useTeacherClasses();
  
  // Principal-specific state
  const [principalClasses, setPrincipalClasses] = useState<Array<{ id: string; name: string }>>([]);
  
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    start_at: '',
    end_at: '',
    location: '',
    class_id: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classes = userRole === 'teacher' ? teacherClasses : principalClasses;

  // Principal: Load classes
  useEffect(() => {
    if (userRole === 'principal') {
      fetch(`/api/classes?t=${Date.now()}`, { cache: 'no-store', credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.classes) {
            setPrincipalClasses(data.classes.map((c: any) => ({ id: c.id, name: c.name })));
          }
        })
        .catch(err => console.error('Failed to fetch classes:', err));
    }
  }, [userRole]);

  // Initialize default start time
  useEffect(() => {
    if (!formData.start_at) {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      setFormData(prev => ({ ...prev, start_at: now.toISOString().slice(0, 16) }));
    }
  }, []);

  // Set default class_id to first class if available and none selected (for teachers)
  useEffect(() => {
    if (userRole === 'teacher' && classes.length > 0 && !formData.class_id) {
      setFormData(prev => ({ ...prev, class_id: classes[0].id }));
    }
  }, [userRole, classes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Teachers can only create class-based events
    if (userRole === 'teacher' && !formData.class_id) {
      setError('Teachers can only create class-based events');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Convert datetime-local format to ISO string
      const startAtISO = new Date(formData.start_at).toISOString();
      const endAtISO = formData.end_at ? new Date(formData.end_at).toISOString() : null;

      // Validate end_at is after start_at
      if (endAtISO && new Date(endAtISO) < new Date(startAtISO)) {
        setError('End date must be after start date');
        setLoading(false);
        return;
      }

      await createEvent({
        class_id: formData.class_id,
        title: formData.title,
        description: formData.description || null,
        start_at: startAtISO,
        end_at: endAtISO,
        location: formData.location || null,
      });
      
      // Redirect to calendar page
      router.push(calendarRoute);
    } catch (err: any) {
      setError(err.message || t.failed_to_create_event);
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <>
      {/* Content Header */}
      <div className="mb-3 flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <h2 className="text-ds-small sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.create_event}
          </h2>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ProfileSwitcher />
        </div>
      </div>

          {error && (
            <div className="mb-3 sm:mb-4 rounded-lg bg-red-50 border border-red-200 px-3 sm:px-4 py-2 sm:py-3 text-ds-tiny sm:text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Form Container */}
          <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              {/* Title */}
              <div>
                <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.event_title} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-tiny sm:text-ds-small text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
                  placeholder={t.event_title_placeholder}
                />
              </div>

              {/* Class Selection */}
              <div>
                <label className="block text-ds-tiny sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-ds-tiny sm:text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
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
                <label className="block text-ds-tiny sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.event_start_date} <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.start_at}
                  onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-ds-tiny sm:text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
                />
              </div>

              {/* End Date/Time */}
              <div>
                <label className="block text-ds-tiny sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.event_end_date} ({t.optional})
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_at || ''}
                  onChange={(e) => setFormData({ ...formData, end_at: e.target.value || null })}
                  min={formData.start_at}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-ds-tiny sm:text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-ds-tiny sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.event_location} ({t.optional})
                </label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value || null })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-ds-tiny sm:text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
                  placeholder={t.event_location_placeholder}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-ds-tiny sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.event_description} ({t.optional})
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-ds-tiny sm:text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 resize-y"
                  placeholder={t.event_description_placeholder}
                />
              </div>

              {/* Form Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={() => router.push(calendarRoute)}
                  disabled={loading}
                  className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-ds-tiny sm:text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 active:bg-slate-100 dark:active:bg-slate-500 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto rounded-ds-md bg-mint-500 px-3 sm:px-4 py-2 text-ds-tiny sm:text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:bg-mint-700"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-white border-t-transparent flex-shrink-0"></div>
                      <span className="hidden sm:inline">{t.creating_event}</span>
                      <span className="sm:hidden">Creating...</span>
                    </div>
                  ) : (
                    <>
                      <span className="hidden sm:inline">{t.create_event}</span>
                      <span className="sm:hidden">Create</span>
                    </>
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

