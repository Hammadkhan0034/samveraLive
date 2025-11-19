'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { GuardianForm, type GuardianFormData } from '@/app/components/shared/GuardianForm';

function AddGuardianPageContent() {
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

  const finalOrgId = ((orgId ?? dbOrgId) ?? process.env.NEXT_PUBLIC_DEFAULT_ORG_ID) ?? '';

  // orgs (for validation/display if needed)
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    const loadOrgs = async () => {
      try {
        const res = await fetch('/api/orgs', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok) setOrgs((json.orgs || []).map((o: any) => ({ id: o.id, name: o.name })));
      } catch {}
    };
    loadOrgs();
  }, []);

  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingGuardian, setEditingGuardian] = useState<GuardianFormData | null>(null);

  // Load a guardian for editing if id is present
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) { setEditingGuardian(null); return; }
    const loadGuardian = async () => {
      try {
        const res = await fetch(`/api/guardians?id=${encodeURIComponent(id)}&orgId=${encodeURIComponent(finalOrgId)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
        const g = json.guardian || json.guardians?.find((x: any) => x.id === id);
        if (g) {
          setEditingGuardian({
            id: g.id,
            first_name: g.first_name ?? ((g.full_name || '').split(' ')[0] || ''),
            last_name: g.last_name ?? (((g.full_name || '').split(' ').slice(1).join(' ')) || ''),
            email: g.email || '',
            phone: g.phone || '',
            ssn: g.ssn || '',
            address: g.address || '',
            org_id: g.org_id || finalOrgId,
            is_active: g.is_active ?? true,
          });
        }
      } catch (e) {
        console.error('Error loading guardian by id:', e);
      }
    };
    loadGuardian();
  }, [searchParams, finalOrgId]);

  async function submitGuardian(data: GuardianFormData) {
    try {
      setError(null);
      setSuccessMessage(null);
      setLoadingSubmit(true);
      const res = await fetch('/api/guardians', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json?.error || `Request failed with status ${res.status}`);
      
      // If creating new guardian (not editing), show success message
      if (!data.id) {
        setSuccessMessage(t.guardian_created);
        // Auto-hide after 3 seconds and redirect
        setTimeout(() => {
          router.back();
        }, 1000);
      } else {
        // If editing, redirect immediately
        router.back();
      }
    } catch (e: any) {
      setError(e.message);
      setSuccessMessage(null);
    } finally {
      setLoadingSubmit(false);
    }
  }


  const showInitialLoading = loading && !user && isSigningIn;
  if (showInitialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading add guardian…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 mt-10 ml-20">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                <ArrowLeft className="h-4 w-4" /> {t.back}
              </button>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{editingGuardian?.id ? t.edit_guardian : t.title}</h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{editingGuardian?.id ? '' : t.subtitle}</p>
              </div>
            </div>
          </div>

          <GuardianForm
            asPage={true}
            isOpen={true}
            onClose={() => router.back()}
            onSubmit={submitGuardian}
            initialData={editingGuardian || {
              first_name: '', last_name: '', email: '', phone: '', ssn: '', address: '', org_id: finalOrgId || '', is_active: true
            }}
            loading={loadingSubmit}
            error={error}
            successMessage={successMessage}
            orgs={orgs}
            translations={{
              create_guardian: t.create_guardian,
              edit_guardian: t.edit_guardian,
              first_name: t.first_name,
              last_name: t.last_name,
              email: t.email,
              phone: t.phone,
              organization: t.organization,
              status: t.status,
              active: t.active,
              inactive: t.inactive,
              create: t.create,
              update: t.update,
              cancel: t.cancel,
              creating: t.creating,
              updating: t.updating,
              first_name_placeholder: t.first_name_placeholder,
              last_name_placeholder: t.last_name_placeholder,
              email_placeholder: t.email_placeholder,
              phone_placeholder: t.phone_placeholder,
              status_placeholder: t.status_placeholder,
              ssn: t.ssn,
              ssn_placeholder: t.ssn_placeholder,
              address: t.address,
              address_placeholder: t.address_placeholder,
            }}
          />
      </main>
    </div>
  );
}

// Translations removed - using centralized translations from @/lib/translations

export default function AddGuardianPage() {
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
      <AddGuardianPageContent />
    </Suspense>
  );
}
