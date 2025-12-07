'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { validateSlug, validateOrgForm } from '@/lib/utils/validation';

interface Organization {
  id?: string;
  name: string;
  slug: string;
  timezone: string;
}

interface OrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Organization) => Promise<void>;
  initialData?: Organization;
  loading?: boolean;
  error?: string | null;
}

export function OrganizationModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  loading = false,
  error: externalError = null,
}: OrganizationModalProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<Organization>({
    name: '',
    slug: '',
    timezone: 'UTC',
  });
  const [slugError, setSlugError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({ name: '', slug: '', timezone: 'UTC' });
      }
      setSlugError(null);
      setError(null);
    }
  }, [isOpen, initialData]);

  // Update error when external error changes
  useEffect(() => {
    if (externalError) {
      setError(externalError);
    }
  }, [externalError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setError(null);
    setSlugError(null);

    // Validate slug before submitting
    if (!validateSlug(formData.slug)) {
      setSlugError('Slug must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    // Validate entire form using Zod
    const validation = validateOrgForm(formData);
    if (!validation.valid) {
      setError(validation.error || 'Validation failed');
      return;
    }

    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({ name: '', slug: '', timezone: 'UTC' });
      setSlugError(null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save organization');
    }
  };

  const handleClose = () => {
    setFormData({ name: '', slug: '', timezone: 'UTC' });
    setSlugError(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="w-full max-w-md rounded-ds-lg bg-white dark:bg-slate-800 p-4 sm:p-6 lg:p-ds-md shadow-ds-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
          <h3 className="text-ds-small sm:text-ds-h3 font-semibold text-slate-900 dark:text-slate-100 truncate">
            {formData.id ? t.edit_organization : t.create_organization}
          </h3>
          <button
            onClick={handleClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.organization_name}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder={t.organization_name_placeholder}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-ds-tiny sm:text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.organization_slug}
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => {
                const slugValue = e.target.value.toLowerCase();
                setFormData((p) => ({ ...p, slug: slugValue }));
                // Validate on change
                if (slugValue && !validateSlug(slugValue)) {
                  setSlugError('Slug must contain only lowercase letters, numbers, and hyphens');
                } else {
                  setSlugError(null);
                }
              }}
              onBlur={(e) => {
                // Validate on blur
                if (e.target.value && !validateSlug(e.target.value)) {
                  setSlugError('Slug must contain only lowercase letters, numbers, and hyphens');
                } else {
                  setSlugError(null);
                }
              }}
              placeholder={t.organization_slug_placeholder}
              className={`w-full rounded-ds-md border bg-white dark:bg-slate-900 px-3 py-2 text-ds-tiny sm:text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 dark:text-white ${
                slugError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                  : 'border-[#D8EBD8] dark:border-slate-600 focus:border-mint-500 focus:ring-mint-500'
              }`}
              required
            />
            {slugError && (
              <p className="mt-1 text-ds-tiny text-red-600 dark:text-red-400">{slugError}</p>
            )}
          </div>

          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.organization_timezone}
            </label>
            <input
              type="text"
              value={formData.timezone}
              onChange={(e) => setFormData((p) => ({ ...p, timezone: e.target.value }))}
              placeholder={t.organization_timezone_placeholder}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-ds-tiny sm:text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:text-white"
            />
          </div>

          {(error || externalError) && (
            <div className="text-ds-tiny sm:text-ds-small text-red-600 dark:text-red-400 px-3 sm:px-4 py-2 sm:py-3">
              {error || externalError}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-ds-md border border-slate-300 dark:border-slate-600 px-3 sm:px-4 py-2 text-ds-tiny sm:text-ds-small hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t.cancel_delete}
            </button>
            <button
              type="submit"
              disabled={loading || !!slugError}
              className="flex-1 rounded-ds-md bg-mint-500 px-3 sm:px-4 py-2 text-ds-tiny sm:text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {formData.id ? t.updating : t.creating}
                </>
              ) : (
                formData.id ? t.update : t.create
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
