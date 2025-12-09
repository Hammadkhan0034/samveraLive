'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';

import { useLanguage } from '@/lib/contexts/LanguageContext';
import { GuardianTable } from '@/app/components/shared/GuardianTable';
import {
  GuardianForm,
  type GuardianFormData,
} from '@/app/components/shared/GuardianForm';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';

export interface GuardiansClientProps {
  /**
   * When true, allow full CRUD (create/edit/delete).
   * When false, render as read-only (no mutations or action buttons).
   */
  canManage?: boolean;
  /**
   * Optional ref to expose the create guardian function to parent components.
   */
  onCreateClickRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Parse guardian name from various formats
 * Handles both first_name/last_name and full_name formats
 */
function parseGuardianName(guardian: any): { first_name: string; last_name: string } {
  if (guardian.first_name || guardian.last_name) {
    return {
      first_name: guardian.first_name ?? '',
      last_name: guardian.last_name ?? '',
    };
  }

  const fullName = (guardian.full_name || '').trim();
  if (!fullName) {
    return { first_name: '', last_name: '' };
  }

  const parts = fullName.split(/\s+/);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' ') || '',
  };
}

export function GuardiansClient({ canManage = false, onCreateClickRef }: GuardiansClientProps) {
  const { t } = useLanguage();

  // Guardian state
  const [guardians, setGuardians] = useState<Array<any>>([]);
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [isDeleteGuardianModalOpen, setIsDeleteGuardianModalOpen] = useState(false);
  const [guardianToDelete, setGuardianToDelete] = useState<string | null>(null);
  const [deletingGuardian, setDeletingGuardian] = useState(false);
  const [submittingGuardian, setSubmittingGuardian] = useState(false);
  const [guardianForm, setGuardianForm] = useState<GuardianFormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    is_active: true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const loadGuardians = useCallback(async () => {
    try {
      setLoadingGuardians(true);
      setGuardianError(null);
      const res = await fetch(`/api/guardians?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setGuardians(json.guardians || []);
    } catch (e: any) {
      console.error('❌ Error loading guardians:', e.message);
      setGuardianError(e.message);
    } finally {
      setLoadingGuardians(false);
    }
  }, []);

  // Load guardians
  useEffect(() => {
    void loadGuardians();
  }, [loadGuardians]);

  async function submitGuardian(data: GuardianFormData) {
    if (!canManage) return;
    try {
      setGuardianError(null);
      setSubmittingGuardian(true);
      const res = await fetch('/api/guardians', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsGuardianModalOpen(false);
      setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', is_active: true });
      await loadGuardians();
    } catch (e: any) {
      console.error('❌ Error submitting guardian:', e.message);
      setGuardianError(e.message);
    } finally {
      setSubmittingGuardian(false);
    }
  }

  const openCreateGuardianModal = useCallback(() => {
    if (!canManage) return;
    setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', is_active: true });
    setIsGuardianModalOpen(true);
  }, [canManage]);

  // Expose the create function to parent via ref
  useEffect(() => {
    if (onCreateClickRef && canManage) {
      onCreateClickRef.current = openCreateGuardianModal;
    }
    return () => {
      if (onCreateClickRef) {
        onCreateClickRef.current = null;
      }
    };
  }, [onCreateClickRef, canManage, openCreateGuardianModal]);

  function openEditGuardianModal(guardian: any) {
    if (!canManage) return;
    const { first_name, last_name } = parseGuardianName(guardian);
    setGuardianForm({
      id: guardian.id,
      first_name,
      last_name,
      email: guardian.email ?? '',
      phone: guardian.phone ?? '',
      is_active: guardian.is_active ?? true,
    });
    setIsGuardianModalOpen(true);
  }

  function openDeleteGuardianModal(id: string) {
    if (!canManage) return;
    setGuardianToDelete(id);
    setIsDeleteGuardianModalOpen(true);
  }

  async function confirmDeleteGuardian() {
    if (!guardianToDelete || !canManage) return;
    try {
      setGuardianError(null);
      setDeletingGuardian(true);
      const res = await fetch(`/api/guardians?id=${encodeURIComponent(guardianToDelete)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsDeleteGuardianModalOpen(false);
      setGuardianToDelete(null);
      await loadGuardians();
    } catch (e: any) {
      setGuardianError(e.message);
    } finally {
      setDeletingGuardian(false);
    }
  }

  const filteredGuardians = useMemo(() => {
    if (!searchQuery) return guardians;
    const q = searchQuery.trim().toLowerCase();
    return guardians.filter((g: any) => {
      const { first_name, last_name } = parseGuardianName(g);
      const first = first_name.toLowerCase();
      const last = last_name.toLowerCase();
      const email = (g.email || '').toLowerCase();
      return (
        first.includes(q) ||
        last.includes(q) ||
        `${first} ${last}`.includes(q) ||
        email.includes(q)
      );
    });
  }, [guardians, searchQuery]);

  const paginatedGuardians = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredGuardians.slice(start, end).map((g: any) => {
      const { first_name, last_name } = parseGuardianName(g);
      return {
        id: g.id,
        first_name,
        last_name,
        email: g.email ?? null,
        phone: g.phone ?? null,
        is_active: g.is_active ?? true,
      };
    });
  }, [filteredGuardians, currentPage, itemsPerPage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredGuardians.length / itemsPerPage)),
    [filteredGuardians.length, itemsPerPage],
  );

  const tableTranslations = useMemo(
    () => ({
      guardians: t.tile_guardians || 'Guardians',
      first_name: t.first_name || 'First Name',
      last_name: t.last_name || 'Last Name',
      email: t.email || 'Email',
      phone: t.phone || 'Phone',
      status: t.status || 'Status',
      active: t.active || 'Active',
      inactive: t.inactive || 'Inactive',
      actions: t.col_actions || 'Actions',
      create: t.create || 'Create',
      no_guardians: t.no_guardians || 'No guardians',
      no_guardians_title: t.no_guardians_title || 'No Guardians',
      no_guardians_description: t.no_guardians_description || 'No guardians found. Click \'Add Guardian\' to create one.',
      no_guardians_loading: t.no_guardians_loading || 'Loading...',
      edit: t.edit || 'Edit',
      delete: t.delete || 'Delete',
      send_magic_link: t.send_magic_link || 'Send Magic Link',
      sending: t.sending || 'Sending...',
      magic_link_sent: t.magic_link_sent || 'Magic link sent',
      magic_link_send_failed: t.magic_link_send_failed || 'Failed to send magic link',
      no_students_linked: t.no_students_linked || 'No students linked',
    }),
    [t],
  );

  const formTranslations = useMemo(
    () => ({
      create_guardian: t.create_guardian || 'Create Guardian',
      edit_guardian: t.edit_guardian || 'Edit Guardian',
      first_name: t.first_name || 'First Name',
      last_name: t.last_name || 'Last Name',
      email: t.email || 'Email',
      phone: t.phone || 'Phone',
      organization: t.organization || 'Organization',
      status: t.status || 'Status',
      active: t.active || 'Active',
      inactive: t.inactive || 'Inactive',
      create: t.create || 'Create',
      update: t.update || 'Update',
      cancel: t.cancel || 'Cancel',
      creating: t.creating || 'Creating...',
      updating: t.updating || 'Updating...',
      first_name_placeholder: t.first_name_placeholder || 'Enter first name',
      last_name_placeholder: t.last_name_placeholder || 'Enter last name',
      email_placeholder: t.email_placeholder || 'Enter email address',
      phone_placeholder: t.phone_placeholder || 'Enter phone number',
      status_placeholder: t.status_placeholder || 'Select status',
      ssn: t.ssn || 'Social Security Number (SSN)',
      ssn_placeholder: t.ssn_placeholder || '000000-0000',
      address: t.address || 'Address',
      address_placeholder: t.address_placeholder || 'Enter address (optional)',
    }),
    [t],
  );

  const deleteModalTranslations = useMemo(
    () => ({
      confirm_delete: t.delete || 'Delete',
      cancel: t.cancel || 'Cancel',
    }),
    [t],
  );

  const showManagementControls = canManage;

  return (
    <>
      {/* Guardians Table */}
      <div className="rounded-ds-lg bg-white p-3 sm:p-ds-md shadow-ds-card dark:bg-slate-800">
        <div className="flex items-center justify-between mb-ds-sm gap-ds-sm sm:gap-ds-md">
          <div className="relative flex-1 sm:flex-initial sm:w-auto min-w-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t.search_guardians_placeholder || 'Search guardians...'}
              className="w-full sm:w-48 md:w-64 h-10 sm:h-12 px-ds-sm rounded-ds-md rounded-full bg-input-fill border border-input-stroke text-ds-small text-ds-text-primary focus:outline-none focus:border-mint-200 focus:ring-2 focus:ring-mint-200/20 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-mint-300"
            />
          </div>
        </div>
        {loadingGuardians ? (
          <LoadingSkeleton type="table" rows={5} />
        ) : (
          <GuardianTable
            guardians={paginatedGuardians}
            error={guardianError}
            onEdit={showManagementControls ? openEditGuardianModal : () => {}}
            onDelete={showManagementControls ? openDeleteGuardianModal : () => {}}
            onCreate={showManagementControls ? openCreateGuardianModal : () => {}}
            translations={tableTranslations}
          />
        )}
        {/* Pagination controls */}
        {filteredGuardians.length > itemsPerPage && (
          <div className="mt-ds-sm w-full flex flex-wrap justify-center sm:justify-end gap-ds-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center rounded-ds-md border border-input-stroke bg-input-fill px-2 sm:px-3 py-1.5 text-ds-small text-ds-text-primary disabled:opacity-60 disabled:cursor-not-allowed hover:bg-mint-50 hover:border-mint-200 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t.prev || 'Prev'}
            </button>
            <div className="flex gap-ds-xs flex-wrap justify-center">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`inline-flex items-center rounded-ds-md px-2 sm:px-3 py-1.5 text-ds-small transition-colors ${currentPage === idx + 1 ? 'bg-mint-500 text-white border border-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600' : 'border border-input-stroke bg-input-fill text-ds-text-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 hover:bg-mint-50 hover:border-mint-200 dark:hover:bg-slate-800'}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center rounded-ds-md border border-input-stroke bg-input-fill px-2 sm:px-3 py-1.5 text-ds-small text-ds-text-primary disabled:opacity-60 disabled:cursor-not-allowed hover:bg-mint-50 hover:border-mint-200 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t.next || 'Next'}
            </button>
          </div>
        )}

        {showManagementControls && (
          <>
            <GuardianForm
              isOpen={isGuardianModalOpen}
              onClose={() => setIsGuardianModalOpen(false)}
              onSubmit={submitGuardian}
              initialData={guardianForm}
              loading={submittingGuardian}
              error={guardianError}
              translations={formTranslations}
            />
            <DeleteConfirmationModal
              isOpen={isDeleteGuardianModalOpen}
              onClose={() => setIsDeleteGuardianModalOpen(false)}
              onConfirm={confirmDeleteGuardian}
              title={t.delete_guardian || 'Delete Guardian'}
              message={t.delete_guardian_confirm || 'Are you sure you want to delete this guardian?'}
              loading={deletingGuardian}
              error={guardianError}
              translations={deleteModalTranslations}
            />
          </>
        )}
      </div>
    </>
  );
}


