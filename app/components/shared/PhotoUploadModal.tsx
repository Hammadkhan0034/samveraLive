'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { Student } from '@/lib/types/attendance';

export type UploadMode = 'org' | 'class' | 'student';

export interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  classes: Array<{ id: string; name: string }>;
  students: Student[];
}

interface PreviewFile {
  file: File;
  preview: string;
  id: string;
}

export function PhotoUploadModal({
  isOpen,
  onClose,
  onSuccess,
  classes,
  students,
}: PhotoUploadModalProps) {
  const { t } = useLanguage();
  const [uploadMode, setUploadMode] = useState<UploadMode>('org');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [caption, setCaption] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter students by selected class
  const filteredStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return students.filter((student) => student.class_id === selectedClassId);
  }, [students, selectedClassId]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setUploadMode('org');
      setSelectedClassId(null);
      setSelectedStudentId(null);
      setPreviewFiles([]);
      setCaption('');
      setIsPublic(false);
      setError(null);
    }
  }, [isOpen]);

  // Reset student selection when class changes
  useEffect(() => {
    setSelectedStudentId(null);
  }, [selectedClassId]);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: PreviewFile[] = [];
    Array.from(files).forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError(`File ${file.name} is not an image`);
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`File ${file.name} is too large (max 10MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const preview = reader.result as string;
        newFiles.push({
          file,
          preview,
          id: `${Date.now()}_${Math.random()}`,
        });

        if (newFiles.length === files.length) {
          setPreviewFiles((prev) => [...prev, ...newFiles]);
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePreview = (id: string) => {
    setPreviewFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.files = files;
    const event = new Event('change', { bubbles: true });
    input.dispatchEvent(event);
    handleFileSelect({ target: input } as any);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (previewFiles.length === 0) {
      setError(t.no_items_error || 'Please select at least one image');
      return;
    }

    if (uploadMode === 'class' && !selectedClassId) {
      setError(t.select_class || 'Please select a class');
      return;
    }

    if (uploadMode === 'student' && (!selectedClassId || !selectedStudentId)) {
      setError((t.select_class || 'Please select a class') + ' and ' + (t.select_student || 'student'));
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      
      // Add files
      previewFiles.forEach((previewFile) => {
        formData.append('files', previewFile.file);
      });

      // Add metadata
      formData.append('class_id', uploadMode === 'org' ? '' : (selectedClassId || ''));
      formData.append('student_id', uploadMode === 'student' ? (selectedStudentId || '') : '');
      formData.append('caption', caption);
      formData.append('is_public', isPublic ? 'true' : 'false');

      const response = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload photos');
      }

      // Success
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to upload photos');
      }
    } finally {
      setLoading(false);
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
      <div className="w-full max-w-3xl rounded-ds-lg bg-white dark:bg-slate-800 p-4 sm:p-ds-md shadow-ds-lg max-h-[95vh] overflow-y-auto">
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <h3 className="text-ds-small sm:text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
            {t.upload_photos || 'Upload Photos'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 active:bg-mint-200 dark:active:bg-slate-600 transition-colors"
            disabled={loading}
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
          {/* Upload Mode Dropdown */}
          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.upload_type || 'Upload Type'} <span className="text-red-500">*</span>
            </label>
            <select
              value={uploadMode}
              onChange={(e) => {
                const mode = e.target.value as UploadMode;
                setUploadMode(mode);
                if (mode === 'org') {
                  setSelectedClassId(null);
                  setSelectedStudentId(null);
                } else if (mode === 'class') {
                  setSelectedStudentId(null);
                }
              }}
              className="w-full rounded-ds-md border border-slate-300 px-3 sm:px-4 py-2 text-ds-tiny sm:text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 mt-1"
              required
              disabled={loading}
            >
              <option value="org">{t.org_base || 'Org Base'}</option>
              <option value="class">{t.class_base || 'Class Base'}</option>
              <option value="student">{t.student_base || 'Student Base'}</option>
            </select>
          </div>

          {/* Class Selection (for class and student modes) */}
          {(uploadMode === 'class' || uploadMode === 'student') && (
            <div>
              <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.class_label || 'Class'} <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedClassId || ''}
                onChange={(e) => setSelectedClassId(e.target.value || null)}
                className="w-full rounded-ds-md border border-slate-300 px-3 sm:px-4 py-2 text-ds-tiny sm:text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                required={uploadMode === 'class' || uploadMode === 'student'}
              >
                <option value="">{t.select_class || 'Select a class'}</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Student Selection (for student mode only) */}
          {uploadMode === 'student' && (
            <div>
              <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.student_name || 'Student'} <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedStudentId || ''}
                onChange={(e) => setSelectedStudentId(e.target.value || null)}
                className="w-full rounded-ds-md border border-slate-300 px-3 sm:px-4 py-2 text-ds-tiny sm:text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                required
                disabled={!selectedClassId}
              >
                <option value="">
                  {selectedClassId ? (t.select_student || 'Select a student') : (t.select_class_first || 'Select a class first')}
                </option>
                {filteredStudents.map((student) => {
                  const firstName = student.users?.first_name || student.first_name || '';
                  const lastName = student.users?.last_name || student.last_name || '';
                  const fullName = `${firstName} ${lastName}`.trim() || `Student ${student.id.slice(0, 8)}`;
                  return (
                    <option key={student.id} value={student.id}>
                      {fullName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* File Upload Area */}
          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.photos || 'Photos'}
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-ds-md p-4 sm:p-8 text-center hover:border-mint-400 dark:hover:border-slate-500 transition-colors mt-1"
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="photo-upload-input"
                disabled={loading}
              />
              <label
                htmlFor="photo-upload-input"
                className="cursor-pointer flex flex-col items-center gap-1.5 sm:gap-2"
              >
                <ImageIcon className="h-8 w-8 sm:h-12 sm:w-12 text-slate-400 dark:text-slate-500" />
                <div className="text-ds-tiny sm:text-ds-small text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-mint-600 dark:text-mint-400">Click to upload</span> or drag and drop
                </div>
                <div className="text-ds-tiny text-slate-500 dark:text-slate-500">
                  PNG, JPG, GIF up to 10MB
                </div>
              </label>
            </div>
          </div>

          {/* Preview Grid */}
          {previewFiles.length > 0 && (
            <div>
              <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-2">
                Preview ({previewFiles.length} {previewFiles.length === 1 ? 'photo' : 'photos'})
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
                {previewFiles.map((previewFile) => (
                  <div key={previewFile.id} className="relative group">
                    <div className="aspect-square rounded-ds-md overflow-hidden bg-slate-100 dark:bg-slate-700">
                      <img
                        src={previewFile.preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePreview(previewFile.id)}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-1 opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      disabled={loading}
                    >
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Caption */}
          <div>
            <label className="block text-ds-tiny sm:text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.caption_optional || 'Caption (Optional)'}
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              className="w-full rounded-ds-md border border-slate-300 px-3 sm:px-4 py-2 text-ds-tiny sm:text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 mt-1"
              placeholder={t.caption_optional || 'Add a caption for these photos...'}
              disabled={loading}
            />
          </div>

          {/* Public/Private Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_public"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-slate-300 text-mint-600 focus:ring-mint-500"
              disabled={loading}
            />
            <label htmlFor="is_public" className="text-ds-tiny sm:text-ds-small text-slate-700 dark:text-slate-300">
              {t.make_photos_public || 'Make photos public'}
            </label>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 text-ds-tiny sm:text-ds-small font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-ds-md hover:bg-mint-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors active:bg-mint-100 dark:active:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || previewFiles.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-ds-md bg-mint-500 px-3 sm:px-4 py-2 text-ds-tiny sm:text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 transition-colors active:bg-mint-700"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-white border-t-transparent flex-shrink-0" />
                  <span className="hidden sm:inline">{t.uploading || 'Uploading...'}</span>
                  <span className="sm:hidden">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{t.upload || 'Upload'} {previewFiles.length > 0 && `(${previewFiles.length})`}</span>
                  <span className="sm:hidden">{t.upload || 'Upload'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

