'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
  error?: string | null;
  confirmButtonText?: string;
  cancelButtonText?: string;
  translations?: {
    confirm_delete?: string;
    cancel?: string;
  };
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading = false,
  error,
  confirmButtonText,
  cancelButtonText,
  translations
}: DeleteConfirmationModalProps) {
  const { t: tLang } = useLanguage();
  if (!isOpen) return null;

  const t = translations || {};
  const confirmText = confirmButtonText || t.confirm_delete || tLang.delete || 'Delete';
  const cancelText = cancelButtonText || t.cancel || tLang.cancel || 'Cancel';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-slate-600 dark:text-slate-300">
            {message}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-700"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                {tLang.deleting || 'Deleting...'}
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
