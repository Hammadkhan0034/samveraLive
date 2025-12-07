'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Suspense } from 'react';
import { Plus, Edit, Trash2, Building } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import AdminPageLayout, { useAdminPageLayout } from '@/app/components/shared/AdminPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { OrganizationModal } from '@/app/components/admin/modals/OrganizationModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import EmptyState from '@/app/components/EmptyState';
import { AdminDashboardSkeleton } from '@/app/components/admin/AdminDashboardSkeleton';

interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  created_at?: string;
  updated_at?: string;
}

interface PaginatedResponse {
  orgs: Organization[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

function OrganizationsPageContent() {
  const { t } = useLanguage();
  const { sidebarRef } = useAdminPageLayout();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<Organization | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load organizations with pagination
  const loadOrganizations = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/orgs?page=${page}&limit=${pageSize}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `Failed with ${res.status}`);
      }

      const data: PaginatedResponse = json;
      setOrgs(data.orgs || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.currentPage || 1);
    } catch (e: any) {
      console.error('❌ Error loading organizations:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on mount and when page changes
  useEffect(() => {
    loadOrganizations(currentPage);
  }, [currentPage, loadOrganizations]);

  // Handlers
  const handleCreate = () => {
    setEditingOrg(undefined);
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setOrgToDelete(id);
    setSubmitError(null);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (data: Organization) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const method = data.id ? 'PUT' : 'POST';
      const res = await fetch('/api/orgs', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || `Failed with ${res.status}`);
      }

      // Close modal and refresh data
      setIsModalOpen(false);
      setEditingOrg(undefined);
      await loadOrganizations(currentPage);
    } catch (e: any) {
      console.error('❌ Error submitting organization:', e.message);
      setSubmitError(e.message);
      throw e; // Re-throw so modal can handle it
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!orgToDelete) return;
    try {
      setIsDeleting(true);
      setSubmitError(null);

      const res = await fetch(`/api/orgs?id=${encodeURIComponent(orgToDelete)}`, { 
        method: 'DELETE' 
      });
      const json = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(json.error || `Failed with ${res.status}`);
      }

      // Close modal and refresh data
      setIsDeleteModalOpen(false);
      setOrgToDelete(null);
      
      // If we deleted the last item on the page and it's not page 1, go to previous page
      if (orgs.length === 1 && currentPage > 1) {
        await loadOrganizations(currentPage - 1);
        setCurrentPage(currentPage - 1);
      } else {
        await loadOrganizations(currentPage);
      }
    } catch (e: any) {
      console.error('❌ Error deleting organization:', e.message);
      setSubmitError(e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Pagination handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <>
      {/* Content Header */}
      <PageHeader
        title={t.organizations || 'Organizations'}
        subtitle={t.manageOrganizations || 'Manage all organizations in the system'}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
        rightActions={
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 text-white px-3 sm:px-4 py-2 text-ds-small transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t.create || 'Create'}
          </button>
        }
      />

      {/* Error State */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-ds-md">
          <p className="text-ds-small text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="bg-white dark:bg-slate-800 rounded-ds-lg shadow-ds-card flex flex-col min-h-[calc(100vh-300px)]">
        {loading ? (
          <div className="p-6">
            <div className="text-center text-ds-small text-slate-500 dark:text-slate-400">
              Loading organizations...
            </div>
          </div>
        ) : orgs.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Building}
              title={t.noOrganizations || 'No organizations found'}
              description={t.createFirstOrganization || 'Get started by creating your first organization'}
            />
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 text-white px-4 py-2 text-ds-small transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t.createOrganization || 'Create Organization'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              <table className="w-full text-ds-tiny sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                  <tr className="text-left text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4 font-semibold bg-slate-50 dark:bg-slate-900/50">{t.table_name || 'Name'}</th>
                    <th className="py-3 px-4 font-semibold hidden md:table-cell bg-slate-50 dark:bg-slate-900/50">{t.table_slug || 'Slug'}</th>
                    <th className="py-3 px-4 font-semibold hidden lg:table-cell bg-slate-50 dark:bg-slate-900/50">{t.table_timezone || 'Timezone'}</th>
                    <th className="py-3 px-4 font-semibold bg-slate-50 dark:bg-slate-900/50">{t.table_actions || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {orgs.map((org) => (
                    <tr 
                      key={org.id} 
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 dark:text-slate-100"
                    >
                      <td className="py-3 px-4 text-ds-small sm:text-ds-body">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{org.name}</div>
                      </td>
                      <td className="py-3 px-4 text-ds-small sm:text-ds-body hidden md:table-cell text-slate-600 dark:text-slate-400">
                        {org.slug}
                      </td>
                      <td className="py-3 px-4 text-ds-small sm:text-ds-body hidden lg:table-cell text-slate-600 dark:text-slate-400">
                        {org.timezone}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(org)}
                            className="inline-flex items-center gap-1 rounded-ds-md border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-ds-tiny sm:text-ds-small hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors"
                            aria-label={t.edit || 'Edit'}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{t.edit || 'Edit'}</span>
                          </button>
                          <button
                            onClick={() => handleDelete(org.id)}
                            className="inline-flex items-center gap-1 rounded-ds-md border border-red-300 dark:border-red-700 px-2 py-1.5 text-ds-tiny sm:text-ds-small text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            aria-label={t.delete || 'Delete'}
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

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-center sm:justify-end gap-2 bg-white dark:bg-slate-800">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="inline-flex items-center rounded-ds-md border border-input-stroke bg-input-fill px-2 sm:px-3 py-1.5 text-ds-small text-ds-text-primary disabled:opacity-60 disabled:cursor-not-allowed hover:bg-mint-50 hover:border-mint-200 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {t.prev || 'Prev'}
                </button>
                <div className="flex gap-ds-xs flex-wrap justify-center">
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageClick(page)}
                      className={`inline-flex items-center rounded-ds-md px-2 sm:px-3 py-1.5 text-ds-small transition-colors ${
                        currentPage === page
                          ? 'bg-mint-500 text-white border border-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                          : 'border border-input-stroke bg-input-fill text-ds-text-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 hover:bg-mint-50 hover:border-mint-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
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
          </>
        )}
      </div>

      {/* Modals */}
      <OrganizationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingOrg(undefined);
          setSubmitError(null);
        }}
        onSubmit={handleSubmit}
        initialData={editingOrg}
        loading={isSubmitting}
        error={submitError}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setOrgToDelete(null);
          setSubmitError(null);
        }}
        onConfirm={handleConfirmDelete}
        title={t.delete_organization_title || 'Delete Organization'}
        message={t.delete_organization_message || 'Are you sure you want to delete this organization? This action cannot be undone.'}
        loading={isDeleting}
        error={submitError}
        confirmButtonText={t.confirm_delete || 'Delete'}
        cancelButtonText={t.cancel_delete || 'Cancel'}
      />
    </>
  );
}

export default function OrganizationsPage() {
  return (
    <Suspense fallback={
      <AdminPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <AdminDashboardSkeleton />
        </div>
      </AdminPageLayout>
    }>
      <AdminPageLayout>
        <OrganizationsPageContent />
      </AdminPageLayout>
    </Suspense>
  );
}
