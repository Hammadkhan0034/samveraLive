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
  successMessage?: string | null;
  orgs: Array<{ id: string; name: string }>;
  asPage?: boolean;
  translations: {
    create_guardian: string;
    edit_guardian: string;
    first_name: string;
    last_name: string;
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
    first_name_placeholder: string;
    last_name_placeholder: string;
    email_placeholder: string;
    phone_placeholder: string;
    status_placeholder: string;
    ssn?: string;
    ssn_placeholder?: string;
    address?: string;
    address_placeholder?: string;
  };
}

export interface GuardianFormData {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  ssn?: string;
  address?: string;
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
  successMessage,
  orgs,
  asPage,
  translations: t
}: GuardianFormProps) {
  // Use lazy initialization to avoid setState in effect
  const [formData, setFormData] = useState<GuardianFormData>(() => {
    if (initialData) {
      return initialData;
    }
    return {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      ssn: '',
      address: '',
      org_id: orgs.length > 0 ? orgs[0].id : '',
      is_active: true
    };
  });

  // Update form data when initialData changes - wrap in requestAnimationFrame to avoid synchronous setState
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          ssn: '',
          address: '',
          org_id: orgs.length > 0 ? orgs[0].id : '',
          is_active: true
        });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [initialData, orgs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleClose = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      ssn: '',
      address: '',
      org_id: orgs.length > 0 ? orgs[0].id : '',
      is_active: true
    });
    onClose();
  };

  if (!asPage && !isOpen) return null;

  return (
    <div className={asPage ? "w-full" : "fixed inset-0 z-50 flex items-center justify-center bg-black/50"}>
      <div className={asPage ? "w-[70%] ml-20 rounded-ds-lg bg-white dark:bg-slate-800 p-ds-md shadow-ds-card" : "w-full max-w-md rounded-ds-lg bg-white dark:bg-slate-800 p-ds-md shadow-ds-lg"}>
        {!asPage && (
          <div className="flex items-center justify-between">
            <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
              {formData.id ? t.edit_guardian : t.create_guardian}
            </h3>
            <button
              onClick={handleClose}
              className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.first_name || 'First Name'}
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
                required
                placeholder={t.first_name_placeholder || 'Enter first name'}
              />
            </div>
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.last_name || 'Last Name'}
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
                required
                placeholder={t.last_name_placeholder || 'Enter last name'}
              />
            </div>
          </div>

          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.email}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
              required
              placeholder={t.email_placeholder}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.phone}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
                placeholder={t.phone_placeholder}
              />
            </div>
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.ssn || 'Social Security Number'}
              </label>
              <input
                type="text"
                value={formData.ssn || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, ssn: e.target.value }))}
                className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
                placeholder={t.ssn_placeholder || '000000-0000'}
              />
            </div>
          </div>

          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.address || 'Address'}
            </label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
              placeholder={t.address_placeholder || 'Enter address'}
            />
          </div>

          {/* Organization is automatically assigned - no user input needed */}
          <input
            type="hidden"
            value={formData.org_id}
          />

          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.status}
            </label>
            <select
              value={formData.is_active ? 'true' : 'false'}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
              className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500"
            >
              <option value="true">{t.active}</option>
              <option value="false">{t.inactive}</option>
            </select>
          </div>

          {error && (
            <div className="text-ds-small text-red-600 dark:text-red-400">{error}</div>
          )}

          {successMessage && (
            <div className="text-ds-small text-mint-600 dark:text-emerald-400">{successMessage}</div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-ds-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-ds-small hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-4 py-2 text-ds-small text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
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
