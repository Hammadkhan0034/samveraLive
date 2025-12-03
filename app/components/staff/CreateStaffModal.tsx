'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';

export interface StaffFormData {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  ssn: string;
  education_level: string;
  union_membership: string;
  class_id: string;
  role: string;
  is_active?: boolean;
}

interface CreateStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: StaffFormData;
}

export function CreateStaffModal({ isOpen, onClose, onSuccess, initialData }: CreateStaffModalProps) {
  const { t } = useLanguage();

  const isEditMode = !!initialData?.id;

  // Form state
  const [newStaff, setNewStaff] = useState<StaffFormData>({
    id: undefined,
    first_name: '',
    last_name: '',
    email: '',
    address: '',
    ssn: '',
    phone: '',
    education_level: '',
    union_membership: '',
    class_id: '',
    role: 'teacher',
    is_active: true,
  });
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classesForDropdown, setClassesForDropdown] = useState<Array<{ id: string; name: string; code: string | null }>>([]);

  useEffect(() => {
      loadClassesForDropdown();
    
  }, [isOpen]);

  // Initialize form from initialData when provided (edit mode)
  useEffect(() => {
    if (isOpen && initialData) {
      setNewStaff({
        id: initialData.id,
        first_name: initialData.first_name || '',
        last_name: initialData.last_name || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        address: initialData.address || '',
        ssn: initialData.ssn || '',
        education_level: initialData.education_level || '',
        union_membership: initialData.union_membership || '',
        class_id: initialData.class_id || '',
        role: initialData.role || 'teacher',
        is_active: initialData.is_active ?? true,
      });
    }
  }, [isOpen, initialData]);

  async function loadClassesForDropdown() {
    try {
      const res = await fetch(`/api/classes?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const classesList = json.classes || [];
      setClassesForDropdown(classesList.map((cls: any) => ({ id: cls.id, name: cls.name, code: cls.code })));
    } catch (e: any) {
      console.error('❌ Error loading classes for dropdown:', e.message);
    }
  }

  async function handleSubmitStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!newStaff.first_name.trim() || !newStaff.email.trim()) return;
    // Validate phone format if provided (E.164-like, 7-15 digits, optional +)
    if (newStaff.phone && !/^\+?[1-9]\d{6,14}$/.test(newStaff.phone)) {
      setPhoneError(t.invalid_phone);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      
      const method = isEditMode ? 'PUT' : 'POST';
      const requestBody: any = {
        first_name: newStaff.first_name.trim(),
        last_name: newStaff.last_name.trim() || null,
        email: newStaff.email.trim(),
        phone: newStaff.phone?.trim() || null,
        class_id: newStaff.class_id?.trim() ? newStaff.class_id : null,
        address: newStaff.address?.trim() || null,
        ssn: newStaff.ssn?.trim() || null,
        education_level: newStaff.education_level?.trim() || null,
        union_membership: newStaff.union_membership?.trim() || null,
        role: newStaff.role || 'teacher',
      };

      // Include id for edit mode
      if (isEditMode && newStaff.id) {
        requestBody.id = newStaff.id;
      }

      const response = await fetch('/api/staff-management', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      if (!response.ok) {
        // Extract error message from response
        const errorMsg = data.details || data.error || (isEditMode ? 'Failed to update staff' : 'Failed to create staff');
        throw new Error(errorMsg);
      }
      // Reset form
      setNewStaff({ 
        id: undefined,
        first_name: '', 
        last_name: '', 
        email: '', 
        address: '', 
        ssn: '', 
        phone: '', 
        education_level: '', 
        union_membership: '', 
        class_id: '',
        role: 'teacher',
        is_active: true,
      });
      setError(null);
      setPhoneError(null);
      alert(`✅ ${isEditMode ? (t.staff_updated_success || 'Staff member updated successfully') : t.staff_created_success}`);
      onClose();
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      const errorMsg = error.message || (isEditMode ? 'Failed to update staff' : 'Failed to create staff');
      setError(errorMsg);
      console.error(`❌ Staff ${isEditMode ? 'update' : 'creation'} error:`, errorMsg);
    } finally {
      setLoading(false);
    }
  }

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNewStaff({ 
        id: undefined,
        first_name: '', 
        last_name: '', 
        email: '', 
        address: '', 
        ssn: '', 
        phone: '', 
        education_level: '', 
        union_membership: '', 
        class_id: '',
        role: 'teacher',
        is_active: true,
      });
      setError(null);
      setPhoneError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-xl rounded-ds-lg bg-white p-ds-md shadow-ds-lg dark:bg-slate-800">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100">
            {isEditMode ? (t.edit_staff || 'Edit Staff Member') : t.create_staff}
          </h3>
          <button onClick={onClose} className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmitStaff} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.first_name || 'First name'}</label>
              <input
                type="text"
                value={newStaff.first_name}
                onChange={(e) => setNewStaff((prev) => ({ ...prev, first_name: e.target.value }))}
                placeholder={t.first_name || 'First name'}
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                required
              />
            </div>
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.last_name || 'Last name'}</label>
              <input
                type="text"
                value={newStaff.last_name}
                onChange={(e) => setNewStaff((prev) => ({ ...prev, last_name: e.target.value }))}
                placeholder={t.last_name || 'Last name'}
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_email}</label>
            <input
              type="email"
              value={newStaff.email}
              onChange={(e) => setNewStaff((prev) => ({ ...prev, email: e.target.value }))}
              placeholder={t.staff_email_placeholder}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              required
              disabled={isEditMode}
            />
          </div>
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_address || 'Address'}</label>
            <input
              type="text"
              value={newStaff.address}
              onChange={(e) => setNewStaff((prev) => ({ ...prev, address: e.target.value }))}
              placeholder={t.staff_address_placeholder || 'Enter address'}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            />
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
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
              {phoneError && (
                <p className="mt-1 text-ds-tiny text-red-600 dark:text-red-400">{phoneError}</p>
              )}
            </div>
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_ssn || 'SSN'}</label>
              <input
                type="text"
                value={newStaff.ssn}
                onChange={(e) => setNewStaff((prev) => ({ ...prev, ssn: e.target.value }))}
                placeholder={'000000-0000'}
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_education_level || 'Education Level'}</label>
              <input
                type="text"
                value={newStaff.education_level}
                onChange={(e) => setNewStaff((prev) => ({ ...prev, education_level: e.target.value }))}
                placeholder={t.staff_education_level_placeholder || 'e.g. B.Ed, M.Ed'}
                className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_union_membership || 'Union Membership'}</label>
            <input
              type="text"
              value={newStaff.union_membership}
              onChange={(e) => setNewStaff((prev) => ({ ...prev, union_membership: e.target.value }))}
              placeholder={t.staff_union_membership_placeholder}
              className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            />
          </div>
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.staff_role || 'Role'}</label>
            <select
              value={newStaff.role || 'teacher'}
              onChange={(e) => setNewStaff((prev) => ({ ...prev, role: e.target.value }))}
              className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              <option value="teacher">{t.role_teacher || 'Teacher'}</option>
              <option value="assistant">{t.role_assistant || 'Assistant'}</option>
              <option value="specialist">{t.role_specialist || 'Specialist'}</option>
            </select>
          </div>
          <div>
            <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">{t.assign_to_class}</label>
            <select
              value={newStaff.class_id}
              onChange={(e) => setNewStaff((prev) => ({ ...prev, class_id: e.target.value }))}
              className="w-full rounded-ds-md border border-slate-300 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            >
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
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small text-slate-700 hover:bg-mint-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isEditMode ? (t.updating || 'Updating...') : t.creating}
                </>
              ) : (
                isEditMode ? (t.update || 'Update') : t.create_staff_btn
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

