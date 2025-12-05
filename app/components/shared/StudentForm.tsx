'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { StudentFormData } from '@/lib/types/students';
import { GuardianSelector } from './GuardianSelector';
import { ClassSelector } from './ClassSelector';

interface StudentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StudentFormData) => Promise<void>;
  initialData?: StudentFormData;
  loading?: boolean;
  error: string | null;
  guardians: Array<{ id: string; full_name?: string; first_name?: string; last_name?: string; email?: string | null }>;
  classes: Array<{ id: string; name: string }>;
  asPage?: boolean;
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
  asPage,
}: StudentFormProps) {
  const { t } = useLanguage();

  // Use lazy initialization to avoid setState in effect
  const [formData, setFormData] = useState<StudentFormData>(() => {
    if (initialData) {
      return initialData;
    }
    return {
      first_name: '',
      last_name: '',
      dob: '',
      gender: 'unknown',
      class_id: '',
      address: '',
      start_date: '',
      barngildi: 0,
      student_language: 'english',
      social_security_number: '',
      medical_notes: '',
      allergies: '',
      emergency_contact: '',
      guardian_ids: []
    };
  });

  // Use ref to track previous initialData ID to avoid unnecessary resets
  const prevInitialDataIdRef = useRef<string | undefined>(initialData?.id);
  const isInitialMount = useRef(true);
  const hasUserInputRef = useRef(false);

  // Track when user starts typing to prevent form resets
  useEffect(() => {
    const hasInput = formData.first_name || formData.last_name || formData.dob || formData.address;
    if (hasInput) {
      hasUserInputRef.current = true;
    }
  }, [formData.first_name, formData.last_name, formData.dob, formData.address]);

  // Update form data when initialData changes - but preserve user input
  useEffect(() => {
    // On initial mount, set form data from initialData if provided
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialData) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData(initialData);
        prevInitialDataIdRef.current = initialData.id;
      }
      return;
    }

    // Only update if we're switching to edit a different student (ID changed)
    // AND user hasn't typed anything yet
    const currentId = initialData?.id;
    const prevId = prevInitialDataIdRef.current;

    if (initialData && currentId && currentId !== prevId && !hasUserInputRef.current) {
      // Switching to edit a different student - update form only if no user input
      setFormData(initialData);
      prevInitialDataIdRef.current = currentId;
      hasUserInputRef.current = false; // Reset flag after loading new student
    } else if (initialData && currentId === prevId) {
      // Same student - don't update, preserve user input
      // This prevents reset when the same initialData object reference changes
    } else if (!initialData && prevId) {
      // initialData was cleared (switching from edit to create mode)
      // Don't reset if user has input
      if (!hasUserInputRef.current) {
        // Only reset if form is empty
        prevInitialDataIdRef.current = undefined;
      }
    }
  }, [initialData?.id]); // Only depend on the ID, not the whole object

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

    return actualAge >= 3 && actualAge <= 18;
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
      address: '',
      start_date: '',
      barngildi: 0,
      student_language: 'english',
      social_security_number: '',
      medical_notes: '',
      allergies: '',
      emergency_contact: '',
      guardian_ids: []
    });
    hasUserInputRef.current = false; // Reset flag when closing
    prevInitialDataIdRef.current = undefined; // Reset previous data
    isInitialMount.current = true; // Allow re-initialization if form reopens
    onClose();
  };

  if (!asPage && !isOpen) return null;

  return (
    <div className={asPage ? "w-full" : "fixed inset-0 z-50 flex items-center justify-center bg-black/50"}>
      <div className={asPage ? "w-[100%] bg-white dark:bg-slate-800 p-ds-md shadow-ds-card rounded-ds-lg" : "w-full max-w-2xl rounded-ds-lg bg-white dark:bg-slate-800 p-ds-md shadow-ds-lg max-h-[90vh] overflow-y-auto"}>
        {!asPage && (
          <div className="flex items-center justify-between">
            <h3 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100">
              {formData.id ? t.edit_student : t.create_student}
            </h3>
            <button
              onClick={handleClose}
              className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-ds-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-ds-md">
            <div>
              <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
                {t.student_first_name}
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder={t.student_first_name_placeholder}
                className="w-full h-10 rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
                {t.student_last_name}
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder={t.student_last_name_placeholder}
                className="w-full h-10 rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-ds-md">
            <div>
              <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
                {t.student_dob}
              </label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
                className={`w-full h-10 rounded-ds-md border px-ds-sm text-ds-body bg-input-fill text-ds-text-primary focus:outline-none focus:ring-1 dark:bg-slate-700 dark:text-slate-200 ${formData.dob && !validateStudentAge(formData.dob)
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-input-stroke dark:border-slate-600 focus:border-mint-500 focus:ring-mint-500'
                  }`}
              />
              <p className={`mt-ds-xs text-ds-tiny ${formData.dob && !validateStudentAge(formData.dob)
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-ds-text-muted dark:text-slate-400'
                }`}>
                {formData.dob && !validateStudentAge(formData.dob)
                  ? 'Student age must be between 3-18 years old'
                  : t.student_age_requirement
                }
              </p>
            </div>

            <div>
              <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
                {t.student_gender}
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                className="w-full h-10 rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200"
              >
                <option value="unknown">{t.gender_unknown}</option>
                <option value="male">{t.gender_male}</option>
                <option value="female">{t.gender_female}</option>
                <option value="other">{t.gender_other}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
              {t.student_address}
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder={t.student_address_placeholder}
              className="w-full min-h-[120px] rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm py-3 text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-ds-md">
            <div>
              <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
                {t.student_start_date}
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                placeholder='YYYY-MM-DD'
                className="w-full h-10 rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
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
                className="w-full h-10 rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-ds-md">
            <div>
              <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
                {t.student_language}
              </label>
              <select
                value={formData.student_language}
                onChange={(e) => setFormData(prev => ({ ...prev, student_language: e.target.value }))}
                className="w-full h-10 rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200"
              >
                <option value="english">English</option>
                <option value="icelandic">Íslenska</option>
              </select>
            </div>

            <div>
              <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
                {t.student_social_security_number}
              </label>
              <input
                type="text"
                value={formData.social_security_number}
                onChange={(e) => setFormData(prev => ({ ...prev, social_security_number: e.target.value }))}
                placeholder='000000-0000'
                className="w-full h-10 rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
          </div>

          <ClassSelector
            value={formData.class_id ? [formData.class_id] : []}
            singleSelect={true}
            onChange={(classIds) =>
              setFormData((prev) => ({
                ...prev,
                class_id: classIds.length > 0 ? classIds[0] : '',
              }))
            }
            label={t.student_class}
            classes={classes}
          />

          <GuardianSelector
            guardians={guardians}
            value={formData.guardian_ids}
            onChange={(guardianIds) =>
              setFormData((prev) => ({
                ...prev,
                guardian_ids: guardianIds,
              }))
            }
          />

          <div>
            <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
              {t.student_medical_notes}
            </label>
            <textarea
              value={formData.medical_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, medical_notes: e.target.value }))}
              placeholder={t.student_medical_notes_placeholder}
              className="w-full min-h-[120px] rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm py-3 text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
              {t.student_allergies}
            </label>
            <textarea
              value={formData.allergies}
              onChange={(e) => setFormData(prev => ({ ...prev, allergies: e.target.value }))}
              placeholder={t.student_allergies_placeholder}
              className="w-full min-h-[120px] rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm py-3 text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
              {t.student_emergency_contact}
            </label>
            <textarea
              value={formData.emergency_contact}
              onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
              placeholder={t.student_emergency_contact_placeholder}
              className="w-full min-h-[120px] rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm py-3 text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              rows={2}
            />
          </div>

          {error && (
            <div className="text-ds-small text-red-600 dark:text-red-400">{error}</div>
          )}

          <div className="flex sm:gap-ds-sm pt-ds-md">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-ds-md rounded-full border  border-input-stroke dark:border-slate-600 px-ds-sm py-2 text-ds-small text-ds-text-primary hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors "
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || (!!formData.dob && !validateStudentAge(formData.dob))}
              className="flex-1 rounded-ds-md rounded-full bg-mint-500 hover:bg-mint-600 px-ds-sm py-2 text-ds-small text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-ds-xs transition-colors"
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
