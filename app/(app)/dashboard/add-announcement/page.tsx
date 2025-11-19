'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import AnnouncementForm from '@/app/components/AnnouncementForm';

function AddAnnouncementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, isSigningIn } = useRequireAuth();
  const { t } = useLanguage();

  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const [dbOrgId, setDbOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id && !orgId) {
      const fetchUserOrgId = async () => {
        try {
          const response = await fetch(`/api/user-org-id?user_id=${user.id}`);
          const data = await response.json();
          if (response.ok && data.org_id) {
            setDbOrgId(data.org_id);
          }
        } catch (error) {
          console.error('Failed to fetch user org_id:', error);
        }
      };
      fetchUserOrgId();
    }
  }, [user?.id, orgId]);

  const finalOrgId = orgId || dbOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '';

  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<{
    id: string;
    title: string;
    body: string;
    classId?: string;
  } | null>(null);

  // Load announcement for editing if id is present
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) {
      setEditingAnnouncement(null);
      return;
    }
    const loadAnnouncement = async () => {
      try {
        const res = await fetch(`/api/announcements?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
        const announcement = json.announcement || json.announcements?.find((x: any) => x.id === id);
        if (announcement) {
          setEditingAnnouncement({
            id: announcement.id,
            title: announcement.title || '',
            body: announcement.body || '',
            classId: announcement.class_id || undefined,
          });
        }
      } catch (e) {
        console.error('Error loading announcement by id:', e);
        setError('Failed to load announcement');
      }
    };
    loadAnnouncement();
  }, [searchParams]);

  const handleSuccess = () => {
    // Trigger refresh event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('announcements-refresh'));
    }
    router.push('/dashboard/announcements');
  };

  const showInitialLoading = loading && !user && isSigningIn;
  if (showInitialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">{t.loading}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6  ml-20">
        <div className="mb-6 flex flex-col gap-3 mt-14 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {editingAnnouncement?.id ? t.edit_announcement : t.add_announcement || 'Add Announcement'}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {editingAnnouncement?.id ? '' : t.add_announcement_subtitle || 'Create a new announcement for your organization or classes.'}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <AnnouncementForm
            mode={editingAnnouncement?.id ? 'edit' : 'create'}
            initialData={editingAnnouncement || undefined}
            orgId={finalOrgId}
            onSuccess={handleSuccess}
            showClassSelector={true}
          />
        </div>
      </main>
    </div>
  );
}

// Translations removed - using centralized translations from @/lib/translations

export default function AddAnnouncementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <AddAnnouncementContent />
    </Suspense>
  );
}

