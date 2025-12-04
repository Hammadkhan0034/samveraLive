'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Edit, Trash2, Users, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useUserRole } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { CreateStaffModal } from '@/app/components/staff/CreateStaffModal';
import { StaffStatusChangeModal } from '@/app/components/staff/StaffStatusChangeModal';
import type { StaffFormData, StaffMember, StaffManagementProps, StaffStatusType } from '@/lib/types/staff';
import { PageHeader } from './shared/PageHeader';
import { usePrincipalPageLayout } from './shared/PrincipalPageLayout';

const ITEMS_PER_PAGE = 20;

export default function StaffManagement(_props: StaffManagementProps) {
  const { session } = useAuth();
  const userRole = useUserRole();
  const { t } = useLanguage();
  const isPrincipal = userRole === 'principal';

  // Staff management states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteStaffModalOpen, setIsDeleteStaffModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffFormData | null>(null);
  
  // Status change states
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusChangeStaffId, setStatusChangeStaffId] = useState<string | null>(null);
  const [statusChangeType, setStatusChangeType] = useState<StaffStatusType | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);
  const { sidebarRef } = usePrincipalPageLayout();

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

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('.status-dropdown')) {
          setStatusDropdownOpen(null);
        }
      }
    };

    if (statusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [statusDropdownOpen]);

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

  // Status change handlers
  const handleOpenStatusModal = useCallback((staffId: string, status: StaffStatusType) => {
    setStatusChangeStaffId(staffId);
    setStatusChangeType(status);
    setIsStatusModalOpen(true);
    setStatusDropdownOpen(null);
  }, []);

  const handleCloseStatusModal = useCallback(() => {
    setIsStatusModalOpen(false);
    setStatusChangeStaffId(null);
    setStatusChangeType(null);
  }, []);

  const handleStatusChangeSuccess = useCallback(() => {
    loadStaff();
    handleCloseStatusModal();
  }, [loadStaff, handleCloseStatusModal]);


  // Memoized table row component
  const StaffTableRow = React.memo<{
    staffMember: StaffMember;
    onEdit: (staffMember: StaffMember) => void;
    onDelete: (id: string) => void;
    onStatusChange?: (staffId: string, status: StaffStatusType) => void;
    isPrincipal: boolean;
    statusDropdownOpen: string | null;
    setStatusDropdownOpen: (id: string | null) => void;
    t: ReturnType<typeof useLanguage>['t'];
  }>(({ staffMember, onEdit, onDelete, onStatusChange, isPrincipal, statusDropdownOpen, setStatusDropdownOpen, t }) => {
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
    
    // Get status display based on current_status
    const statusDisplay = useMemo(() => {
      const status = staffMember.current_status;
      if (!status) {
        return staffMember.is_active ? t.active : t.inactive;
      }
      const statusLabels: Record<StaffStatusType, string> = {
        active: t.active || 'Active',
        inactive: t.inactive || 'Inactive',
        holiday: t.on_holiday || 'On Holiday',
        sick_leave: t.on_sick_leave || 'On Sick Leave',
        maternity_leave: t.on_maternity_leave || 'On Maternity Leave',
        casual_leave: t.on_casual_leave || 'On Casual Leave',
      };
      return statusLabels[status] || t.active;
    }, [staffMember.current_status, staffMember.is_active, t]);
    const statusClasses = useMemo(() => {
      const status = staffMember.current_status;
      if (status === 'holiday' || status === 'sick_leave' || status === 'maternity_leave' || status === 'casual_leave') {
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300';
      }
      if (status === 'active' || !status && staffMember.is_active) {
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300';
      }
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }, [staffMember.current_status, staffMember.is_active]);
    
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
            {statusDisplay}
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
            {isPrincipal && onStatusChange && (
              <div className="relative status-dropdown">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatusDropdownOpen(statusDropdownOpen === staffMember.id ? null : staffMember.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600"
                >
                  {t.status || 'Status'} <ChevronDown className={`h-3 w-3 transition-transform ${statusDropdownOpen === staffMember.id ? 'rotate-180' : ''}`} />
                </button>
                {statusDropdownOpen === staffMember.id && (
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-ds-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-ds-md z-50">
                    <div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusDropdownOpen(null);
                          onStatusChange(staffMember.id, 'holiday');
                        }}
                        className="w-full px-3 py-2 text-left text-ds-small text-slate-700 dark:text-slate-300 hover:bg-mint-50 dark:hover:bg-slate-700"
                      >
                        {t.mark_as_inactive || 'Mark as Inactive'} → {t.on_holiday || 'Holiday'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusDropdownOpen(null);
                          onStatusChange(staffMember.id, 'sick_leave');
                        }}
                        className="w-full px-3 py-2 text-left text-ds-small text-slate-700 dark:text-slate-300 hover:bg-mint-50 dark:hover:bg-slate-700"
                      >
                        {t.mark_as_inactive || 'Mark as Inactive'} → {t.on_sick_leave || 'Sick Leave'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusDropdownOpen(null);
                          onStatusChange(staffMember.id, 'maternity_leave');
                        }}
                        className="w-full px-3 py-2 text-left text-ds-small text-slate-700 dark:text-slate-300 hover:bg-mint-50 dark:hover:bg-slate-700"
                      >
                        {t.mark_as_inactive || 'Mark as Inactive'} → {t.on_maternity_leave || 'Maternity Leave'}
                      </button>
                    </div>
                    {!staffMember.is_active && onStatusChange && (
                      <div className="border-t border-slate-200 dark:border-slate-700">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusDropdownOpen(null);
                            onStatusChange(staffMember.id, 'active');
                          }}
                          className="w-full px-3 py-2 text-left text-ds-small text-slate-700 dark:text-slate-300 hover:bg-mint-50 dark:hover:bg-slate-700 last:rounded-b-ds-md"
                        >
                          {t.re_activate || 'Re-activate'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
      prevProps.staffMember.current_status === nextProps.staffMember.current_status &&
      prevProps.staffMember.created_at === nextProps.staffMember.created_at &&
      prevProps.onEdit === nextProps.onEdit &&
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.isPrincipal === nextProps.isPrincipal &&
      prevProps.statusDropdownOpen === nextProps.statusDropdownOpen &&
      prevProps.t === nextProps.t
    );
  });
  StaffTableRow.displayName = 'StaffTableRow';

  return (
    <main className="mx-auto max-w-6xl px-4 pb-4 md:px-6">
       <PageHeader
        title={t.staff}
        subtitle={t.staff_subtitle}
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
        rightActions={
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 px-ds-sm py-2 text-ds-small text-white hover:bg-mint-600 transition-colors"
          >
            <Users className="h-4 w-4" /> {t.create_staff}
          </button>
        }
      />
   

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
                    onStatusChange={isPrincipal ? handleOpenStatusModal : undefined}
                    isPrincipal={isPrincipal}
                    statusDropdownOpen={statusDropdownOpen}
                    setStatusDropdownOpen={setStatusDropdownOpen}
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

      {/* Status Change Modal */}
      {isPrincipal && statusChangeStaffId && statusChangeType && (
        <StaffStatusChangeModal
          isOpen={isStatusModalOpen}
          onClose={handleCloseStatusModal}
          onSuccess={handleStatusChangeSuccess}
          staffId={statusChangeStaffId}
          status={statusChangeType}
        />
      )}
    </main>
  );
}
