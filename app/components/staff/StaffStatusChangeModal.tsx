'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { StaffStatusType, StaffStatusChangeFormData } from '@/lib/types/staff';
import { updateStaffStatusSchema } from '@/lib/validation/staff';

interface StaffStatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  staffId: string;
  status: StaffStatusType;
}

const DEFAULT_FORM_DATA: Omit<StaffStatusChangeFormData, 'staff_id' | 'status'> = {
  reason: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: null,
};

export function StaffStatusChangeModal({
  isOpen,
  onClose,
  onSuccess,
  staffId,
  status,
}: StaffStatusChangeModalProps) {
  const { t } = useLanguage();

  const [formData, setFormData] = useState<Omit<StaffStatusChangeFormData, 'staff_id' | 'status'>>(
    DEFAULT_FORM_DATA,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateErrors, setDateErrors] = useState<{
    start_date?: string;
    end_date?: string;
  }>({});

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        reason: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: null,
      });
      setError(null);
      setDateErrors({});
    }
  }, [isOpen]);

  const resetForm = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA);
    setError(null);
    setDateErrors({});
  }, []);

  const validateDates = useCallback(() => {
    const errors: { start_date?: string; end_date?: string } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (formData.start_date) {
      const startDate = new Date(formData.start_date);
      startDate.setHours(0, 0, 0, 0);

      if (startDate < today) {
        errors.start_date = t.status_start_date_invalid || 'Start date must be today or later';
      }
    }

    if (formData.end_date && formData.start_date) {
      const endDate = new Date(formData.end_date);
      const startDate = new Date(formData.start_date);
      endDate.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);

      if (endDate < startDate) {
        errors.end_date = t.status_end_date_invalid || 'End date must be >= start date';
      }
    }

    setDateErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate dates
      if (!validateDates()) {
        return;
      }

      // Prepare data for validation
      const submitData = {
        staff_id: staffId,
        status,
        reason: formData.reason || (status === 'active' ? 'Staff member reactivated' : ''),
        start_date: formData.start_date,
        end_date: formData.end_date || formData.start_date, // If end_date is empty, set to start_date
      };

      // Validate with Zod schema
      const validationResult = updateStaffStatusSchema.safeParse(submitData);
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        setError(firstError.message);
        return;
      }

      try {
        setError(null);
        setLoading(true);

        const response = await fetch('/api/staff-management', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validationResult.data),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update staff status');
        }

        resetForm();
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } catch (error: any) {
        const errorMsg = error.message || 'Failed to update staff status';
        setError(errorMsg);
        console.error('❌ Staff status update error:', errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [formData, staffId, status, validateDates, onClose, onSuccess, resetForm],
  );

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  if (!isOpen) return null;

  const isReasonRequired = status !== 'active';
  const statusLabels: Record<StaffStatusType, string> = {
    active: t.active || 'Active',
    inactive: t.inactive || 'Inactive',
    holiday: t.on_holiday || 'On Holiday',
    sick_leave: t.on_sick_leave || 'On Sick Leave',
    maternity_leave: t.on_maternity_leave || 'On Maternity Leave',
    casual_leave: t.on_casual_leave || 'On Casual Leave',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-xl rounded-ds-lg bg-white p-ds-md shadow-ds-lg dark:bg-slate-800">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100">
            {t.change_status || 'Change Staff Status'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.status || 'Status'}
            </label>
            <input
              type="text"
              value={statusLabels[status]}
              disabled
              className="w-full rounded-ds-md border border-slate-300 bg-slate-100 px-3 py-2 text-ds-small text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.status_reason || 'Reason/Explanation'}
              {isReasonRequired && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder={t.status_reason_placeholder || 'Enter reason for status change...'}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              rows={3}
              required={isReasonRequired}
            />
            {isReasonRequired && (
              <p className="mt-1 text-ds-tiny text-slate-500 dark:text-slate-400">
                {t.status_reason_required || 'Reason is required (minimum 10 characters)'}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.status_start_date || 'Start Date'} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, start_date: e.target.value }));
                  // Clear end_date error if start_date changes
                  if (dateErrors.end_date) {
                    setDateErrors((prev) => ({ ...prev, end_date: undefined }));
                  }
                }}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                required
                onBlur={validateDates}
              />
              {dateErrors.start_date && (
                <p className="mt-1 text-ds-tiny text-red-600 dark:text-red-400">
                  {dateErrors.start_date}
                </p>
              )}
            </div>
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.status_end_date || 'End Date'} ({t.optional || 'Optional'})
              </label>
              <input
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    end_date: e.target.value || null,
                  }));
                }}
                min={formData.start_date || new Date().toISOString().split('T')[0]}
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                onBlur={validateDates}
              />
              {dateErrors.end_date && (
                <p className="mt-1 text-ds-tiny text-red-600 dark:text-red-400">
                  {dateErrors.end_date}
                </p>
              )}
              <p className="mt-1 text-ds-tiny text-slate-500 dark:text-slate-400">
                {t.status_end_date_help || 'If not provided, will be set to start date'}
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small text-slate-700 hover:bg-mint-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {t.updating || 'Updating...'}
                </>
              ) : (
                t.update_status || 'Update Status'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

