'use client';

import { useState, useEffect } from 'react';
import { createAnnouncement, updateAnnouncement } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';

interface AnnouncementFormProps {
  classId?: string;
  orgId: string;
  onSuccess?: () => void;
  showClassSelector?: boolean; // New prop to show class selector
  mode?: 'create' | 'edit';
  initialData?: {
    id: string;
    title: string;
    body: string;
    classId?: string;
  };
}

export default function AnnouncementForm({ 
  classId: propClassId, 
  orgId, 
  onSuccess, 
  showClassSelector = false,
  mode = 'create',
  initialData
}: AnnouncementFormProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [title, setTitle] = useState(initialData?.title || '');
  const [body, setBody] = useState(initialData?.body || '');
  const [selectedClassId, setSelectedClassId] = useState<string>(initialData?.classId || propClassId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Update form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData && mode === 'edit') {
      setTitle(initialData.title || '');
      setBody(initialData.body || '');
      setSelectedClassId(initialData.classId || propClassId || '');
    }
  }, [initialData, mode, propClassId]);

  // Fetch classes if showClassSelector is true
  useEffect(() => {
    if (showClassSelector && user?.id) {
      const fetchClasses = async () => {
        try {
          setLoadingClasses(true);
          
          // Determine user role
          const userMetadata = user?.user_metadata as any;
          const role = userMetadata?.role || userMetadata?.activeRole || 
            (Array.isArray(userMetadata?.roles) ? userMetadata.roles[0] : '');
          const roleLower = role?.toString().toLowerCase() || '';
          const isPrincipal = roleLower === 'principal' || roleLower === 'admin';
          
          // Get orgId
          const effectiveOrgId = orgId || userMetadata?.org_id || userMetadata?.organization_id;
          
          let response;
          if (isPrincipal && effectiveOrgId) {
            // For principals/admins: load all organization classes
            response = await fetch(`/api/classes?t=${Date.now()}`, { cache: 'no-store' });
            const data = await response.json();
            
            if (response.ok && data.classes) {
              setClasses(data.classes.map((c: any) => ({ id: c.id, name: c.name })) || []);
            }
          } else {
            // For teachers: load only their assigned classes
            response = await fetch(`/api/teacher-classes?userId=${user.id}&t=${Date.now()}`, { cache: 'no-store' });
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

      fetchClasses();
    }
  }, [showClassSelector, user?.id, orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError(t.fill_all_fields);
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'edit' && initialData?.id) {
        // Update existing announcement
        const finalClassId = showClassSelector ? (selectedClassId || undefined) : (propClassId || undefined);
        await updateAnnouncement(initialData.id, {
          title: title.trim(),
          body: body.trim(),
          classId: finalClassId,
        });

        setSuccess(t.announcement_updated);
      } else {
        // Create new announcement
        const effectiveOrgId = orgId || (user?.user_metadata as any)?.org_id || (user?.user_metadata as any)?.organization_id;
        const payload: any = {
          title: title.trim(),
          body: body.trim(),
        };
        // Use selectedClassId if showClassSelector is enabled, otherwise use propClassId
        // For org-wide announcements (empty string), explicitly set to null to distinguish from undefined
        const finalClassId = showClassSelector 
          ? (selectedClassId && selectedClassId.trim() !== '' ? selectedClassId : null)
          : (propClassId || null);
        // Always set classId (null for org-wide, or the class ID for class-specific)
        // This allows createAnnouncement to distinguish between "not provided" and "explicitly org-wide"
        payload.classId = finalClassId;
        if (effectiveOrgId) payload.orgId = effectiveOrgId;

        await createAnnouncement(payload);

        setSuccess(t.announcement_created);
        setTitle('');
        setBody('');
        if (showClassSelector) {
          setSelectedClassId('');
        }
      }

      // Trigger refresh event for all announcement lists
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('announcements-refresh'));
      }

      onSuccess?.();
    } catch (err: any) {
      setError(err.message || (mode === 'edit' ? t.failed_to_update : t.failed_to_create));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        {showClassSelector && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t.class_label}
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:bg-slate-700 dark:text-slate-200"
            >
              <option value="">{t.select_class_optional}</option>
              {loadingClasses ? (
                <option disabled>{t.loading_classes}</option>
              ) : classes.length === 0 ? (
                <option disabled>{t.no_classes_available}</option>
              ) : (
                classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              {selectedClassId ? t.class_announcement_note : t.org_announcement_note}
            </p>
          </div>
        )}

        {!showClassSelector && propClassId && (
          <div className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
            {t.class_announcement_note}
          </div>
        )}

        {!showClassSelector && !propClassId && (
          <div className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            {t.org_announcement_note}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            {t.announcement_title_label}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-md border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            placeholder={t.title_placeholder}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            {t.message}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            placeholder={t.message_placeholder}
            required
          />
        </div>

        {error && (
          <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            {success}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setTitle('');
              setBody('');
              setError('');
              setSuccess('');
              if (showClassSelector) {
                setSelectedClassId('');
              }
            }}
            className="px-4 py-2 text-md text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600"
          >
            {t.clear}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-ds-body bg-mint-500 text-white rounded-ds-md hover:bg-mint-600 disabled:opacity-50 transition-colors"
          >
            {isSubmitting
              ? (mode === 'edit' ? t.updating : t.creating)
              : (mode === 'edit' ? t.update_announcement : t.create_announcement)}
          </button>
        </div>
      </form>
    </div>
  );
}
