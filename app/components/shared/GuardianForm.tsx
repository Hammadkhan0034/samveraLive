'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface GuardianFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: GuardianFormData) => Promise<void>;
  initialData?: GuardianFormData;
  loading: boolean;
  error: string | null;
  orgs: Array<{ id: string; name: string }>;
  translations: {
    create_guardian: string;
    edit_guardian: string;
    full_name: string;
    email: string;
    phone: string;
    organization: string;
    status: string;
    active: string;
    inactive: string;
    create: string;
    update: string;
    cancel: string;
    creating: string;
    updating: string;
    full_name_placeholder: string;
    email_placeholder: string;
    phone_placeholder: string;
    status_placeholder: string;
  };
}

export interface GuardianFormData {
  id?: string;
  full_name: string;
  email: string;
  phone: string;
  org_id: string;
  is_active?: boolean;
}

export function GuardianForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  loading,
  error,
  orgs,
  translations: t
}: GuardianFormProps) {
  const [formData, setFormData] = useState<GuardianFormData>({
    full_name: '',
    email: '',
    phone: '',
    org_id: '',
    is_active: true
  });

  // Update form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        org_id: orgs.length > 0 ? orgs[0].id : '',
        is_active: true
      });
    }
  }, [initialData, orgs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleClose = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      org_id: orgs.length > 0 ? orgs[0].id : '',
      is_active: true
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {formData.id ? t.edit_guardian : t.create_guardian}
          </h3>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.full_name}
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
              required
              placeholder={t.full_name_placeholder}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.email}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
              required
              placeholder={t.email_placeholder}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.phone}
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
              placeholder={t.phone_placeholder}
            />
          </div>

          {/* Organization is automatically assigned - no user input needed */}
          <input
            type="hidden"
            value={formData.org_id}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.status}
            </label>
            <select
              value={formData.is_active ? 'true' : 'false'}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
            >
              <option value="true">{t.active}</option>
              <option value="false">{t.inactive}</option>
            </select>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
