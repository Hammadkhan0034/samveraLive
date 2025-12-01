'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Edit, Trash2, Users, X, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCurrentUserOrgId } from '@/lib/hooks/useCurrentUserOrgId';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';

type Lang = 'is' | 'en';

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

interface StaffManagementProps {
  lang?: Lang;
}

export default function StaffManagement({ lang: propLang }: StaffManagementProps) {
  const router = useRouter();
  const { session } = useAuth?.() || ({} as any);
  const { t, lang: contextLang } = useLanguage();
  // Use lang prop if provided, otherwise use current language from context
  const lang = propLang || contextLang;

  // Use universal hook to get org_id (checks metadata first, then API, handles logout if missing)
  const { orgId: finalOrgId } = useCurrentUserOrgId();

  // Classes dropdown
  const [classesForDropdown, setClassesForDropdown] = useState<Array<{ id: string; name: string; code: string | null }>>([]);

  // Staff management states
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isDeleteStaffModalOpen, setIsDeleteStaffModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [isEditStaffModalOpen, setIsEditStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [newStaff, setNewStaff] = useState({ first_name: '', last_name: '', email: '', address: '', ssn: '', phone: '', education_level: '', union_membership: false, class_id: '' });
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [staff, setStaff] = useState<Array<{ id: string; email: string; first_name: string; last_name: string | null; is_active: boolean; created_at: string }>>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Load initial lists
  useEffect(() => {
    if (finalOrgId) {
      loadClassesForDropdown();
      loadStaff();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalOrgId, session?.user?.id]);

  async function loadClassesForDropdown() {
    try {
      if (!finalOrgId) return;
      const res = await fetch(`/api/classes?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const classesList = json.classes || [];
      setClassesForDropdown(classesList.map((cls: any) => ({ id: cls.id, name: cls.name, code: cls.code })));
    } catch (e: any) {
      console.error('❌ Error loading classes for dropdown:', e.message);
    }
  }

  async function loadStaff(showLoading = true) {
    if (!finalOrgId) return;
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

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!newStaff.first_name.trim() || !newStaff.email.trim()) return;
    // Validate phone format if provided (E.164-like, 7-15 digits, optional +)
    if (newStaff.phone && !/^\+?[1-9]\d{6,14}$/.test(newStaff.phone)) {
      setPhoneError(t.invalid_phone);
      return;
    }
    if (!session?.user?.id) {
      alert('User session not found. Please log in again.');
      return;
    }
    try {
      setStaffError(null);
      setLoadingStaff(true);
      const response = await fetch('/api/staff-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: newStaff.first_name.trim(),
          last_name: newStaff.last_name.trim() || null,
          email: newStaff.email,
          phone: newStaff.phone || null,
          class_id: newStaff.class_id?.trim() ? newStaff.class_id : null,
          address: newStaff.address || null,
          ssn: newStaff.ssn || null,
          education_level: newStaff.education_level || null,
          union_membership: !!newStaff.union_membership,
          role: 'teacher'
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        // Extract error message from response
        const errorMsg = data.details || data.error || 'Failed to create staff';
        throw new Error(errorMsg);
      }
      setNewStaff({ first_name: '', last_name: '', email: '', address: '', ssn: '', phone: '', education_level: '', union_membership: false, class_id: '' });
      setIsStaffModalOpen(false);
      setStaffError(null);
      await loadStaff();
      alert(`✅ ${t.staff_created_success}`);
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to create staff';
      setStaffError(errorMsg);
      console.error('❌ Staff creation error:', errorMsg);
    } finally {
      setLoadingStaff(false);
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
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-col gap-3 mt-14 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> {t.back}
          </button>
          <div>
            <h1 className="text-ds-h2 font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.staff_management}</h1>
            <p className="mt-1 text-ds-small text-slate-600 dark:text-slate-400">{t.manage_staff}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setStaffError(null);
              setIsStaffModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 transition-colors"
          >
            <Users className="h-4 w-4" /> {t.create_staff}
          </button>
        </div>
      </div>

      {staffError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {staffError}
        </div>
      )}

      {/* Active Staff Table */}
      <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
        <h4 className="text-md font-medium mb-3 text-slate-900 dark:text-slate-100">{t.active_staff_members}</h4>
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
              className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              {t.prev || 'Prev'}
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm ${
                  currentPage === idx + 1
                    ? 'bg-white text-black border border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                    : 'border border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {idx + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              {t.next || 'Next'}
            </button>
          </div>
        )}
      </div>


      {/* Add Staff Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-xl rounded-ds-lg bg-white p-ds-md shadow-ds-lg dark:bg-slate-800">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">{t.create_staff}</h3>
              <button onClick={() => setIsStaffModalOpen(false)} className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            {staffError && (
              <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {staffError}
              </div>
            )}
            <form onSubmit={handleAddStaff} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.first_name || 'First name'}</label>
                  <input type="text" value={newStaff.first_name} onChange={(e) => setNewStaff((prev) => ({ ...prev, first_name: e.target.value }))} placeholder={t.first_name || 'First name'} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" required />
                </div>
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.last_name || 'Last name'}</label>
                  <input type="text" value={newStaff.last_name} onChange={(e) => setNewStaff((prev) => ({ ...prev, last_name: e.target.value }))} placeholder={t.last_name || 'Last name'} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_email}</label>
                <input type="email" value={newStaff.email} onChange={(e) => setNewStaff((prev) => ({ ...prev, email: e.target.value }))} placeholder={t.staff_email_placeholder} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" required />
              </div>
              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_address || 'Address'}</label>
                <input type="text" value={newStaff.address} onChange={(e) => setNewStaff((prev) => ({ ...prev, address: e.target.value }))} placeholder={t.staff_address_placeholder || 'Enter address'} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_phone}</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={newStaff.phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewStaff((prev) => ({ ...prev, phone: val }));
                      if (!val) {
                        setPhoneError(null);
                      } else if (!/^\+?[1-9]\d{6,14}$/.test(val)) {
                        setPhoneError(t.invalid_phone);
                      } else {
                        setPhoneError(null);
                      }
                    }}
                    placeholder={t.staff_phone_placeholder}
                    className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  />
                  {phoneError && (
                    <p className="mt-1 text-ds-tiny text-red-600 dark:text-red-400">{phoneError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_ssn || 'SSN'}</label>
                  <input type="text" value={newStaff.ssn} onChange={(e) => setNewStaff((prev) => ({ ...prev, ssn: e.target.value }))} placeholder={'000000-0000'} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
                </div>
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_education_level || 'Education Level'}</label>
                  <input type="text" value={newStaff.education_level} onChange={(e) => setNewStaff((prev) => ({ ...prev, education_level: e.target.value }))} placeholder={t.staff_education_level_placeholder || 'e.g. B.Ed, M.Ed'} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="union_membership" type="checkbox" checked={!!newStaff.union_membership} onChange={(e) => setNewStaff((prev) => ({ ...prev, union_membership: e.target.checked }))} className="h-3 w-3 rounded border-slate-300 text-mint-500 focus:ring-mint-500" />
                <label htmlFor="union_membership" className="text-ds-small text-slate-700 dark:text-slate-300">{t.staff_union_membership || 'Union Membership'}</label>
              </div>
              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.assign_to_class}</label>
                <select value={newStaff.class_id} onChange={(e) => setNewStaff((prev) => ({ ...prev, class_id: e.target.value }))} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400">
                  <option value="">{t.no_class_assigned}</option>
                  {classesForDropdown.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.code ? `(${cls.code})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-ds-tiny text-slate-500 dark:text-slate-400">{t.class_assignment_note}</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsStaffModalOpen(false)} disabled={loadingStaff} className="flex-1 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small text-slate-700 hover:bg-mint-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{t.cancel}</button>
                <button type="submit" disabled={loadingStaff} className="flex-1 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
                  {loadingStaff ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t.creating}
                    </>
                  ) : (
                    t.create_staff_btn
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {isEditStaffModalOpen && editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-xl rounded-ds-lg bg-white p-ds-md shadow-ds-lg dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">{t.edit_staff || 'Edit Staff Member'}</h3>
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
                  <input type="text" value={editingStaff.first_name} onChange={(e) => setEditingStaff({ ...editingStaff, first_name: e.target.value })} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" required />
                </div>
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.last_name || 'Last Name'}</label>
                  <input type="text" value={editingStaff.last_name} onChange={(e) => setEditingStaff({ ...editingStaff, last_name: e.target.value })} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.email}</label>
                <input type="email" value={editingStaff.email} onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_phone || 'Phone'}</label>
                  <input type="tel" value={editingStaff.phone} onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
                </div>
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_ssn || 'SSN'}</label>
                  <input type="text" value={editingStaff.ssn} onChange={(e) => setEditingStaff({ ...editingStaff, ssn: e.target.value })} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
                </div>
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_education_level || 'Education Level'}</label>
                  <input type="text" value={editingStaff.education_level} onChange={(e) => setEditingStaff({ ...editingStaff, education_level: e.target.value })} placeholder={t.staff_education_level_placeholder || 'e.g. B.Ed, M.Ed'} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_address || 'Address'}</label>
                <input type="text" value={editingStaff.address} onChange={(e) => setEditingStaff({ ...editingStaff, address: e.target.value })} placeholder={t.staff_address_placeholder || 'Enter address'} className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400" />
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


