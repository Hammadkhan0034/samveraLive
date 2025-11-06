'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface StudentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StudentFormData) => Promise<void>;
  initialData?: StudentFormData;
  loading?: boolean;
  error: string | null;
  guardians: Array<{ id: string; full_name?: string; first_name?: string; last_name?: string; email?: string | null }>;
  classes: Array<{ id: string; name: string }>;
  orgId: string;
  asPage?: boolean;
  translations: {
    create_student: string;
    edit_student: string;
    student_first_name: string;
    student_last_name: string;
    student_dob: string;
    student_gender: string;
    student_class: string;
    student_status?: string;
    status_pending?: string;
    status_approved?: string;
    status_rejected?: string;
    student_guardians: string;
    student_medical_notes: string;
    student_allergies: string;
    student_emergency_contact: string;
    student_phone: string;
    student_registration_time: string;
    student_address: string;
    student_start_date: string;
    student_child_value: string;
    student_language: string;
    student_social_security_number: string;
    student_registration_time_placeholder: string;
    student_social_security_number_placeholder: string;
    student_phone_placeholder: string;
    student_child_value_placeholder: string;
    student_address_placeholder: string;
    student_first_name_placeholder: string;
    student_last_name_placeholder: string;
    student_medical_notes_placeholder: string;
    student_allergies_placeholder: string;
    student_emergency_contact_placeholder: string;
    gender_unknown: string;
    gender_male: string;
    gender_female: string;
    gender_other: string;
    no_class_assigned: string;
    no_guardians_available: string;
    student_age_requirement: string;
    create: string;
    update: string;
    cancel: string;
    creating: string;
    updating: string;
  };
}

export interface StudentFormData {
  id?: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  class_id: string;
  status?: 'pending' | 'approved' | 'rejected' | string;
  medical_notes: string;
  allergies: string;
  emergency_contact: string;
  org_id: string;
  guardian_ids: string[];

  // add these so setStudentForm accepts them
  phone: string;
  address: string;
  registration_time: string;
  start_date: string;
  barngildi: number;
  student_language: string;
  social_security_number: string;
}

