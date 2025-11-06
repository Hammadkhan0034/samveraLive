'use client';

import { useState, useMemo, useEffect } from 'react';
import { createAnnouncement, updateAnnouncement } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';

interface AnnouncementFormProps {
  classId?: string;
  orgId?: string;
  onSuccess?: () => void;
  lang?: 'is' | 'en';
  showClassSelector?: boolean; // New prop to show class selector
  mode?: 'create' | 'edit';
  initialData?: {
    id: string;
    title: string;
    body: string;
    classId?: string;
  };
}

type Lang = 'is' | 'en';

export default function AnnouncementForm({ 
  classId: propClassId, 
  orgId, 
  onSuccess, 
  lang = 'en', 
  showClassSelector = false,
  mode = 'create',
  initialData
}: AnnouncementFormProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState(initialData?.title || '');
  const [body, setBody] = useState(initialData?.body || '');
  const [selectedClassId, setSelectedClassId] = useState<string>(initialData?.classId || propClassId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);

  // Update form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData && mode === 'edit') {
      setTitle(initialData.title || '');
      setBody(initialData.body || '');
      setSelectedClassId(initialData.classId || propClassId || '');
    }
  }, [initialData, mode, propClassId]);

  // Fetch teacher classes if showClassSelector is true
  useEffect(() => {
    if (showClassSelector && user?.id) {
      const fetchClasses = async () => {
        try {
          setLoadingClasses(true);
          const response = await fetch(`/api/teacher-classes?userId=${user.id}&t=${Date.now()}`, { cache: 'no-store' });
          const data = await response.json();

          if (response.ok && data.classes) {
            setClasses(data.classes || []);
          }
        } catch (err) {
          console.error('Error fetching teacher classes:', err);
        } finally {
          setLoadingClasses(false);
        }
      };

      fetchClasses();
    }
  }, [showClassSelector, user?.id]);

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
        const finalClassId = showClassSelector ? (selectedClassId || undefined) : (propClassId || undefined);
        if (finalClassId) payload.classId = finalClassId;
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
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
        {mode === 'edit' ? t.edit_announcement : t.create_announcement}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {showClassSelector && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t.class_label}
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
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
            {t.title}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
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
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
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
            className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600"
          >
            {t.clear}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-black dark:bg-black text-white rounded-md hover:bg-slate-900 disabled:opacity-50"
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

const enText = {
  create_announcement: 'Create Announcement',
  edit_announcement: 'Edit Announcement',
  update_announcement: 'Update Announcement',
  title: 'Title',
  title_placeholder: 'Enter announcement title',
  message: 'Message',
  message_placeholder: 'Enter announcement message',
  class_label: 'Class',
  select_class_optional: 'Select Class (Optional - Leave empty for Organization-wide)',
  loading_classes: 'Loading classes...',
  no_classes_available: 'No classes available',
  class_announcement_note: 'This announcement will be sent to the selected class only.',
  org_announcement_note: 'This announcement will be sent to the entire organization.',
  clear: 'Clear',
  creating: 'Creating...',
  updating: 'Updating...',
  fill_all_fields: 'Please fill in all fields',
  announcement_created: 'Announcement created successfully!',
  announcement_updated: 'Announcement updated successfully!',
  failed_to_create: 'Failed to create announcement',
  failed_to_update: 'Failed to update announcement',
};

const isText = {
  create_announcement: 'Búa til tilkynningu',
  edit_announcement: 'Breyta tilkynningu',
  update_announcement: 'Uppfæra tilkynningu',
  title: 'Titill',
  title_placeholder: 'Sláðu inn titil tilkynningar',
  message: 'Skilaboð',
  message_placeholder: 'Sláðu inn skilaboð tilkynningar',
  class_label: 'Hópur',
  select_class_optional: 'Veldu hóp (Valfrjálst - Skildu eftir tómt fyrir allan stofnun)',
  loading_classes: 'Hleður hópum...',
  no_classes_available: 'Engir hópar í boði',
  class_announcement_note: 'Þessi tilkynning verður send til valins hóps aðeins.',
  org_announcement_note: 'Þessi tilkynning verður send til allrar stofnunarinnar.',
  clear: 'Hreinsa',
  creating: 'Býr til...',
  updating: 'Uppfærir...',
  fill_all_fields: 'Vinsamlegast fylltu út öll reiti',
  announcement_created: 'Tilkynning búin til með góðum árangri!',
  announcement_updated: 'Tilkynning uppfærð með góðum árangri!',
  failed_to_create: 'Mistókst að búa til tilkynningu',
  failed_to_update: 'Mistókst að uppfæra tilkynningu',
};
