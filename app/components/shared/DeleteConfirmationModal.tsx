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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="w-full max-w-md rounded-ds-lg bg-white dark:bg-slate-800 p-4 sm:p-ds-md shadow-ds-lg">
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <h3 className="text-ds-small sm:text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 active:bg-mint-200 dark:active:bg-slate-600 transition-colors"
            disabled={loading}
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <div className="mb-4 sm:mb-6">
          <p className="text-ds-tiny sm:text-ds-body text-slate-600 dark:text-slate-300">
            {message}
          </p>
        </div>

        {error && (
          <div className="mb-3 sm:mb-4 rounded-ds-md bg-red-50 border border-red-200 px-3 sm:px-4 py-2 sm:py-3 text-ds-tiny sm:text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto flex-1 rounded-ds-md border border-slate-300 px-3 sm:px-4 py-2 text-ds-tiny sm:text-ds-small text-slate-700 hover:bg-mint-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors active:bg-mint-100 dark:active:bg-slate-500"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full sm:w-auto flex-1 rounded-ds-md bg-red-600 px-3 sm:px-4 py-2 text-ds-tiny sm:text-ds-small text-white disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600 transition-colors active:bg-red-700 dark:active:bg-red-800"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-white border-t-transparent flex-shrink-0"></div>
                <span className="hidden sm:inline">{tLang.deleting || 'Deleting...'}</span>
                <span className="sm:hidden">Deleting...</span>
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
