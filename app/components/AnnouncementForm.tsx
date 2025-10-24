'use client';

import { useState, useMemo } from 'react';
import { createAnnouncement } from '@/lib/server-actions';
import { useAuth } from '@/lib/hooks/useAuth';

interface AnnouncementFormProps {
  classId?: string;
  orgId?: string;
  onSuccess?: () => void;
  lang?: 'is' | 'en';
}

type Lang = 'is' | 'en';

export default function AnnouncementForm({ classId, orgId, onSuccess, lang = 'en' }: AnnouncementFormProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);

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
      const effectiveOrgId = orgId || (user?.user_metadata as any)?.org_id || (user?.user_metadata as any)?.organization_id;
      const payload: any = {
        title: title.trim(),
        body: body.trim(),
      };
      if (classId) payload.classId = classId;
      if (effectiveOrgId) payload.orgId = effectiveOrgId;

      await createAnnouncement(payload);

      setSuccess(t.announcement_created);
      setTitle('');
      setBody('');
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || t.failed_to_create);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
        {t.create_announcement}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
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

        {classId && (
          <div className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
            {t.class_announcement_note}
          </div>
        )}

        {!classId && (
          <div className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            {t.org_announcement_note}
          </div>
        )}

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
            {isSubmitting ? t.creating : t.create_announcement}
          </button>
        </div>
      </form>
    </div>
  );
}

const enText = {
  create_announcement: 'Create Announcement',
  title: 'Title',
  title_placeholder: 'Enter announcement title',
  message: 'Message',
  message_placeholder: 'Enter announcement message',
  class_announcement_note: 'This announcement will be sent to your class only.',
  org_announcement_note: 'This announcement will be sent to the entire organization.',
  clear: 'Clear',
  creating: 'Creating...',
  fill_all_fields: 'Please fill in all fields',
  announcement_created: 'Announcement created successfully!',
  failed_to_create: 'Failed to create announcement',
};

const isText = {
  create_announcement: 'Búa til tilkynningu',
  title: 'Titill',
  title_placeholder: 'Sláðu inn titil tilkynningar',
  message: 'Skilaboð',
  message_placeholder: 'Sláðu inn skilaboð tilkynningar',
  class_announcement_note: 'Þessi tilkynning verður send til hópsins þíns aðeins.',
  org_announcement_note: 'Þessi tilkynning verður send til allrar stofnunarinnar.',
  clear: 'Hreinsa',
  creating: 'Býr til...',
  fill_all_fields: 'Vinsamlegast fylltu út öll reiti',
  announcement_created: 'Tilkynning búin til með góðum árangri!',
  failed_to_create: 'Mistókst að búa til tilkynningu',
};
