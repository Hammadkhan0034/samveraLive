'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Plus, ArrowLeft, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { type GuardianFormData } from '@/app/components/shared/GuardianForm';
import { GuardianTable } from '@/app/components/shared/GuardianTable';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import TeacherLayout from '@/app/components/shared/TeacherLayout';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import Loading from '@/app/components/shared/Loading';

type Lang = 'is' | 'en';

export default function GuardiansPage() {
  const { t, lang } = useLanguage();
  const { user, loading, isSigningIn, session } = useRequireAuth();
  const router = useRouter();


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

  // Also load when user is available
  useEffect(() => {
    if (user?.id) {
      loadGuardians(false);
      loadOrgs(false);
    }
  }, [user?.id]);

  // Load guardians
  async function loadGuardians(showLoading = true) {

    try {
      if (showLoading) {
        // setLoadingGuardians(true);
      }
      setGuardianError(null);

      const res = await fetch(`/api/guardians?t=${Date.now()}`, { cache: 'no-store' });
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
      setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', is_active: true });

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

  // Check if user is a teacher or principal
  const userMetadata = user.user_metadata || session?.user?.user_metadata;
  const role = (userMetadata?.role || userMetadata?.user_role || userMetadata?.app_role || userMetadata?.activeRole || '').toString().toLowerCase();
  const isTeacher = role === 'teacher' || (userMetadata?.roles && Array.isArray(userMetadata.roles) && userMetadata.roles.includes('teacher'));
  const isPrincipal = role === 'principal' || (userMetadata?.roles && Array.isArray(userMetadata.roles) && userMetadata.roles.includes('principal'));

  // Content for teacher layout (with gradient background and back button)
  const teacherContent = (
      <div className="h-full bg-mint-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-36 md:px-6">
          {/* Header with Back button */}
          <div className="mb-ds-md flex items-center gap-3 flex-wrap mt-14">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-ds-md border border-input-stroke px-4 py-2 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {lang === 'is' ? 'Til baka' : 'Back'}
            </button>
            <h1 className="text-ds-h1 font-semibold tracking-tight text-ds-text-primary dark:text-slate-100">{t.guardians}</h1>
            <div className="flex items-center gap-ds-xs ml-auto">
              <button
                onClick={openCreateGuardianModal}
                className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-4 py-2 text-ds-small text-white transition-colors"
              >
                <Plus className="h-4 w-4" /> {t.add_guardian}
              </button>
            </div>
          </div>

      {/* Guardians Table */}
      <div className="rounded-ds-lg border border-slate-200 bg-white pt-6 px-ds-md pb-0 shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between mb-ds-sm gap-3">
          <h2 className="text-ds-h3 font-medium text-ds-text-primary dark:text-slate-100">{t.guardians}</h2>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder={'Search guardians...'}
              className="pl-3 pr-3 py-1.5 rounded-ds-md border border-input-stroke bg-input-fill text-ds-small focus:border-mint-200 focus:outline-none focus:ring-2 focus:ring-mint-200/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 w-64"
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
        <div className="mt-ds-sm mb-6 w-full flex justify-end gap-ds-xs">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center rounded-ds-md border border-input-stroke px-3 py-1.5 text-ds-small disabled:opacity-50 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
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
              className={`inline-flex items-center rounded-ds-md px-3 py-1.5 text-ds-small transition-colors ${currentPage === idx + 1 ? 'bg-mint-500 text-white border border-mint-500' : 'border border-input-stroke hover:bg-mint-50 dark:border-slate-600 dark:text-slate-200'}`}
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
            className="inline-flex items-center rounded-ds-md border border-input-stroke px-3 py-1.5 text-ds-small disabled:opacity-50 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
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

  // Content for principal layout (matching students page structure)
  function PrincipalGuardiansContent() {
    const { sidebarRef } = usePrincipalPageLayout();

    return (
      <>
        {/* Content Header */}
        <div className="mb-ds-sm flex flex-col gap-ds-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-ds-sm">
            {/* Mobile menu button */}
            <button
              onClick={() => sidebarRef.current?.open()}
              className="md:hidden p-2 rounded-ds-md hover:bg-mint-200 dark:hover:bg-slate-800 text-ds-text-secondary dark:text-slate-300 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-ds-h1 font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.guardians}</h2>
              <p className="mt-1 text-ds-small text-ds-text-secondary dark:text-slate-400">Manage guardians</p>
            </div>
          </div>

          <div className="flex items-center gap-ds-sm">
            <ProfileSwitcher />
            <button
              onClick={openCreateGuardianModal}
              className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-4 py-2 text-ds-small text-white transition-colors"
            >
              <Plus className="h-4 w-4" /> {t.add_guardian}
            </button>
          </div>
        </div>

        {/* Guardians Table */}
        <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between mb-4 gap-ds-sm">
            <h2 className="text-ds-h3 font-medium text-ds-text-primary dark:text-slate-100">{t.guardians}</h2>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder={'Search guardians...'}
                className="pl-3 pr-3 py-1.5 rounded-ds-md border border-input-stroke bg-input-fill text-ds-small focus:border-mint-200 focus:outline-none focus:ring-2 focus:ring-mint-200/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 w-64"
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
          <div className="mt-ds-sm w-full flex justify-end gap-ds-xs">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center rounded-ds-md border border-input-stroke px-3 py-1.5 text-ds-small disabled:opacity-50 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
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
                className={`inline-flex items-center rounded-ds-md px-3 py-1.5 text-ds-small transition-colors ${currentPage === idx + 1 ? 'bg-mint-500 text-white border border-mint-500' : 'border border-input-stroke hover:bg-mint-50 dark:border-slate-600 dark:text-slate-200'}`}
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
              className="inline-flex items-center rounded-ds-md border border-input-stroke px-3 py-1.5 text-ds-small disabled:opacity-50 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              {'Next'}
            </button>
          </div>
        </div>

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
      </>
    );
  }

  // Wrap with appropriate layout based on user role
  if (isTeacher) {
    return <TeacherLayout hideHeader={true}>{teacherContent}</TeacherLayout>;
  }

  if (isPrincipal) {
    return (
      <PrincipalPageLayout>
        <PrincipalGuardiansContent />
      </PrincipalPageLayout>
    );
  }

  // Fallback for other roles (return teacher content without layout)
  return teacherContent;
}

// Translations removed - using centralized translations from @/lib/translations
