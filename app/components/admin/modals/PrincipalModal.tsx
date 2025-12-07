'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import {
  validateFirstName,
  validateLastName,
  validateEmail,
  validatePhoneNumber,
  validateOrg,
} from '@/lib/utils/validation';

interface Principal {
  id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  org_id: string;
  is_active?: boolean;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
}

interface PrincipalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Principal) => Promise<void>;
  initialData?: Principal;
  organizations: Organization[];
  loading?: boolean;
  error?: string | null;
}

export function PrincipalModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  organizations,
  loading = false,
  error: externalError = null,
}: PrincipalModalProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<Principal>({
    first_name: '',
    last_name: '',
    full_name: '',
    email: '',
    phone: '',
    org_id: '',
    is_active: true,
  });
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Use first_name and last_name if available directly, otherwise split full_name or name
        let first = initialData.first_name || '';
        let last = initialData.last_name || '';
        
        if (!first && !last) {
          // Fallback: split full_name or name
          const fullName = initialData.full_name || '';
          const parts = fullName.trim().split(/\s+/);
          first = parts.shift() || '';
          last = parts.join(' ');
        }
        
        const fullName = [first, last].filter(Boolean).join(' ').trim();
        setFormData({
          id: initialData.id,
          first_name: first,
          last_name: last,
          full_name: fullName,
          email: initialData.email || '',
          phone: initialData.phone || '',
          org_id: initialData.org_id,
          is_active: initialData.is_active !== false,
        });
      } else {
        setFormData({
          first_name: '',
          last_name: '',
          full_name: '',
          email: '',
          phone: '',
          org_id: organizations[0]?.id || '',
          is_active: true,
        });
      }
      // Reset errors
      setFirstNameError(null);
      setLastNameError(null);
      setEmailError(null);
      setPhoneError(null);
      setOrgError(null);
      setError(null);
    }
  }, [isOpen, initialData, organizations]);

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
    setFirstNameError(null);
    setLastNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setOrgError(null);

    // Validate all fields
    const firstNameValidation = validateFirstName(formData.first_name);
    const lastNameValidation = validateLastName(formData.last_name);
    const emailValidation = validateEmail(formData.email);
    const phoneValidation = validatePhoneNumber(formData.phone);
    const orgValidation = validateOrg(formData.org_id);

    // Set field-level errors
    if (!firstNameValidation.valid) {
      setFirstNameError(firstNameValidation.error);
    }
    if (!lastNameValidation.valid) {
      setLastNameError(lastNameValidation.error);
    }
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error);
    }
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error);
    }
    if (!orgValidation.valid) {
      setOrgError(orgValidation.error);
    }

    // If any validation fails, stop submission
    if (!firstNameValidation.valid || !lastNameValidation.valid || 
        !emailValidation.valid || !phoneValidation.valid || !orgValidation.valid) {
      return;
    }

    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({
        first_name: '',
        last_name: '',
        full_name: '',
        email: '',
        phone: '',
        org_id: organizations[0]?.id || '',
        is_active: true,
      });
      setFirstNameError(null);
      setLastNameError(null);
      setEmailError(null);
      setPhoneError(null);
      setOrgError(null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save principal');
    }
  };

  const handleClose = () => {
    setFormData({
      first_name: '',
      last_name: '',
      full_name: '',
      email: '',
      phone: '',
      org_id: organizations[0]?.id || '',
      is_active: true,
    });
    setFirstNameError(null);
    setLastNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setOrgError(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="w-full max-w-md rounded-ds-lg bg-white dark:bg-slate-800 p-4 sm:p-6 lg:p-ds-md shadow-ds-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
          <h3 className="text-ds-small sm:text-ds-h3 font-semibold text-slate-900 dark:text-slate-100 truncate">
            {formData.id ? t.edit_principal : t.create_principal}
          </h3>
          <button
            onClick={handleClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.principal_first_name}
              </label>
              <input
                type="text"
                value={formData.first_name || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData((p) => ({ ...p, first_name: value, full_name: `${value} ${p.last_name || ''}`.trim() }));
                  // Validate on change
                  const validation = validateFirstName(value);
                  if (!validation.valid) {
                    setFirstNameError(validation.error);
                  } else {
                    setFirstNameError(null);
                  }
                }}
                onBlur={(e) => {
                  const validation = validateFirstName(e.target.value);
                  if (!validation.valid) {
                    setFirstNameError(validation.error);
                  } else {
                    setFirstNameError(null);
                  }
                }}
                placeholder={t.principal_first_name_placeholder}
                className={`w-full rounded-ds-md border bg-white dark:bg-slate-900 px-3 py-2 text-ds-tiny sm:text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 dark:text-white ${
                  firstNameError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                    : 'border-[#D8EBD8] dark:border-slate-600 focus:border-mint-500 focus:ring-mint-500'
                }`}
                required
              />
              {firstNameError && (
                <p className="mt-1 text-ds-tiny text-red-600 dark:text-red-400">{firstNameError}</p>
              )}
            </div>
            <div>
              <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.principal_last_name}
              </label>
              <input
                type="text"
                value={formData.last_name || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData((p) => ({ ...p, last_name: value, full_name: `${p.first_name || ''} ${value}`.trim() }));
                  // Validate on change
                  const validation = validateLastName(value);
                  if (!validation.valid) {
                    setLastNameError(validation.error);
                  } else {
                    setLastNameError(null);
                  }
                }}
                onBlur={(e) => {
                  const validation = validateLastName(e.target.value);
                  if (!validation.valid) {
                    setLastNameError(validation.error);
                  } else {
                    setLastNameError(null);
                  }
                }}
                placeholder={t.principal_last_name_placeholder}
                className={`w-full rounded-ds-md border bg-white dark:bg-slate-900 px-3 py-2 text-ds-tiny sm:text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 dark:text-white ${
                  lastNameError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                    : 'border-[#D8EBD8] dark:border-slate-600 focus:border-mint-500 focus:ring-mint-500'
                }`}
                required
              />
              {lastNameError && (
                <p className="mt-1 text-ds-tiny text-red-600 dark:text-red-400">{lastNameError}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.principal_email}
            </label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => {
                const value = e.target.value;
                setFormData((p) => ({ ...p, email: value }));
                // Validate on change
                const validation = validateEmail(value);
                if (!validation.valid) {
                  setEmailError(validation.error);
                } else {
                  setEmailError(null);
                }
              }}
              onBlur={(e) => {
                const validation = validateEmail(e.target.value);
                if (!validation.valid) {
                  setEmailError(validation.error);
                } else {
                  setEmailError(null);
                }
              }}
              placeholder={t.principal_email_placeholder}
              className={`w-full rounded-ds-md border bg-white dark:bg-slate-900 px-3 py-2 text-ds-tiny sm:text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 dark:text-white ${
                emailError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                  : 'border-[#D8EBD8] dark:border-slate-600 focus:border-mint-500 focus:ring-mint-500'
              }`}
            />
            {emailError && (
              <p className="mt-1 text-ds-tiny text-red-600 dark:text-red-400">{emailError}</p>
            )}
          </div>

          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.principal_phone}
            </label>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => {
                const phoneValue = e.target.value;
                setFormData((p) => ({ ...p, phone: phoneValue }));
                // Validate on change
                const validation = validatePhoneNumber(phoneValue);
                if (!validation.valid) {
                  setPhoneError(validation.error || t.principal_phone_invalid || 'Please enter a valid phone number');
                } else {
                  setPhoneError(null);
                }
              }}
              onBlur={(e) => {
                // Validate on blur
                const validation = validatePhoneNumber(e.target.value);
                if (!validation.valid) {
                  setPhoneError(validation.error || t.principal_phone_invalid || 'Please enter a valid phone number');
                } else {
                  setPhoneError(null);
                }
              }}
              placeholder={t.principal_phone_placeholder}
              className={`w-full rounded-ds-md border bg-white dark:bg-slate-900 px-3 py-2 text-ds-tiny sm:text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 dark:text-white ${
                phoneError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                  : 'border-slate-300 dark:border-slate-600 focus:border-mint-500 focus:ring-mint-500'
              }`}
            />
            {phoneError && (
              <p className="mt-1 text-ds-tiny text-red-600 dark:text-red-400">{phoneError}</p>
            )}
          </div>

          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.principal_org}
            </label>
            <select
              value={formData.org_id}
              onChange={(e) => {
                const value = e.target.value;
                setFormData((p) => ({ ...p, org_id: value }));
                // Validate on change
                const validation = validateOrg(value);
                if (!validation.valid) {
                  setOrgError(validation.error);
                } else {
                  setOrgError(null);
                }
              }}
              onBlur={(e) => {
                const validation = validateOrg(e.target.value);
                if (!validation.valid) {
                  setOrgError(validation.error);
                } else {
                  setOrgError(null);
                }
              }}
              className={`w-full rounded-ds-md border bg-white dark:bg-slate-900 px-3 py-2 text-ds-tiny sm:text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 dark:text-white ${
                orgError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                  : 'border-[#D8EBD8] dark:border-slate-600 focus:border-mint-500 focus:ring-mint-500'
              }`}
              required
            >
              <option value="">Select organization</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            {orgError && (
              <p className="mt-1 text-ds-tiny text-red-600 dark:text-red-400">{orgError}</p>
            )}
          </div>

          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.status}
            </label>
            <select
              value={formData.is_active ? 'true' : 'false'}
              onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.value === 'true' }))}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-ds-tiny sm:text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:text-white"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
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
              disabled={loading || !!firstNameError || !!lastNameError || !!emailError || !!phoneError || !!orgError}
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
