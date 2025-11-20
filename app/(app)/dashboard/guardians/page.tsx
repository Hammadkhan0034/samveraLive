'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Plus, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { type GuardianFormData } from '@/app/components/shared/GuardianForm';
import { GuardianTable } from '@/app/components/shared/GuardianTable';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import TeacherLayout from '@/app/components/shared/TeacherLayout';
import Loading from '@/app/components/shared/Loading';

type Lang = 'is' | 'en';

export default function GuardiansPage() {
  const { t, lang } = useLanguage();
  const { user, loading, isSigningIn } = useRequireAuth();
  const router = useRouter();

  // Try to get org_id from multiple possible locations
  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  
  // If no org_id in metadata, we need to get it from the database
  const [dbOrgId, setDbOrgId] = useState<string | null>(null);
  
  // Fetch org_id from database if not in metadata
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
  
  const finalOrgId = orgId || dbOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;

  // Guardian states - initialize with cached data
  const [guardians, setGuardians] = useState<Array<any>>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('guardians_cache');
      return cached ? JSON.parse(cached) : [];
    }
    return [];
  });
  // const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [submittingGuardian, setSubmittingGuardian] = useState(false);
  const [deletingGuardian, setDeletingGuardian] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [guardianForm, setGuardianForm] = useState<GuardianFormData>({ first_name: '', last_name: '', email: '', phone: '', org_id: '', is_active: true });
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [isDeleteGuardianModalOpen, setIsDeleteGuardianModalOpen] = useState(false);
  const [guardianToDelete, setGuardianToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Organizations states (needed for guardian form)
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string; timezone: string }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // Language handled by global context


  // Load data on mount - start immediately
  useEffect(() => {
    loadGuardians();
    loadOrgs();
  }, []);

  // Also load when user and orgId are available
  useEffect(() => {
    if (user?.id && finalOrgId) {
      loadGuardians(false);
      loadOrgs(false);
    }
  }, [user?.id, finalOrgId]);

  // Load guardians
  async function loadGuardians(showLoading = true) {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;

    try {
      if (showLoading) {
        // setLoadingGuardians(true);
      }
      setGuardianError(null);

      const res = await fetch(`/api/guardians?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const guardiansList = json.guardians || [];
      setGuardians(guardiansList);
      
      // Cache the data for instant loading
      if (typeof window !== 'undefined') {
        localStorage.setItem('guardians_cache', JSON.stringify(guardiansList));
      }
    } catch (e: any) {
      console.error('❌ Error loading guardians:', e.message);
      setGuardianError(e.message);
    } finally {
      if (showLoading) {
        // setLoadingGuardians(false);
      }
    }
  }

  // Load organizations
  async function loadOrgs(showLoading = true) {
    try {
      if (showLoading) setLoadingOrgs(true);
      const res = await fetch('/api/orgs', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setOrgs(json.orgs || []);
    } catch (e: any) {
      console.error('❌ Error loading organizations:', e.message);
    } finally {
      if (showLoading) setLoadingOrgs(false);
    }
  }

  // Guardian form submission
  async function submitGuardian(data: GuardianFormData) {
    try {
      setGuardianError(null);
      setSubmittingGuardian(true);

      console.log('🔄 Submitting guardian:', data);
      console.log('📡 Request method:', data.id ? 'PUT' : 'POST');
      console.log('📡 Request URL:', '/api/guardians');

      const res = await fetch('/api/guardians', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      console.log('📡 Response status:', res.status);
      console.log('📡 Response headers:', Object.fromEntries(res.headers.entries()));

      let json: any = {};
      try {
        const text = await res.text();
        if (text) {
          json = JSON.parse(text);
        }
      } catch (parseError) {
        console.error('❌ JSON parsing error:', parseError);
        console.error('❌ Response status:', res.status);
        console.error('❌ Response headers:', res.headers);
        throw new Error(`Server error: ${res.status} - ${res.statusText}`);
      }
      
      if (!res.ok) {
        const errorMsg = json?.error || `Request failed with status ${res.status}`;
        console.error('❌ API Error:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ Guardian created/updated successfully');

      // Close modal and reset form
      setIsGuardianModalOpen(false);
      setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', org_id: finalOrgId || '', is_active: true });

      // Refresh guardians list
      await loadGuardians(false);
    } catch (e: any) {
      console.error('❌ Error submitting guardian:', e.message);
      setGuardianError(e.message);
    } finally {
      setSubmittingGuardian(false);
    }
  }

  // Guardian modal handlers
  function openCreateGuardianModal() {
    router.push('/dashboard/add-guardian');
  }

  function openEditGuardianModal(guardian: any) {
    router.push(`/dashboard/add-guardian?id=${encodeURIComponent(guardian.id)}`);
  }

  function openDeleteGuardianModal(id: string) {
    setGuardianToDelete(id);
    setIsDeleteGuardianModalOpen(true);
  }

  async function confirmDeleteGuardian() {
    if (!guardianToDelete) return;
    try {
      setGuardianError(null);
      setDeletingGuardian(true);
      console.log('🗑️ Deleting guardian ID:', guardianToDelete);
      console.log('📡 Request method: DELETE');
      console.log('📡 Request URL:', `/api/guardians?id=${encodeURIComponent(guardianToDelete)}`);

      const res = await fetch(`/api/guardians?id=${encodeURIComponent(guardianToDelete)}`, { method: 'DELETE' });
      
      let json: any = {};
      try {
        const text = await res.text();
        if (text) {
          json = JSON.parse(text);
        }
      } catch (parseError) {
        console.error('❌ Delete JSON parsing error:', parseError);
      }
      
      if (!res.ok) {
        const errorMsg = json?.error || `Delete failed with status ${res.status}`;
        console.error('❌ Delete API Error:', errorMsg);
        throw new Error(errorMsg);
      }
      setIsDeleteGuardianModalOpen(false);
      setGuardianToDelete(null);
      await loadGuardians(false);
    } catch (e: any) {
      setGuardianError(e.message);
    } finally {
      setDeletingGuardian(false);
    }
  }

  // Only show loading if we're actually loading and don't have a user yet
  if (loading && !user && isSigningIn) {
    return <Loading fullScreen text="Loading guardians page..." />;
  }

  if (!user) return null;

  // Check if user is a teacher
  const role = (userMetadata?.role || userMetadata?.user_role || userMetadata?.app_role || userMetadata?.activeRole || '').toString().toLowerCase();
  const isTeacher = role === 'teacher' || (userMetadata?.roles && Array.isArray(userMetadata.roles) && userMetadata.roles.includes('teacher'));

  const content = (
      <div className="h-full bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-36 md:px-6">
          {/* Header with Back button */}
          <div className="mb-6 flex items-center gap-3 flex-wrap mt-14">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {lang === 'is' ? 'Til baka' : 'Back'}
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.guardians}</h1>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={openCreateGuardianModal}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Plus className="h-4 w-4" /> {t.add_guardian}
              </button>
            </div>
          </div>

      {/* Guardians Table */}
      <div className="rounded-2xl border border-slate-200 bg-white pt-6 px-6 pb-0 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.guardians}</h2>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder={'Search guardians...'}
              className="pl-3 pr-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 w-64"
            />
          </div>
        </div>
        <GuardianTable
          key={lang}
          guardians={(searchQuery ? guardians.filter((g: any) => {
            const q = searchQuery.trim().toLowerCase();
            const first = ((g.first_name ?? ((g.full_name || '').split(/\s+/)[0] || ''))).toLowerCase();
            const last = ((g.last_name ?? (((g.full_name || '').split(/\s+/).slice(1).join(' ')) || ''))).toLowerCase();
            const email = ((g.email || '')).toLowerCase();
            return first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q) || email.includes(q);
          }) : guardians).slice((currentPage-1)*itemsPerPage, (currentPage-1)*itemsPerPage + itemsPerPage).map((g: any) => ({
            id: g.id,
            first_name: g.first_name ?? ((g.full_name || '').trim().split(/\s+/)[0] || ''),
            last_name: g.last_name ?? ((g.full_name || '').trim().split(/\s+/).slice(1).join(' ') || ''),
            email: g.email ?? null,
            phone: g.phone ?? null,
            is_active: g.is_active ?? true,
          }))}
          error={guardianError}
          onEdit={openEditGuardianModal}
          onDelete={openDeleteGuardianModal}
          onCreate={openCreateGuardianModal}
          translations={{
            guardians: t.guardians,
            first_name: t.first_name || 'First Name',
            last_name: t.last_name || 'Last Name',
            email: t.email,
            phone: t.phone,
            status: t.status,
            active: t.active,
            inactive: t.inactive,
            actions: t.actions,
            create: t.create,
            no_guardians: t.no_guardians,
            no_guardians_loading: t.no_guardians_loading,
            edit: t.edit,
            delete: t.delete,
            send_magic_link: t.send_magic_link,
            sending: t.sending,
            magic_link_sent: t.magic_link_sent,
            magic_link_send_failed: t.magic_link_send_failed,
            no_students_linked: t.no_students_linked
          }}
        />
        {/* Pagination controls */}
        <div className="mt-4 mb-6 w-full flex justify-end gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {'Prev'}
          </button>
          {Array.from({ length: Math.max(1, Math.ceil((searchQuery ? guardians.filter((g: any) => {
            const q = searchQuery.trim().toLowerCase();
            const first = ((g.first_name ?? ((g.full_name || '').split(/\s+/)[0] || ''))).toLowerCase();
            const last = ((g.last_name ?? (((g.full_name || '').split(/\s+/).slice(1).join(' ')) || ''))).toLowerCase();
            const email = ((g.email || '')).toLowerCase();
            return first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q) || email.includes(q);
          }) : guardians).length / itemsPerPage)) }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx + 1)}
              className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm ${currentPage === idx + 1 ? 'bg-white text-black border border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600' : 'border border-slate-400 dark:border-slate-600 dark:text-slate-200'}`}
            >
              {idx + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={((currentPage)*itemsPerPage) >= (searchQuery ? guardians.filter((g: any) => {
              const q = searchQuery.trim().toLowerCase();
              const first = ((g.first_name ?? ((g.full_name || '').split(/\s+/)[0] || ''))).toLowerCase();
              const last = ((g.last_name ?? (((g.full_name || '').split(/\s+/).slice(1).join(' ')) || ''))).toLowerCase();
              const email = ((g.email || '')).toLowerCase();
              return first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q) || email.includes(q);
            }).length : guardians.length)}
            className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {'Next'}
          </button>
        </div>
      </div>

      {/* Guardian form now lives on dedicated page */}

      {/* Delete Guardian Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteGuardianModalOpen}
        onClose={() => setIsDeleteGuardianModalOpen(false)}
        onConfirm={confirmDeleteGuardian}
        title={t.delete_guardian}
        message={t.delete_guardian_confirm}
        loading={deletingGuardian}
        error={guardianError}
        translations={{
          confirm_delete: t.delete,
          cancel: t.cancel
        }}
        />
        </div>
      </div>
  );

  // Only wrap with TeacherLayout if user is a teacher
  if (isTeacher) {
    return <TeacherLayout hideHeader={true}>{content}</TeacherLayout>;
  }

  // For non-teachers (principals), return content without TeacherLayout
  return content;
}

// Translations removed - using centralized translations from @/lib/translations
