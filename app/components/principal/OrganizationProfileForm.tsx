'use client';

import React, { useState, useEffect } from 'react';
import { Building, Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { validateSlug, validateOrgForm } from '@/lib/utils/validation';
import type { Organization } from '@/lib/types/orgs';

interface OrganizationProfileFormProps {
  organization: Organization | null;
  onUpdate: (org: Organization) => void;
}

interface OrganizationFormData {
  name: string;
  slug: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  timezone: string;
  type: string;
  total_area: string;
  play_area: string;
  square_meters_per_student: string;
  maximum_allowed_students: string;
}

export function OrganizationProfileForm({ organization, onUpdate }: OrganizationProfileFormProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: '',
    slug: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    timezone: 'UTC',
    type: '',
    total_area: '',
    play_area: '',
    square_meters_per_student: '',
    maximum_allowed_students: '',
  });
  const [slugError, setSlugError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize form data when organization loads
  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        slug: organization.slug || '',
        email: organization.email || '',
        phone: organization.phone || '',
        website: organization.website || '',
        address: organization.address || '',
        city: organization.city || '',
        state: organization.state || '',
        postal_code: organization.postal_code || '',
        timezone: organization.timezone || 'UTC',
        type: organization.type || '',
        total_area: organization.total_area?.toString() || '',
        play_area: organization.play_area?.toString() || '',
        square_meters_per_student: organization.square_meters_per_student?.toString() || '',
        maximum_allowed_students: organization.maximum_allowed_students?.toString() || '',
      });
      setError(null);
      setSuccess(null);
      setSlugError(null);
    }
  }, [organization]);

  const handleFieldChange = (field: keyof OrganizationFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
    
    // Validate slug on change
    if (field === 'slug') {
      const slugValue = value.toLowerCase();
      if (slugValue && !validateSlug(slugValue)) {
        setSlugError(t.slug_validation_error);
      } else {
        setSlugError(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSlugError(null);

    // Validate slug
    if (!validateSlug(formData.slug)) {
      setSlugError(t.slug_validation_error);
      return;
    }

    // Validate entire form (for principal's own org, we don't need id in validation)
    // Pass strings directly - Zod schemas will coerce them to numbers
    const validation = validateOrgForm({
      ...formData,
      total_area: formData.total_area || undefined,
      play_area: formData.play_area || undefined,
      square_meters_per_student: formData.square_meters_per_student || undefined,
      maximum_allowed_students: formData.maximum_allowed_students || undefined,
    });
    if (!validation.valid) {
      setError(validation.error || 'Validation failed');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/orgs/my-org', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          total_area: formData.total_area ? Number(formData.total_area) : undefined,
          play_area: formData.play_area ? Number(formData.play_area) : undefined,
          square_meters_per_student: formData.square_meters_per_student ? Number(formData.square_meters_per_student) : undefined,
          maximum_allowed_students: formData.maximum_allowed_students ? Number(formData.maximum_allowed_students) : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: t.error_updating_organization }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setSuccess(t.organization_updated_success);
      onUpdate(data.org);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.error_updating_organization;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClassName = "w-full h-12 rounded-ds-sm border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-4 py-3 text-ds-body text-[#1F2937] dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-[#C5E8D5] focus:outline-none focus:ring-2 focus:ring-[#C5E8D5] focus:ring-opacity-20 transition-colors";
  const labelClassName = "block text-ds-small font-medium text-[#1F2937] dark:text-slate-300 mb-2";
  const textareaClassName = "w-full rounded-ds-sm border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-4 py-3 text-ds-body text-[#1F2937] dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-[#C5E8D5] focus:outline-none focus:ring-2 focus:ring-[#C5E8D5] focus:ring-opacity-20 transition-colors resize-vertical min-h-[120px]";

  if (!organization) {
    return (
      <div className="flex items-center justify-center p-ds-lg">
        <Loader2 className="h-8 w-8 text-mint-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-ds-md">
      {/* Success/Error Messages */}
      {success && (
        <div className="rounded-ds-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-ds-md flex items-center gap-ds-sm">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-ds-small font-medium text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}
      {error && (
        <div className="rounded-ds-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-ds-md flex items-center gap-ds-sm">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-ds-small font-medium text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Organization Information Card */}
      <div className="rounded-ds-xl bg-white dark:bg-slate-800 shadow-ds-card p-ds-lg">
        <div className="mb-ds-lg">
          <div className="flex items-center gap-ds-sm mb-2">
            <Building className="h-5 w-5 text-[#1F2937] dark:text-slate-300" />
            <h2 className="text-ds-h2 font-semibold text-[#1F2937] dark:text-slate-100">
              {t.organization_information}
            </h2>
          </div>
          <p className="mt-2 text-ds-small text-[#4B5563] dark:text-slate-400">
            {t.organization_information_subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-ds-lg">
          {/* Core Identity Section */}
          <div className="space-y-ds-md">
            <h3 className="text-ds-h3 font-semibold text-[#1F2937] dark:text-slate-200">
              {t.core_identity}
            </h3>
            
            <div className="mt-4">
              <label htmlFor="org-name" className={labelClassName}>
                {t.organization_name_label} <span className="text-red-500">*</span>
              </label>
              <input
                id="org-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder={t.organization_name_placeholder}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label htmlFor="org-slug" className={labelClassName}>
                {t.slug_label} <span className="text-red-500">*</span>
              </label>
              <input
                id="org-slug"
                type="text"
                value={formData.slug}
                onChange={(e) => handleFieldChange('slug', e.target.value.toLowerCase())}
                onBlur={(e) => {
                  if (e.target.value && !validateSlug(e.target.value)) {
                    setSlugError(t.slug_validation_error);
                  } else {
                    setSlugError(null);
                  }
                }}
                placeholder={t.slug_placeholder}
                className={`${inputClassName} ${
                  slugError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                    : ''
                }`}
                required
              />
              {slugError && (
                <p className="mt-2 text-ds-tiny text-red-600 dark:text-red-400">{slugError}</p>
              )}
            </div>

            <div>
              <label htmlFor="org-type" className={labelClassName}>
                {t.organization_type_label} <span className="text-red-500">*</span>
              </label>
              <select
                id="org-type"
                value={formData.type}
                onChange={(e) => handleFieldChange('type', e.target.value)}
                className={inputClassName}
                required
              >
                <option value="">{t.organization_type_placeholder}</option>
                <option value="preschool">{t.organization_type_preschool}</option>
                <option value="elementary">{t.organization_type_elementary}</option>
                <option value="middle">{t.organization_type_middle}</option>
                <option value="high">{t.organization_type_high}</option>
                <option value="private">{t.organization_type_private}</option>
                <option value="public">{t.organization_type_public}</option>
                <option value="charter">{t.organization_type_charter}</option>
                <option value="other">{t.organization_type_other}</option>
              </select>
            </div>
          </div>

          {/* Contact Details Section */}
          <div className="space-y-ds-md">
            <h3 className="text-ds-h3 font-semibold text-[#1F2937] dark:text-slate-200">
              {t.contact_details}
            </h3>

            <div className="mt-4">
              <label htmlFor="org-email" className={labelClassName}>
                {t.email_label} <span className="text-red-500">*</span>
              </label>
              <input
                id="org-email"
                type="email"
                value={formData.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                placeholder={t.email_placeholder}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label htmlFor="org-phone" className={labelClassName}>
                {t.phone_label} <span className="text-red-500">*</span>
              </label>
              <input
                id="org-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
                placeholder={t.phone_placeholder}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label htmlFor="org-website" className={labelClassName}>
                {t.website_label}
              </label>
              <input
                id="org-website"
                type="url"
                value={formData.website}
                onChange={(e) => handleFieldChange('website', e.target.value)}
                placeholder={t.website_placeholder}
                className={inputClassName}
              />
            </div>
          </div>

          {/* Location Section */}
          <div className="space-y-ds-md">
            <h3 className="text-ds-h3 font-semibold text-[#1F2937] dark:text-slate-200">
              {t.location}
            </h3>

            <div className="mt-4">
              <label htmlFor="org-address" className={labelClassName}>
                {t.address_label} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="org-address"
                value={formData.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                placeholder={t.address_placeholder}
                className={textareaClassName}
                rows={2}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-ds-md mt-4">
              <div>
                <label htmlFor="org-city" className={labelClassName}>
                  {t.city_label} <span className="text-red-500">*</span>
                </label>
                <input
                  id="org-city"
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                  placeholder={t.city_placeholder}
                  className={inputClassName}
                  required
                />
              </div>

              <div>
                <label htmlFor="org-state" className={labelClassName}>
                  {t.state_label} <span className="text-red-500">*</span>
                </label>
                <input
                  id="org-state"
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleFieldChange('state', e.target.value)}
                  placeholder={t.state_placeholder}
                  className={inputClassName}
                  required
                />
              </div>

              <div>
                <label htmlFor="org-postal-code" className={labelClassName}>
                  {t.postal_code_label} <span className="text-red-500">*</span>
                </label>
                <input
                  id="org-postal-code"
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => handleFieldChange('postal_code', e.target.value)}
                  placeholder={t.postal_code_placeholder}
                  className={inputClassName}
                  required
                />
              </div>
            </div>
          </div>

          {/* Facility Information Section */}
          <div className="space-y-ds-md">
            <h3 className="text-ds-h3 font-semibold text-[#1F2937] dark:text-slate-200">
              {t.facility_information}
            </h3>

            <div className="mt-4">
              <label htmlFor="org-total-area" className={labelClassName}>
                {t.total_area_label} <span className="text-red-500">*</span>
              </label>
              <input
                id="org-total-area"
                type="number"
                step="0.01"
                min="0"
                value={formData.total_area}
                onChange={(e) => handleFieldChange('total_area', e.target.value)}
                placeholder={t.total_area_placeholder}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label htmlFor="org-play-area" className={labelClassName}>
                {t.play_area_label} <span className="text-red-500">*</span>
              </label>
              <input
                id="org-play-area"
                type="number"
                step="0.01"
                min="0"
                value={formData.play_area}
                onChange={(e) => handleFieldChange('play_area', e.target.value)}
                placeholder={t.play_area_placeholder}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label htmlFor="org-square-meters-per-student" className={labelClassName}>
                {t.square_meters_per_student_label} <span className="text-red-500">*</span>
              </label>
              <input
                id="org-square-meters-per-student"
                type="number"
                step="0.01"
                min="0"
                value={formData.square_meters_per_student}
                onChange={(e) => handleFieldChange('square_meters_per_student', e.target.value)}
                placeholder={t.square_meters_per_student_placeholder}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label htmlFor="org-maximum-allowed-students" className={labelClassName}>
                {t.maximum_allowed_students_label} <span className="text-red-500">*</span>
              </label>
              <input
                id="org-maximum-allowed-students"
                type="number"
                step="1"
                min="1"
                value={formData.maximum_allowed_students}
                onChange={(e) => handleFieldChange('maximum_allowed_students', e.target.value)}
                placeholder={t.maximum_allowed_students_placeholder}
                className={inputClassName}
                required
              />
            </div>
          </div>

          {/* Settings Section */}
          <div className="space-y-ds-md">
            <h3 className="text-ds-h3 font-semibold text-[#1F2937] dark:text-slate-200">
              {t.settings}
            </h3>

            <div className="mt-4">
              <label htmlFor="org-timezone" className={labelClassName}>
                {t.timezone_label} <span className="text-red-500">*</span>
              </label>
              <input
                id="org-timezone"
                type="text"
                value={formData.timezone}
                onChange={(e) => handleFieldChange('timezone', e.target.value)}
                placeholder={t.timezone_placeholder}
                className={inputClassName}
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-ds-lg border-t border-slate-200 dark:border-slate-700">
            <button
              type="submit"
              disabled={loading || !!slugError}
              className="flex items-center gap-2 rounded-ds-md bg-[#C5E8D5] hover:bg-[#B0D9C0] active:bg-[#9BC9A8] dark:bg-mint-600 dark:hover:bg-mint-700 dark:active:bg-mint-800 px-6 py-3 text-ds-body font-medium text-[#1F2937] dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-ds-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t.saving}</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{t.save_changes}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
