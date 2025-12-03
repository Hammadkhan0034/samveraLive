'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Edit, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { CreateStaffModal } from '@/app/components/staff/CreateStaffModal';
import type { StaffFormData } from '@/lib/types/staff';

type Lang = 'is' | 'en';

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

interface StaffManagementProps {
  lang?: Lang;
}

export default function StaffManagement({ lang: propLang }: StaffManagementProps) {
  const { session } = useAuth?.() || ({} as any);
  const { t, lang: contextLang } = useLanguage();
  // Use lang prop if provided, otherwise use current language from context

  // Staff management states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteStaffModalOpen, setIsDeleteStaffModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffFormData | null>(null);

  const [staff, setStaff] = useState<Array<{ id: string; email: string; first_name: string; last_name: string | null; is_active: boolean; created_at: string }>>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Load initial lists
  useEffect(() => {
    if (session?.user?.id) {
      loadStaff();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function loadStaff(showLoading = true) {
    if (loadingStaff && showLoading) return;
    try {
      if (showLoading) setLoadingStaff(true);
      setStaffError(null);
      const response = await fetch(`/api/staff-management`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load staff');
      setStaff(data.staff || []);
    } catch (error: any) {
      setStaffError(error.message);
    } finally {
      if (showLoading) setLoadingStaff(false);
    }
  }


  async function deleteStaffMember(id: string) {
    try {
      setStaffError(null);
      const response = await fetch(`/api/staff-management?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete staff');
      setIsDeleteStaffModalOpen(false);
      setStaffToDelete(null);
      await loadStaff();
    } catch (error: any) {
      setStaffError(error.message);
    }
  }

  function openDeleteStaffModal(id: string) {
    setStaffToDelete(id);
    setIsDeleteStaffModalOpen(true);
  }

  function openEditStaffModal(staffMember: any) {
    // Transform staff data to StaffFormData format
    // Note: union_name is always a string (null or empty string if no union)
    const staffFormData: StaffFormData = {
      id: staffMember.id,
      first_name: staffMember.first_name || '',
      last_name: staffMember.last_name || '',
      email: staffMember.email || '',
      phone: (staffMember as any).phone || '',
      address: (staffMember as any).address || '',
      ssn: (staffMember as any).ssn || '',
      education_level: (staffMember as any).education_level || '',
      union_membership: (staffMember as any).union_name || '',
      class_id: (staffMember as any).class_id || '',
      role: (staffMember as any).role || 'teacher',
      is_active: staffMember.is_active ?? true,
    };
    setEditingStaff(staffFormData);
    setIsCreateModalOpen(true);
    setStaffError(null);
  }


  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(staff.length / itemsPerPage));
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return staff.slice(start, start + itemsPerPage);
  }, [staff, currentPage]);

  // Reset to page 1 when staff data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [staff.length]);

  

  return (
    <main className="mx-auto max-w-6xl px-4 pb-4 md:px-6">
      <div className="mb-ds-lg flex flex-col gap-ds-sm md:flex-row md:items-center md:justify-between">
  
          <div>
          <h2 className="text-ds-h1 font-bold tracking-tight text-ds-text-primary dark:text-slate-100">
          {t.staff_management}</h2>
            <p className="mt-2 text-ds-small text-ds-text-muted dark:text-slate-400">{t.manage_staff}</p>
          </div>
        <div className="flex flex-wrap gap-ds-sm">
          <button
            onClick={() => {
              setEditingStaff(null);
              setIsCreateModalOpen(true);
            }}
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
        {loadingStaff || staff.length === 0 ? (
          <LoadingSkeleton type="table" rows={5} />
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
                  <tr
                    key={s.id}
                    className="h-12 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={(e) => {
                      // Prevent row click from triggering navigation
                      // Only allow clicks on buttons to work
                      if ((e.target as HTMLElement).tagName !== 'BUTTON' && 
                          !(e.target as HTMLElement).closest('button')) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                  >
                    <td className="py-2 pr-3 pl-3 text-slate-900 dark:text-slate-100">{(s as any).first_name || (s as any).full_name?.split(' ')[0] || ''}</td>
                    <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">{(s as any).last_name || ((s as any).full_name ? (s as any).full_name.split(' ').slice(1).join(' ') : '')}</td>
                    <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{s.email}</td>
                    <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{(s as any).role || 'teacher'}</td>
                    <td className="py-2 pr-3">
                      <span className={clsx('inline-block rounded-full px-2 py-0.5 text-xs', s.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300')}>
                        {s.is_active ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditStaffModal(s);
                          }} 
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600"
                        >
                          <Edit className="h-3 w-3" /> {t.edit || 'Edit'}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteStaffModal(s.id);
                          }} 
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border-red-300 dark:border-red-600"
                        >
                          <Trash2 className="h-3 w-3" /> {t.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination controls */}
        {staff.length > 0 && (
          <div className="mt-4 w-full flex justify-end gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              {t.prev || 'Prev'}
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={`inline-flex items-center rounded-ds-md px-3 py-1.5 text-ds-small transition-colors ${
                  currentPage === idx + 1
                    ? 'bg-mint-500 text-white border border-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                    : 'border border-slate-400 dark:border-slate-600 dark:text-slate-200 hover:bg-mint-50'
                }`}
              >
                {idx + 1}
              </button>
            ))}
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
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingStaff(null);
        }}
        onSuccess={loadStaff}
        initialData={editingStaff || undefined}
      />

      {/* Delete Staff Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteStaffModalOpen}
        onClose={() => { setIsDeleteStaffModalOpen(false); setStaffToDelete(null); }}
        onConfirm={() => { if (staffToDelete) deleteStaffMember(staffToDelete); }}
        title={t.remove_staff_member}
        message={t.remove_staff_confirm}
        error={staffError}
        confirmButtonText={t.remove}
        cancelButtonText={t.cancel}
      />

    </main>
  );
}


