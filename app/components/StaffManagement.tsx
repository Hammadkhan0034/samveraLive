'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Edit, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { CreateStaffModal } from '@/app/components/staff/CreateStaffModal';
import type { StaffFormData, StaffMember, StaffManagementProps } from '@/lib/types/staff';

const ITEMS_PER_PAGE = 20;

export default function StaffManagement(_props: StaffManagementProps) {
  const { session } = useAuth();
  const { t } = useLanguage();

  // Staff management states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteStaffModalOpen, setIsDeleteStaffModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffFormData | null>(null);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const loadingRef = useRef(false);

  const loadStaff = useCallback(async (showLoading = true) => {
    if (loadingRef.current && showLoading) return;
    try {
      if (showLoading) {
        loadingRef.current = true;
        setLoadingStaff(true);
      }
      setStaffError(null);
      const response = await fetch(`/api/staff-management`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load staff');
      setStaff(data.staff || []);
      // Reset to page 1 when new data is loaded
      setCurrentPage(1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load staff';
      setStaffError(errorMessage);
    } finally {
      if (showLoading) {
        loadingRef.current = false;
        setLoadingStaff(false);
      }
    }
  }, []);

  // Load initial lists
  useEffect(() => {
    if (session?.user?.id) {
      loadStaff();
    }
  }, [session?.user?.id, loadStaff]);

  const deleteStaffMember = useCallback(async (id: string) => {
    try {
      setIsDeletingStaff(true);
      setStaffError(null);
      const response = await fetch(`/api/staff-management?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete staff');
      setIsDeleteStaffModalOpen(false);
      setStaffToDelete(null);
      await loadStaff();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete staff';
      setStaffError(errorMessage);
    } finally {
      setIsDeletingStaff(false);
    }
  }, [loadStaff]);

  const openDeleteStaffModal = useCallback((id: string) => {
    setStaffToDelete(id);
    setIsDeleteStaffModalOpen(true);
  }, []);

  const openEditStaffModal = useCallback((staffMember: StaffMember) => {
    const staffFormData: StaffFormData = {
      id: staffMember.id,
      first_name: staffMember.first_name || '',
      last_name: staffMember.last_name || '',
      email: staffMember.email,
      phone: staffMember.phone || '',
      address: staffMember.address || '',
      ssn: staffMember.ssn || '',
      education_level: staffMember.education_level || '',
      union_membership: staffMember.union_name || '',
      role: staffMember.role || 'teacher',
      is_active: staffMember.is_active ?? true,
    };
    setEditingStaff(staffFormData);
    setIsCreateModalOpen(true);
    setStaffError(null);
  }, []);


  // Pagination logic
  const totalPages = useMemo(() => Math.max(1, Math.ceil(staff.length / ITEMS_PER_PAGE)), [staff.length]);
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return staff.slice(start, start + ITEMS_PER_PAGE);
  }, [staff, currentPage]);

  const handleOpenCreateModal = useCallback(() => {
    setEditingStaff(null);
    setIsCreateModalOpen(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingStaff(null);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setIsDeleteStaffModalOpen(false);
    setStaffToDelete(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (staffToDelete) {
      deleteStaffMember(staffToDelete);
    }
  }, [staffToDelete, deleteStaffMember]);

  // Memoized table row component
  const StaffTableRow = React.memo<{
    staffMember: StaffMember;
    onEdit: (staffMember: StaffMember) => void;
    onDelete: (id: string) => void;
    t: ReturnType<typeof useLanguage>['t'];
  }>(({ staffMember, onEdit, onDelete, t }) => {
    const handleRowClick = useCallback((e: React.MouseEvent<HTMLTableRowElement>) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'BUTTON' && !target.closest('button')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, []);

    const handleEditClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onEdit(staffMember);
    }, [staffMember, onEdit]);

    const handleDeleteClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onDelete(staffMember.id);
    }, [staffMember.id, onDelete]);

    const firstName = useMemo(() => 
      staffMember.first_name || staffMember.full_name?.split(' ')[0] || '', 
      [staffMember.first_name, staffMember.full_name]
    );
    const lastName = useMemo(() => 
      staffMember.last_name || (staffMember.full_name ? staffMember.full_name.split(' ').slice(1).join(' ') : ''), 
      [staffMember.last_name, staffMember.full_name]
    );
    const role = staffMember.role || 'teacher';
    const statusClasses = staffMember.is_active 
      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    const formattedDate = useMemo(() => 
      new Date(staffMember.created_at).toLocaleDateString(), 
      [staffMember.created_at]
    );

    return (
      <tr
        className="h-12 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors"
        onClick={handleRowClick}
      >
        <td className="py-2 pr-3 pl-3 text-slate-900 dark:text-slate-100">{firstName}</td>
        <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">{lastName}</td>
        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{staffMember.email}</td>
        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{role}</td>
        <td className="py-2 pr-3">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusClasses}`}>
            {staffMember.is_active ? t.active : t.inactive}
          </span>
        </td>
        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{formattedDate}</td>
        <td className="py-2 pr-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleEditClick}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600"
            >
              <Edit className="h-3 w-3" /> {t.edit || 'Edit'}
            </button>
            <button 
              onClick={handleDeleteClick}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border-red-300 dark:border-red-600"
            >
              <Trash2 className="h-3 w-3" /> {t.delete}
            </button>
          </div>
        </td>
      </tr>
    );
  }, (prevProps, nextProps) => {
    return (
      prevProps.staffMember.id === nextProps.staffMember.id &&
      prevProps.staffMember.first_name === nextProps.staffMember.first_name &&
      prevProps.staffMember.last_name === nextProps.staffMember.last_name &&
      prevProps.staffMember.email === nextProps.staffMember.email &&
      prevProps.staffMember.role === nextProps.staffMember.role &&
      prevProps.staffMember.is_active === nextProps.staffMember.is_active &&
      prevProps.staffMember.created_at === nextProps.staffMember.created_at &&
      prevProps.onEdit === nextProps.onEdit &&
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.t === nextProps.t
    );
  });
  StaffTableRow.displayName = 'StaffTableRow';

  return (
    <main className="mx-auto max-w-6xl px-4 pb-4 md:px-6">
      <div className="mb-ds-lg flex flex-col gap-ds-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-ds-h1 font-bold tracking-tight text-ds-text-primary dark:text-slate-100">
            {t.staff_management}
          </h2>
          <p className="mt-2 text-ds-small text-ds-text-muted dark:text-slate-400">{t.manage_staff}</p>
        </div>
        <div className="flex flex-wrap gap-ds-sm">
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 px-ds-sm py-2 text-ds-small text-white hover:bg-mint-600 transition-colors"
          >
            <Users className="h-4 w-4" /> {t.create_staff}
          </button>
        </div>
      </div>

      {staffError && (
        <div className="mb-ds-md rounded-ds-md bg-red-50 border border-red-200 px-ds-md py-ds-sm text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {staffError}
        </div>
      )}

      {/* Active Staff Table */}
      <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
        <h4 className="mb-ds-sm text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100">
          {t.active_staff_members}
        </h4>
        {loadingStaff ? (
          <LoadingSkeleton type="table" rows={5} />
        ) : staff.length === 0 ? (
          <div className="py-8 text-center text-ds-small text-slate-500 dark:text-slate-400">
            {t.no_staff_members || 'No staff members found'}
          </div>
        ) : (
          <div className="rounded-t-ds-md overflow-hidden border border-slate-200 dark:border-slate-700">
            <table className="w-full text-ds-small">
              <thead className="sticky top-0 bg-mint-500 text-white z-10">
                <tr className="text-left">
                  <th className="py-2 pr-3 pl-3 text-white rounded-tl-ds-md">{t.first_name || 'First Name'}</th>
                  <th className="py-2 pr-3 text-white">{t.last_name || 'Last Name'}</th>
                  <th className="py-2 pr-3 text-white">{t.email}</th>
                  <th className="py-2 pr-3 text-white">{t.staff_role || 'Role'}</th>
                  <th className="py-2 pr-3 text-white">{t.status}</th>
                  <th className="py-2 pr-3 text-white">{t.joined}</th>
                  <th className="py-2 pr-3 text-white rounded-tr-ds-md">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                {paginatedStaff.map((s) => (
                  <StaffTableRow
                    key={s.id}
                    staffMember={s}
                    onEdit={openEditStaffModal}
                    onDelete={openDeleteStaffModal}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination controls */}
        {staff.length > 0 && totalPages > 1 && (
          <div className="mt-4 w-full flex justify-end gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              {t.prev || 'Prev'}
            </button>
            {Array.from({ length: totalPages }, (_, idx) => {
              const pageNum = idx + 1;
              const isActive = currentPage === pageNum;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`inline-flex items-center rounded-ds-md px-3 py-1.5 text-ds-small transition-colors ${
                    isActive
                      ? 'bg-mint-500 text-white border border-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                      : 'border border-slate-400 dark:border-slate-600 dark:text-slate-200 hover:bg-mint-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              {t.next || 'Next'}
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Staff Modal */}
      <CreateStaffModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={loadStaff}
        initialData={editingStaff || undefined}
      />

      {/* Delete Staff Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteStaffModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        title={t.remove_staff_member}
        message={t.remove_staff_confirm}
        loading={isDeletingStaff}
        error={staffError}
        confirmButtonText={t.remove}
        cancelButtonText={t.cancel}
      />
    </main>
  );
}