export function StudentForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  loading,
  error,
  guardians,
  classes,
  orgId,
  asPage,
  translations: t
}: StudentFormProps) {
  const [formData, setFormData] = useState<StudentFormData>({
    first_name: '',
    last_name: '',
    dob: '',
    gender: 'unknown',
    class_id: '',
    status: 'pending',
    phone: '',
    address: '',
    registration_time: '',
    start_date: '',
    barngildi: 0,
    student_language: 'english',
    social_security_number: '',
    medical_notes: '',
    allergies: '',
    org_id: orgId,
    emergency_contact: '',
    guardian_ids: []
  });

  // Update form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        dob: '',
        gender: 'unknown',
        class_id: '',
        status: 'pending',
        phone: '',
        address: '',
        registration_time: '',
        start_date: '',
        barngildi: 0,
        student_language: 'english',
        social_security_number: '',
        medical_notes: '',
        allergies: '',
        org_id: orgId,
        emergency_contact: '',
        guardian_ids: []
      });
    }
  }, [initialData, orgId]);

  // Validate student age
  const validateStudentAge = (dob: string): boolean => {
    if (!dob) return true; // No DOB is valid
    
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Calculate actual age
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
      ? age - 1 
      : age;
    
    return actualAge >= 0 && actualAge <= 18;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate age before submitting
    if (formData.dob && !validateStudentAge(formData.dob)) {
      return; // Don't submit if age is invalid
    }
    
    await onSubmit(formData);
  };

  const handleClose = () => {
    setFormData({
      first_name: '',
      last_name: '',
      dob: '',
      gender: 'unknown',
      class_id: '',
      status: 'pending',
      phone: '',
      address: '',
      registration_time: '',
      start_date: '',
      barngildi: 0,
      student_language: 'english',
      social_security_number: '',
      medical_notes: '',
      allergies: '',
      org_id: orgId,
      emergency_contact: '',
      guardian_ids: []
    });
    onClose();
  };

  if (!asPage && !isOpen) return null;

  return (
    <div className={asPage ? "w-full" : "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"}>
      <div className={asPage ? "w-[70%] ml-20 bg-white dark:bg-slate-800 p-6 shadow-sm" : "w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto"}>
        {!asPage && (
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formData.id ? t.edit_student : t.create_student}
            </h3>
            <button
              onClick={handleClose}
              className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.student_first_name}
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder={t.student_first_name_placeholder}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.student_last_name}
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder={t.student_last_name_placeholder}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.student_dob}
              </label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 dark:bg-slate-700 dark:text-slate-200 ${
                  formData.dob && !validateStudentAge(formData.dob)
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              <p className={`mt-1 text-xs ${
                formData.dob && !validateStudentAge(formData.dob)
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}>
                {formData.dob && !validateStudentAge(formData.dob)
                  ? 'Student age must be between 0-18 years old'
                  : t.student_age_requirement
                }
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.student_gender}
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
              >
                <option value="unknown">{t.gender_unknown}</option>
                <option value="male">{t.gender_male}</option>
                <option value="female">{t.gender_female}</option>
                <option value="other">{t.gender_other}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.student_phone}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder={t.student_phone_placeholder}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.student_registration_time}
              </label>
              <input
                type="text"
                value={formData.registration_time}
                onChange={(e) => setFormData(prev => ({ ...prev, registration_time: e.target.value }))}
                // placeholder={t.student_registration_time_placeholder}
                placeholder='YYYY-MM-DD HH:MM'
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.student_address}
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder={t.student_address_placeholder}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.student_status || 'Status'}
            </label>
            <select
              value={formData.status || 'pending'}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
            >
              <option value="pending">{t.status_pending || 'Pending'}</option>
              <option value="approved">{t.status_approved || 'Approved'}</option>
              <option value="rejected">{t.status_rejected || 'Rejected'}</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.student_start_date}
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                placeholder='YYYY-MM-DD'
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.student_child_value}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0.5}
                max={1.9}
                step={0.1}
                value={formData.barngildi ?? 0}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  if (isNaN(num)) {
                    setFormData(prev => ({ ...prev, barngildi: 0 }));
                  } else {
                    const clamped = Math.min(1.9, Math.max(0.5, num));
                    setFormData(prev => ({ ...prev, barngildi: Number(clamped.toFixed(1)) }));
                  }
                }}
                placeholder={t.student_child_value_placeholder || '1.0 or 1.7'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.student_language}
              </label>
              <select
                value={formData.student_language}
                onChange={(e) => setFormData(prev => ({ ...prev, student_language: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
              >
                <option value="english">English</option>
                <option value="icelandic">Íslenska</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.student_social_security_number}
              </label>
              <input
                type="text"
                value={formData.social_security_number}
                onChange={(e) => setFormData(prev => ({ ...prev, social_security_number: e.target.value }))}
                // placeholder={t.student_social_security_number_placeholder}
                placeholder='000000-0000'
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.student_class}
            </label>
            <select
              value={formData.class_id}
              onChange={(e) => setFormData(prev => ({ ...prev, class_id: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
            >
              <option value="">{t.no_class_assigned}</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* Guardians removed from UI */}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.student_medical_notes}
            </label>
            <textarea
              value={formData.medical_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, medical_notes: e.target.value }))}
              placeholder={t.student_medical_notes_placeholder}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.student_allergies}
            </label>
            <textarea
              value={formData.allergies}
              onChange={(e) => setFormData(prev => ({ ...prev, allergies: e.target.value }))}
              placeholder={t.student_allergies_placeholder}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.student_emergency_contact}
            </label>
            <textarea
              value={formData.emergency_contact}
              onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
              placeholder={t.student_emergency_contact_placeholder}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              rows={2}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || (!!formData.dob && !validateStudentAge(formData.dob))}
              className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {formData.id ? t.updating : t.creating}
                </>
              ) : (
                formData.id ? t.update : t.create
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
