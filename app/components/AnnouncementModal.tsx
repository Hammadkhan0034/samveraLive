'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import AnnouncementForm from './AnnouncementForm';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialData?: {
    id: string;
    title: string;
    body: string;
    classId?: string;
  };
  orgId?: string;
  classId?: string;
  lang?: 'is' | 'en';
  showClassSelector?: boolean;
}

export function AnnouncementModal({
  isOpen,
  onClose,
  mode,
  initialData,
  orgId,
  classId,
  lang = 'en',
  showClassSelector = false,
}: AnnouncementModalProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSuccess = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        // Close on outside click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl rounded-ds-lg bg-white dark:bg-slate-800 p-ds-md shadow-ds-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
            {mode === 'edit' ? (lang === 'is' ? 'Breyta tilkynningu' : 'Edit Announcement') : (lang === 'is' ? 'Búa til tilkynningu' : 'Create Announcement')}
          </h3>
          <button
            onClick={onClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {orgId && (
          <AnnouncementForm
            mode={mode}
            initialData={initialData}
            orgId={orgId}
            classId={classId}
            onSuccess={handleSuccess}
            showClassSelector={showClassSelector}
          />
        )}
      </div>
    </div>
  );
}

