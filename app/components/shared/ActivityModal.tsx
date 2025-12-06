'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/hooks/useAuth';
import { createBrowserClient } from '@supabase/ssr';
import type { DailyLogWithRelations } from '@/lib/types/daily-logs';

export interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: DailyLogWithRelations | null;
  classes?: Array<{ id: string; name: string }>;
}

export function ActivityModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  classes: propClasses,
}: ActivityModalProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    class_id: '',
    recorded_at: new Date().toISOString().slice(0, 16),
    note: '',
    image: null as string | null,
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>(
    propClasses || [],
  );
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Get user role to determine class fetching
  const userMetadata = user?.user_metadata as any;
  const role = userMetadata?.role || userMetadata?.activeRole || 
    (Array.isArray(userMetadata?.roles) ? userMetadata.roles[0] : '');
  const roleLower = role?.toString().toLowerCase() || '';
  const isTeacher = roleLower === 'teacher';
  const isPrincipal = roleLower === 'principal' || roleLower === 'admin';

  // Load classes if not provided
  useEffect(() => {
    if (isOpen && !propClasses && user?.id) {
      const loadClasses = async () => {
        try {
          setLoadingClasses(true);
          let response;
          
          if (isPrincipal) {
            // For principals/admins: load all organization classes
            response = await fetch(`/api/classes?t=${Date.now()}`, { cache: 'no-store' });
            const data = await response.json();
            
            if (response.ok && data.classes) {
              setClasses(data.classes.map((c: any) => ({ id: c.id, name: c.name })) || []);
            }
          } else if (isTeacher) {
            // For teachers: load only their assigned classes
            response = await fetch(`/api/teacher-classes?t=${Date.now()}`, { cache: 'no-store' });
            const data = await response.json();

            if (response.ok && data.classes) {
              setClasses(data.classes || []);
            }
          }
        } catch (err) {
          console.error('Error fetching classes:', err);
        } finally {
          setLoadingClasses(false);
        }
      };

      loadClasses();
    }
  }, [isOpen, propClasses, user, isTeacher, isPrincipal]);

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          class_id: initialData.class_id || '',
          recorded_at: initialData.recorded_at
            ? new Date(initialData.recorded_at).toISOString().slice(0, 16)
            : new Date().toISOString().slice(0, 16),
          note: initialData.note || '',
          image: initialData.image || null,
        });
        setImagePreview(initialData.image || null);
        setSelectedImage(null);
      } else {
        // Reset to defaults for new activity
        setFormData({
          class_id: '',
          recorded_at: new Date().toISOString().slice(0, 16),
          note: '',
          image: null,
        });
        setImagePreview(null);
        setSelectedImage(null);
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size must be less than 10MB');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload image to Supabase Storage
  const uploadImageToStorage = async (file: File): Promise<string> => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // Get org_id from user metadata
    const orgId = userMetadata?.org_id;
    if (!orgId) {
      throw new Error('Organization ID not found');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileName = `${timestamp}_${randomId}.${fileExt}`;
    const filePath = `${orgId}/activity-images/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('activity-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('activity-images')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get image URL after upload');
    }

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.note.trim()) {
      setError('Please enter a description');
      return;
    }

    setSubmitting(true);

    try {
      let imageUrl = formData.image;

      // Upload new image if selected
      if (selectedImage) {
        setUploadingImage(true);
        try {
          imageUrl = await uploadImageToStorage(selectedImage);
        } catch (uploadErr) {
          setError(uploadErr instanceof Error ? uploadErr.message : 'Failed to upload image');
          setSubmitting(false);
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      // Convert datetime-local to ISO string
      const recordedAtISO = new Date(formData.recorded_at).toISOString();

      const url = '/api/daily-logs';
      const method = initialData ? 'PUT' : 'POST';

      const body = initialData
        ? {
            id: initialData.id,
            class_id: formData.class_id || null,
            recorded_at: recordedAtISO,
            note: formData.note,
            image: imageUrl,
            kind: 'activity' as const,
            public: false,
          }
        : {
            class_id: formData.class_id || null,
            recorded_at: recordedAtISO,
            note: formData.note,
            image: imageUrl,
            kind: 'activity' as const,
            public: false,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      // Call success callback
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('❌ Error submitting activity:', err.message);
      setError(err.message || 'Failed to submit activity');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl rounded-ds-lg bg-white dark:bg-slate-800 p-4 sm:p-ds-md shadow-ds-lg max-h-[95vh] overflow-y-auto">
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <h3 className="text-ds-small sm:text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
            {initialData ? (t.edit_activity || 'Edit Activity') : (t.add_activity || 'Add Activity')}
          </h3>
          <button
            onClick={onClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 active:bg-mint-200 dark:active:bg-slate-600 transition-colors"
            disabled={submitting || uploadingImage}
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 sm:mb-4 rounded-ds-md bg-red-50 border border-red-200 px-3 sm:px-4 py-2 sm:py-3 text-ds-tiny sm:text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {/* Date */}
          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.date || 'Date'} <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.recorded_at}
              onChange={(e) => setFormData({ ...formData, recorded_at: e.target.value })}
              className="w-full h-10 sm:h-12 rounded-ds-sm border border-input-stroke bg-input-fill px-3 sm:px-4 py-3 text-ds-body text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-2 focus:ring-mint-500/20 hover:border-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              required
              disabled={submitting || uploadingImage}
            />
          </div>

          {/* Class Selector */}
          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.class_label || 'Class'}
            </label>
            {loadingClasses ? (
              <div className="text-ds-tiny sm:text-ds-small text-slate-500 dark:text-slate-400">
                {t.loading || 'Loading...'}
              </div>
            ) : (
              <select
                value={formData.class_id}
                onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                className="w-full h-10 sm:h-12 rounded-ds-sm border border-input-stroke bg-input-fill px-3 sm:px-4 py-3 text-ds-body text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-2 focus:ring-mint-500/20 hover:border-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                disabled={submitting || uploadingImage}
              >
                <option value="">{t.all_classes || 'All Classes'}</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.description || 'Description'} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={4}
              className="w-full min-h-[120px] rounded-ds-sm border border-input-stroke bg-input-fill px-3 sm:px-4 py-3 text-ds-body text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-2 focus:ring-mint-500/20 hover:border-mint-500 resize-y dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              placeholder={t.activity_description_placeholder || 'Enter activity description...'}
              required
              disabled={submitting || uploadingImage}
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.photo || 'Photo'} ({t.optional || 'Optional'})
            </label>
            <div className="space-y-2">
              {imagePreview && (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-ds-sm border border-input-stroke dark:border-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setSelectedImage(null);
                      setFormData({ ...formData, image: null });
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    disabled={submitting || uploadingImage}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {!imagePreview && (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-input-stroke dark:border-slate-600 rounded-ds-sm cursor-pointer hover:border-mint-500 dark:hover:border-slate-500 transition-colors bg-input-fill dark:bg-slate-700">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon className="w-8 h-8 mb-2 text-slate-400" />
                    <p className="text-ds-tiny sm:text-ds-small text-slate-500 dark:text-slate-400">
                      {t.click_to_upload || 'Click to upload'} {t.photo || 'photo'}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={submitting || uploadingImage}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-ds-md border border-slate-300 dark:border-slate-600 text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              disabled={submitting || uploadingImage}
            >
              {t.cancel || 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-initial px-4 py-2 rounded-ds-md bg-mint-500 text-white text-ds-small font-medium hover:bg-mint-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:hover:bg-slate-600"
              disabled={submitting || uploadingImage}
            >
              {uploadingImage
                ? t.uploading || 'Uploading...'
                : submitting
                  ? t.saving || 'Saving...'
                  : initialData
                    ? t.save || 'Save'
                    : t.create || 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

