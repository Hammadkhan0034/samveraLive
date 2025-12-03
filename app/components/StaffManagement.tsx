'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Edit, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { CreateStaffModal } from '@/app/components/staff/CreateStaffModal';

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
  const [isEditStaffModalOpen, setIsEditStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);

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
    setEditingStaff({
      id: staffMember.id,
      first_name: staffMember.first_name || '',
      last_name: staffMember.last_name || '',
      email: staffMember.email || '',
      phone: (staffMember as any).phone || '',
      address: (staffMember as any).address || '',
      ssn: (staffMember as any).ssn || '',
      education_level: (staffMember as any).education_level || '',
      union_membership: (staffMember as any).union_name === 'Yes',
      role: (staffMember as any).role || 'teacher',
      is_active: staffMember.is_active ?? true,
    });
    setIsEditStaffModalOpen(true);
    setStaffError(null);
  }

  async function handleUpdateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStaff?.id) return;
    try {
      setLoadingStaff(true);
      setStaffError(null);
      const response = await fetch('/api/staff-management', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingStaff),
      });
      const data = await response.json();
      if (!response.ok) {
        // Extract error message from response
        const errorMsg = data.details || data.error || 'Failed to update staff member';
        throw new Error(errorMsg);
      }
      setIsEditStaffModalOpen(false);
      setEditingStaff(null);
      setStaffError(null);
      await loadStaff();
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to update staff member';
      setStaffError(errorMsg);
      console.error('❌ Error updating staff:', errorMsg);
    } finally {
      setLoadingStaff(false);
    }
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
            onClick={() => setIsCreateModalOpen(true)}
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

      {/* Create Staff Modal */}
      <CreateStaffModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadStaff}
      />

      {/* Edit Staff Modal */}
      {isEditStaffModalOpen && editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-xl rounded-ds-lg bg-white p-ds-md shadow-ds-lg dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100">
                {t.edit_staff || 'Edit Staff Member'}
              </h3>
              <button onClick={() => { setIsEditStaffModalOpen(false); setEditingStaff(null); }} className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            {staffError && (
              <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">{staffError}</div>
            )}
            <form onSubmit={handleUpdateStaff} className="space-y-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.first_name || 'First Name'}</label>
                  <input type="text" value={editingStaff.first_name} onChange={(e) => setEditingStaff({ ...editingStaff, first_name: e.target.value })} className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" required />
                </div>
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.last_name || 'Last Name'}</label>
                  <input type="text" value={editingStaff.last_name} onChange={(e) => setEditingStaff({ ...editingStaff, last_name: e.target.value })} className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.email}</label>
                <input type="email" value={editingStaff.email} onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })} className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_phone || 'Phone'}</label>
                  <input type="tel" value={editingStaff.phone} onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })} className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
                </div>
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_ssn || 'SSN'}</label>
                  <input type="text" value={editingStaff.ssn} onChange={(e) => setEditingStaff({ ...editingStaff, ssn: e.target.value })} className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
                </div>
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_education_level || 'Education Level'}</label>
                  <input type="text" value={editingStaff.education_level} onChange={(e) => setEditingStaff({ ...editingStaff, education_level: e.target.value })} placeholder={t.staff_education_level_placeholder || 'e.g. B.Ed, M.Ed'} className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_address || 'Address'}</label>
                <input type="text" value={editingStaff.address} onChange={(e) => setEditingStaff({ ...editingStaff, address: e.target.value })} placeholder={t.staff_address_placeholder || 'Enter address'} className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
              </div>
              {/* Role selection */}
              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_role || 'Role'}</label>
                <select
                  value={editingStaff.role || 'teacher'}
                  onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })}
                  className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                >
                  <option value="teacher">{t.role_teacher || 'Teacher'}</option>
                  <option value="assistant">{t.role_assistant || 'Assistant'}</option>
                  <option value="specialist">{t.role_specialist || 'Specialist'}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="union_membership" checked={!!editingStaff.union_membership} onChange={(e) => setEditingStaff({ ...editingStaff, union_membership: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-mint-500 focus:ring-mint-500 dark:border-slate-600" />
                <label htmlFor="union_membership" className="text-ds-small text-slate-700 dark:text-slate-300">{t.staff_union_membership || 'Union Membership'}</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setIsEditStaffModalOpen(false); setEditingStaff(null); }} className="flex-1 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small text-slate-700 hover:bg-mint-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors">{t.cancel || 'Cancel'}</button>
                <button type="submit" disabled={loadingStaff} className="flex-1 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 transition-colors">{loadingStaff ? (t.updating || 'Updating...') : (t.update || 'Update')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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


