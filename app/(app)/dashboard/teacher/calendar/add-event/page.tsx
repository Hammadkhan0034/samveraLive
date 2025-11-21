'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createEvent } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTeacherOrgId } from '@/lib/hooks/useTeacherOrgId';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { EventFormData } from '@/app/components/shared/EventFormModal';

export default function AddEventPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { session } = useAuth();
  const { orgId } = useTeacherOrgId();
  const { classes: teacherClasses } = useTeacherClasses();
  
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

  // Initialize default start time
  useEffect(() => {
    if (!formData.start_at) {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      setFormData(prev => ({ ...prev, start_at: now.toISOString().slice(0, 16) }));
    }
  }, []);

  // Set default class_id to first class if available and none selected
  useEffect(() => {
    if (teacherClasses.length > 0 && !formData.class_id) {
      setFormData(prev => ({ ...prev, class_id: teacherClasses[0].id }));
    }
  }, [teacherClasses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orgId) {
      setError('Organization ID is required');
      return;
    }

    // Teachers can only create class-based events
    if (!formData.class_id) {
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
        org_id: orgId,
        class_id: formData.class_id,
        title: formData.title,
        description: formData.description || null,
        start_at: startAtISO,
        end_at: endAtISO,
        location: formData.location || null,
      });
      
      // Redirect to calendar page
      router.push('/dashboard/teacher/calendar');
    } catch (err: any) {
      setError(err.message || t.failed_to_create_event);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/teacher/calendar')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> {t.back}
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.create_event}
          </h1>
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

            {/* Class Selection (required for teachers) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.event_scope_class} <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.class_id || ''}
                onChange={(e) => setFormData({ ...formData, class_id: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                <option value="">{t.select_class || 'Select Class'}</option>
                {teacherClasses.map(cls => (
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
                onClick={() => router.push('/dashboard/teacher/calendar')}
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
                    {t.creating_event}
                  </div>
                ) : (
                  t.create_event
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

