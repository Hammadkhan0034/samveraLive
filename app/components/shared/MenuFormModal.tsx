'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { Menu } from '@/lib/types/menus';

export interface MenuFormData {
  class_id?: string | null;
  day: string;
  breakfast?: string | null;
  lunch?: string | null;
  snack?: string | null;
  notes?: string | null;
  is_public?: boolean;
}

export interface MenuFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MenuFormData & { id?: string }) => Promise<void>;
  initialData?: Menu | null;
  classes: Array<{ id: string; name: string }>;
  loading?: boolean;
  error?: string | null;
}

export function MenuFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  classes,
  loading = false,
  error: externalError,
}: MenuFormModalProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<MenuFormData>({
    class_id: null,
    day: new Date().toISOString().split('T')[0],
    breakfast: '',
    lunch: '',
    snack: '',
    notes: '',
    is_public: true,
  });
  const [error, setError] = useState<string | null>(null);

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          class_id: initialData.class_id || null,
          day: initialData.day,
          breakfast: initialData.breakfast || '',
          lunch: initialData.lunch || '',
          snack: initialData.snack || '',
          notes: initialData.notes || '',
          is_public: initialData.is_public !== undefined ? initialData.is_public : true,
        });
      } else {
        // Reset to defaults for new menu
        setFormData({
          class_id: null,
          day: new Date().toISOString().split('T')[0],
          breakfast: '',
          lunch: '',
          snack: '',
          notes: '',
          is_public: true,
        });
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.day) {
      setError(t.missing_fields || 'Missing required fields');
      return;
    }

    setError(null);
    
    try {
      // Ensure class_id is null if not provided
      const finalClassId = formData.class_id && formData.class_id.trim() !== '' ? formData.class_id : null;
      
      const submitData = initialData
        ? { id: initialData.id, ...formData, class_id: finalClassId }
        : { ...formData, class_id: finalClassId };
      
      await onSubmit(submitData);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to submit menu');
      }
    }
  };

  if (!isOpen) return null;

  const displayError = error || externalError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-xl rounded-ds-lg bg-white dark:bg-slate-800 p-ds-md shadow-ds-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
            {initialData ? t.edit_menu : t.add_menu || 'Add Menu'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {displayError && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-1.5">
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.date} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.day}
              onChange={(e) => setFormData({ ...formData, day: e.target.value })}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              required
            />
          </div>

          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.class_label || 'Class'} ({t.optional || 'Optional'})
            </label>
            <select
              value={formData.class_id || ''}
              onChange={(e) => setFormData({ ...formData, class_id: e.target.value || null })}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              <option value="">{t.all_classes || 'All Classes (Org-wide)'}</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.breakfast}
              </label>
              <input
                type="text"
                value={formData.breakfast || ''}
                onChange={(e) => setFormData({ ...formData, breakfast: e.target.value })}
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                placeholder={t.breakfast_placeholder}
              />
            </div>
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.lunch}
              </label>
              <input
                type="text"
                value={formData.lunch || ''}
                onChange={(e) => setFormData({ ...formData, lunch: e.target.value })}
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                placeholder={t.lunch_placeholder}
              />
            </div>
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.snack}
              </label>
              <input
                type="text"
                value={formData.snack || ''}
                onChange={(e) => setFormData({ ...formData, snack: e.target.value })}
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                placeholder={t.snack_placeholder}
              />
            </div>
          </div>

          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.notes}
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              placeholder={t.notes_placeholder}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_public"
              checked={formData.is_public !== false}
              onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
              className="rounded border-slate-300 text-mint-600 focus:ring-mint-500"
            />
            <label htmlFor="is_public" className="text-ds-small text-slate-700 dark:text-slate-300">
              {t.is_public}
            </label>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t.saving}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t.save}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

