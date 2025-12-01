'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { CalendarEvent } from './Calendar';

export interface EventFormData {
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  class_id: string | null;
}

export interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EventFormData) => Promise<void>;
  initialData?: CalendarEvent | null;
  loading?: boolean;
  error?: string | null;
  orgId: string;
  classes: Array<{ id: string; name: string }>;
  userRole: 'principal' | 'teacher';
  canSelectClass: boolean; // Principal can select class or org-wide, Teacher only class-based
}

export function EventFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  loading = false,
  error,
  orgId,
  classes,
  userRole,
  canSelectClass,
}: EventFormModalProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    start_at: '',
    end_at: '',
    location: '',
    class_id: null,
  });

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      const startDate = new Date(initialData.start_at);
      const endDate = initialData.end_at ? new Date(initialData.end_at) : null;
      
      setFormData({
        title: initialData.title,
        description: initialData.description || '',
        start_at: startDate.toISOString().slice(0, 16), // Format for datetime-local input
        end_at: endDate ? endDate.toISOString().slice(0, 16) : '',
        location: initialData.location || '',
        class_id: initialData.class_id,
      });
    } else {
      // Set default start time to current date/time
      const now = new Date();
      now.setMinutes(0, 0, 0); // Round to nearest hour
      setFormData({
        title: '',
        description: '',
        start_at: now.toISOString().slice(0, 16),
        end_at: '',
        location: '',
        class_id: null,
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert datetime-local format to ISO string
    // datetime-local format: "YYYY-MM-DDTHH:mm" (local time, no timezone)
    // new Date() interprets this as local time, then toISOString() converts to UTC
    // This is correct - we store in UTC, but compare using local dates when displaying
    const startAtISO = new Date(formData.start_at).toISOString();
    const endAtISO = formData.end_at ? new Date(formData.end_at).toISOString() : null;

    // Validate end_at is after start_at
    if (endAtISO && new Date(endAtISO) < new Date(startAtISO)) {
      return;
    }

    await onSubmit({
      ...formData,
      start_at: startAtISO,
      end_at: endAtISO,
      description: formData.description || null,
      location: formData.location || null,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-ds-lg bg-white dark:bg-slate-800 p-ds-md shadow-ds-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
            {initialData ? t.edit_event : t.create_event}
          </h3>
          <button
            onClick={onClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.event_title} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
              placeholder={t.event_title_placeholder}
            />
          </div>

          {/* Class Selection (only for Principal or if canSelectClass) */}
          {canSelectClass && (
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.event_scope}
              </label>
              <select
                value={formData.class_id || ''}
                onChange={(e) => setFormData({ ...formData, class_id: e.target.value || null })}
                className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
              >
                <option value="">{t.event_scope_org_wide}</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Start Date/Time */}
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.event_start_date} <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={formData.start_at}
              onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
              className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
            />
          </div>

          {/* End Date/Time */}
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.event_end_date} ({t.optional})
            </label>
            <input
              type="datetime-local"
              value={formData.end_at || ''}
              onChange={(e) => setFormData({ ...formData, end_at: e.target.value || null })}
              min={formData.start_at}
              className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.event_location} ({t.optional})
            </label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value || null })}
              className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
              placeholder={t.event_location_placeholder}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.event_description} ({t.optional})
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
              rows={4}
              className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
              placeholder={t.event_description_placeholder}
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small text-slate-700 hover:bg-mint-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  {initialData ? t.updating_event : t.creating_event}
                </div>
              ) : (
                initialData ? t.update_event : t.create_event
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

