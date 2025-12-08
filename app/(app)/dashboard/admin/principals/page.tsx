'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Plus, Edit, Trash2, Shield } from 'lucide-react';
import { PrincipalModal } from '@/app/components/admin/modals/PrincipalModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { PageHeader } from '@/app/components/shared/PageHeader';
import EmptyState from '@/app/components/EmptyState';
import Loading from '@/app/components/shared/Loading';
import type { Principal, PaginatedPrincipalsResponse } from '@/lib/types/principals';
import type { Organization } from '@/lib/types/orgs';

const ITEMS_PER_PAGE = 20;

function PrincipalsPageContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingPrincipal, setEditingPrincipal] = useState<Principal | undefined>(undefined);
  const [principalToDelete, setPrincipalToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load organizations for modal
  const loadOrganizations = useCallback(async () => {
    try {
      setLoadingOrgs(true);
      const res = await fetch('/api/orgs', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed with ${res.status}`);
      }
      setOrganizations(json.orgs || []);
    } catch (e: any) {
      console.error('❌ Error loading organizations:', e.message);
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  // Load principals with pagination
  const loadPrincipals = useCallback(async (page: number, showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const res = await fetch(`/api/principals?page=${page}&pageSize=${ITEMS_PER_PAGE}`, { cache: 'no-store' });
      const json: PaginatedPrincipalsResponse | { error?: string } = await res.json();

      if (!res.ok) {
        throw new Error((json as { error?: string }).error || `Failed with ${res.status}`);
      }

      const data = json as PaginatedPrincipalsResponse;
      setPrincipals(data.principals || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.currentPage || 1);
    } catch (e: any) {
      console.error('❌ Error loading principals:', e.message);
      setError(e.message);
      setPrincipals([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  // Load organizations on mount
  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  // Load on mount and when page changes
  useEffect(() => {
    loadPrincipals(currentPage);
  }, [currentPage, loadPrincipals]);

  // Get organization name by ID
  const getOrgName = useCallback((orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    return org?.name || orgId;
  }, [organizations]);

  // Get principal display name
  const getPrincipalName = useCallback((principal: Principal) => {
    if (principal.full_name) return principal.full_name;
    if (principal.name) return principal.name;
    const parts = [principal.first_name, principal.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unknown Principal';
  }, []);

  // Handle create
  const handleCreate = useCallback(() => {
    setEditingPrincipal(undefined);
    setIsModalOpen(true);
    setError(null);
  }, []);

  // Handle edit
  const handleEdit = useCallback((principal: Principal) => {
    setEditingPrincipal(principal);
    setIsModalOpen(true);
    setError(null);
  }, []);

  // Handle delete click
  const handleDelete = useCallback((id: string) => {
    setPrincipalToDelete(id);
    setIsDeleteModalOpen(true);
    setError(null);
  }, []);

  // Handle submit (create or update)
  const handleSubmit = useCallback(async (data: {
    id?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    org_id: string;
    is_active?: boolean;
  }) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const method = data.id ? 'PUT' : 'POST';
      const res = await fetch('/api/principals', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      // Close modal and refresh data
      setIsModalOpen(false);
      setEditingPrincipal(undefined);
      // Reset to page 1 after create/update
      setCurrentPage(1);
      await loadPrincipals(1, false);
    } catch (e: any) {
      console.error('❌ Error submitting principal:', e.message);
      setError(e.message);
      throw e; // Re-throw so modal can handle it
    } finally {
      setIsSubmitting(false);
    }
  }, [loadPrincipals]);

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(async () => {
    if (!principalToDelete) return;
    try {
      setIsDeleting(true);
      setError(null);

      const res = await fetch(`/api/principals?id=${encodeURIComponent(principalToDelete)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      // Close modal and refresh data
      setIsDeleteModalOpen(false);
      setPrincipalToDelete(null);
      // If we deleted the last item on the page and it's not page 1, go to previous page
      if (principals.length === 1 && currentPage > 1) {
        const newPage = currentPage - 1;
        setCurrentPage(newPage);
        await loadPrincipals(newPage, false);
      } else {
        await loadPrincipals(currentPage, false);
      }
    } catch (e: any) {
      console.error('❌ Error deleting principal:', e.message);
      setError(e.message);
    } finally {
      setIsDeleting(false);
    }
  }, [principalToDelete, principals.length, currentPage, loadPrincipals]);

  // Pagination handlers
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages]);

  const handlePageClick = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Format date for display
  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  }, []);

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500 mt-4 sm:mt-6 lg:mt-10 px-3 sm:px-4">
      <PageHeader
        title={t.principals || 'Principals'}
        subtitle={t.manage_principals || 'View, create, update, and delete principals'}
        headingLevel="h1"
        showBackButton={true}
        backHref="/dashboard/admin"
        rightActions={
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 px-ds-sm py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Plus className="h-4 w-4" /> {t.create || 'Create'}
          </button>
        }
      />

      {/* Error Display */}
      {error && (
        <div className="mb-ds-sm rounded-ds-md border border-red-200 bg-red-50 p-ds-sm dark:border-red-800 dark:bg-red-900/20">
          <p className="text-ds-small text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Principals Table */}
      <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800 flex flex-col" style={{ minHeight: 'calc(100vh - 300px)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-mint-500 border-r-transparent"></div>
              <p className="mt-4 text-ds-small text-slate-600 dark:text-slate-400">{t.loading_principals || 'Loading principals...'}</p>
            </div>
          </div>
        ) : principals.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={Shield}
              title={t.no_principals || 'No principals found'}
              description={t.no_principals_description || 'Get started by creating your first principal.'}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-ds-small">
                <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                      {t.table_name || 'Name'}
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-slate-700 dark:text-slate-300 hidden md:table-cell">
                      Email
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-slate-700 dark:text-slate-300 hidden lg:table-cell">
                      Phone
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-slate-700 dark:text-slate-300 hidden lg:table-cell">
                      Organization
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-slate-700 dark:text-slate-300 hidden md:table-cell">
                      Status
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-slate-700 dark:text-slate-300 hidden xl:table-cell">
                      {t.created_at || 'Created At'}
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                      {t.actions || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {principals.map((principal) => (
                    <tr
                      key={principal.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3 px-3 text-slate-900 dark:text-slate-100 font-medium">
                        <button
                          onClick={() => router.push(`/dashboard/admin/principals/${principal.id}`)}
                          className="text-mint-600 dark:text-mint-400 hover:text-mint-700 dark:hover:text-mint-300 hover:underline transition-colors text-left"
                        >
                          {getPrincipalName(principal)}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 hidden md:table-cell">
                        {principal.email || '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                        {principal.phone || '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                        {getOrgName(principal.org_id)}
                      </td>
                      <td className="py-3 px-3 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-ds-tiny font-medium ${
                          principal.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            principal.is_active ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          {principal.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 hidden xl:table-cell">
                        {formatDate(principal.created_at)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(principal)}
                            className="inline-flex items-center gap-1 rounded-ds-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-ds-tiny hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-300"
                            aria-label={`Edit ${getPrincipalName(principal)}`}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{t.edit || 'Edit'}</span>
                          </button>
                          <button
                            onClick={() => handleDelete(principal.id)}
                            className="inline-flex items-center gap-1 rounded-ds-md border border-red-300 dark:border-red-700 px-2 py-1.5 text-ds-tiny hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                            aria-label={`Delete ${getPrincipalName(principal)}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{t.delete || 'Delete'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-ds-sm pt-ds-sm border-t border-slate-200 dark:border-slate-700 w-full flex flex-wrap justify-center sm:justify-end gap-ds-xs">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="inline-flex items-center rounded-ds-md border border-input-stroke bg-input-fill px-2 sm:px-3 py-1.5 text-ds-small text-ds-text-primary disabled:opacity-60 disabled:cursor-not-allowed hover:bg-mint-50 hover:border-mint-200 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {t.prev || 'Prev'}
                </button>
                <div className="flex gap-ds-xs flex-wrap justify-center">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    // Show first page, last page, current page, and pages around current
                    const showPage =
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1);
                    
                    if (!showPage) {
                      // Show ellipsis
                      if (idx === 1 || idx === totalPages - 2) {
                        return (
                          <span key={idx} className="px-2 py-1.5 text-ds-small text-slate-500 dark:text-slate-400">
                            ...
                          </span>
                        );
                      }
                      return null;
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handlePageClick(pageNum)}
                        className={`inline-flex items-center rounded-ds-md px-2 sm:px-3 py-1.5 text-ds-small transition-colors ${
                          currentPage === pageNum
                            ? 'bg-mint-500 text-white border border-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                            : 'border border-input-stroke bg-input-fill text-ds-text-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 hover:bg-mint-50 hover:border-mint-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center rounded-ds-md border border-input-stroke bg-input-fill px-2 sm:px-3 py-1.5 text-ds-small text-ds-text-primary disabled:opacity-60 disabled:cursor-not-allowed hover:bg-mint-50 hover:border-mint-200 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {t.next || 'Next'}
                </button>
              </div>
            )}

            {/* Results count */}
            <div className="mt-ds-sm pt-ds-sm border-t border-slate-200 dark:border-slate-700 text-ds-tiny text-slate-600 dark:text-slate-400 text-center sm:text-right">
              {(t.showing_principals_count || 'Showing {start} - {end} of {total} principals')
                .replace('{start}', String(principals.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0))
                .replace('{end}', String(Math.min(currentPage * ITEMS_PER_PAGE, totalCount)))
                .replace('{total}', String(totalCount))}
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <PrincipalModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPrincipal(undefined);
          setError(null);
        }}
        onSubmit={handleSubmit}
        initialData={editingPrincipal ? {
          id: editingPrincipal.id,
          org_id: editingPrincipal.org_id,
          first_name: editingPrincipal.first_name ?? undefined,
          last_name: editingPrincipal.last_name ?? undefined,
          email: editingPrincipal.email ?? undefined,
          phone: editingPrincipal.phone ?? undefined,
          full_name: editingPrincipal.full_name ?? undefined,
          is_active: editingPrincipal.is_active,
        } : undefined}
        organizations={organizations}
        loading={isSubmitting}
        error={error}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setPrincipalToDelete(null);
          setError(null);
        }}
        onConfirm={handleConfirmDelete}
        title={t.delete_principal_title || 'Delete Principal'}
        message={t.delete_principal_message || 'Are you sure you want to delete this principal? This action cannot be undone.'}
        loading={isDeleting}
        error={error}
        confirmButtonText={t.confirm_delete || 'Delete'}
        cancelButtonText={t.cancel || 'Cancel'}
      />
    </div>
  );
}

export default function PrincipalsPage() {
  const { user, loading, isSigningIn } = useRequireAuth('admin');
  const { t } = useLanguage();

  // Show loading ONLY if we have no user yet (avoid flicker after sign-in)
  if (loading && !user) {
    return <Loading fullScreen text={t.loading_principals || 'Loading principals...'} />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-mint-100 dark:bg-slate-950">
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-ds-lg">
        <PrincipalsPageContent />
      </main>
    </div>
  );
}
