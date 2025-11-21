'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Timer, Users, MessageSquare, Camera, Link as LinkIcon, Utensils, Plus } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar, { TeacherSidebarRef } from '@/app/components/shared/TeacherSidebar';
import { GuardianTable } from '@/app/components/shared/GuardianTable';
import { GuardianForm, type GuardianFormData } from '@/app/components/shared/GuardianForm';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import Loading from '@/app/components/shared/Loading';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Translations removed - using centralized translations from @/lib/translations

export default function TeacherGuardiansPage() {
  const { lang, t } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, isSigningIn } = useRequireAuth('teacher');
  const sidebarRef = useRef<TeacherSidebarRef>(null);

  // Try to get org_id from multiple possible locations
  const userMetadata = session?.user?.user_metadata;
  const orgIdFromMetadata = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  
  // If no org_id in metadata, we need to get it from the database
  const [dbOrgId, setDbOrgId] = useState<string | null>(null);
  
  // Fetch org_id from database if not in metadata
  useEffect(() => {
    if (session?.user?.id && !orgIdFromMetadata) {
      const fetchUserOrgId = async () => {
        try {
          const response = await fetch(`/api/user-org-id?user_id=${session.user.id}`);
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
  }, [session?.user?.id, orgIdFromMetadata]);
  
  // Final org_id to use
  const finalOrgId = orgIdFromMetadata || dbOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

  // Guardian state
  const [guardians, setGuardians] = useState<Array<any>>([]);
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [isDeleteGuardianModalOpen, setIsDeleteGuardianModalOpen] = useState(false);
  const [guardianToDelete, setGuardianToDelete] = useState<string | null>(null);
  const [deletingGuardian, setDeletingGuardian] = useState(false);
  const [submittingGuardian, setSubmittingGuardian] = useState(false);
  const [guardianForm, setGuardianForm] = useState<GuardianFormData>({ 
    first_name: '', 
    last_name: '', 
    email: '', 
    phone: '', 
    org_id: finalOrgId || '', 
    is_active: true 
  });
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string; timezone: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Load guardians and orgs
  useEffect(() => {
    if (finalOrgId) {
      loadGuardians();
      loadOrgs();
    }
  }, [finalOrgId]);

  async function loadGuardians() {
    if (!finalOrgId) return;
    try {
      setLoadingGuardians(true);
      setGuardianError(null);
      const res = await fetch(`/api/guardians?orgId=${finalOrgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setGuardians(json.guardians || []);
    } catch (e: any) {
      console.error('❌ Error loading guardians:', e.message);
      setGuardianError(e.message);
    } finally {
      setLoadingGuardians(false);
    }
  }

  async function loadOrgs() {
    try {
      const res = await fetch('/api/orgs', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setOrgs(json.orgs || []);
    } catch (e: any) {
      console.error('❌ Error loading organizations:', e.message);
    }
  }

  async function submitGuardian(data: GuardianFormData) {
    try {
      setGuardianError(null);
      setSubmittingGuardian(true);
      const res = await fetch('/api/guardians', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsGuardianModalOpen(false);
      setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', org_id: finalOrgId || '', is_active: true });
      await loadGuardians();
    } catch (e: any) {
      console.error('❌ Error submitting guardian:', e.message);
      setGuardianError(e.message);
    } finally {
      setSubmittingGuardian(false);
    }
  }

  function openCreateGuardianModal() {
    setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', org_id: finalOrgId || '', is_active: true });
    setIsGuardianModalOpen(true);
  }

  function openEditGuardianModal(guardian: any) {
    setGuardianForm({
      id: guardian.id,
      first_name: guardian.first_name ?? ((guardian.full_name || '').split(/\s+/)[0] || ''),
      last_name: guardian.last_name ?? ((guardian.full_name || '').split(/\s+/).slice(1).join(' ') || ''),
      email: guardian.email ?? '',
      phone: guardian.phone ?? '',
      org_id: guardian.org_id || finalOrgId || '',
      is_active: guardian.is_active ?? true
    });
    setIsGuardianModalOpen(true);
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
      const res = await fetch(`/api/guardians?id=${encodeURIComponent(guardianToDelete)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsDeleteGuardianModalOpen(false);
      setGuardianToDelete(null);
      await loadGuardians();
    } catch (e: any) {
      setGuardianError(e.message);
    } finally {
      setDeletingGuardian(false);
    }
  }

  const filteredGuardians = searchQuery ? guardians.filter((g: any) => {
    const q = searchQuery.trim().toLowerCase();
    const first = ((g.first_name ?? ((g.full_name || '').split(/\s+/)[0] || ''))).toLowerCase();
    const last = ((g.last_name ?? (((g.full_name || '').split(/\s+/).slice(1).join(' ')) || ''))).toLowerCase();
    const email = ((g.email || '')).toLowerCase();
    return first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q) || email.includes(q);
  }) : guardians;

  const paginatedGuardians = filteredGuardians.slice((currentPage-1)*itemsPerPage, (currentPage-1)*itemsPerPage + itemsPerPage);

  // Define tiles array (excluding guardians as it's handled separately)
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon, route: '/dashboard/teacher?tab=link_student' },
      { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils, route: '/dashboard/teacher?tab=menus' },
    ], [t, lang]);

  // Show loading state while checking authentication
  if (authLoading || (isSigningIn && !user)) {
    return <Loading fullScreen text="Loading guardians page..." />;
  }

  // Safety check: if user is still not available after loading, don't render
  if (!authLoading && !isSigningIn && !user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden md:pt-14">
      <div className="flex flex-1 overflow-hidden h-full">
        <TeacherSidebar
          ref={sidebarRef}
          pathname={pathname}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
            {/* Guardians Panel */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.guardians || 'Guardians'}</h2>
                  <button
                    onClick={openCreateGuardianModal}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    <Plus className="h-4 w-4" /> {lang === 'is' ? 'Bæta við forráðamanni' : 'Add Guardian'}
                  </button>
                </div>
                <div className="mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    placeholder={lang === 'is' ? 'Leita...' : 'Search guardians...'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  />
                </div>
                {loadingGuardians ? (
                  <LoadingSkeleton type="table" rows={5} />
                ) : (
                  <GuardianTable
                    guardians={paginatedGuardians.map((g: any) => ({
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
                    guardians: t.tile_guardians || 'Guardians',
                    first_name: lang === 'is' ? 'Fornafn' : 'First Name',
                    last_name: lang === 'is' ? 'Eftirnafn' : 'Last Name',
                    email: lang === 'is' ? 'Netfang' : 'Email',
                    phone: lang === 'is' ? 'Sími' : 'Phone',
                    status: lang === 'is' ? 'Staða' : 'Status',
                    active: lang === 'is' ? 'Virkur' : 'Active',
                    inactive: lang === 'is' ? 'Óvirkur' : 'Inactive',
                    actions: lang === 'is' ? 'Aðgerðir' : 'Actions',
                    create: lang === 'is' ? 'Búa til' : 'Create',
                    no_guardians: lang === 'is' ? 'Engir forráðamenn' : 'No guardians',
                    no_guardians_loading: lang === 'is' ? 'Hleður...' : 'Loading...',
                    edit: lang === 'is' ? 'Breyta' : 'Edit',
                    delete: lang === 'is' ? 'Eyða' : 'Delete',
                    send_magic_link: lang === 'is' ? 'Senda töfraslóð' : 'Send Magic Link',
                    sending: lang === 'is' ? 'Sendi...' : 'Sending...',
                    magic_link_sent: lang === 'is' ? 'Töfraslóð send' : 'Magic link sent',
                    magic_link_send_failed: lang === 'is' ? 'Tókst ekki að senda töfraslóð' : 'Failed to send magic link',
                    no_students_linked: lang === 'is' ? 'Engir nemendur tengdir' : 'No students linked',
                  }}
                  />
                )}
                {filteredGuardians.length > itemsPerPage && (
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {lang === 'is' ? 'Fyrri' : 'Prev'}
                    </button>
                    <span className="px-3 py-1.5 text-sm">{currentPage} / {Math.ceil(filteredGuardians.length / itemsPerPage)}</span>
                    <button
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage >= Math.ceil(filteredGuardians.length / itemsPerPage)}
                      className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {lang === 'is' ? 'Næsta' : 'Next'}
                    </button>
                  </div>
                )}
                <GuardianForm
                  isOpen={isGuardianModalOpen}
                  onClose={() => setIsGuardianModalOpen(false)}
                  onSubmit={submitGuardian}
                  initialData={guardianForm}
                  loading={submittingGuardian}
                  error={guardianError}
                  orgs={orgs}
                  translations={{
                    create_guardian: lang === 'is' ? 'Búa til forráðamann' : 'Create Guardian',
                    edit_guardian: lang === 'is' ? 'Breyta forráðamanni' : 'Edit Guardian',
                    first_name: lang === 'is' ? 'Fornafn' : 'First Name',
                    last_name: lang === 'is' ? 'Eftirnafn' : 'Last Name',
                    email: lang === 'is' ? 'Netfang' : 'Email',
                    phone: lang === 'is' ? 'Sími' : 'Phone',
                    organization: lang === 'is' ? 'Stofnun' : 'Organization',
                    status: lang === 'is' ? 'Staða' : 'Status',
                    active: lang === 'is' ? 'Virkur' : 'Active',
                    inactive: lang === 'is' ? 'Óvirkur' : 'Inactive',
                    create: lang === 'is' ? 'Búa til' : 'Create',
                    update: lang === 'is' ? 'Uppfæra' : 'Update',
                    cancel: lang === 'is' ? 'Hætta við' : 'Cancel',
                    creating: lang === 'is' ? 'Býr til...' : 'Creating...',
                    updating: lang === 'is' ? 'Uppfærir...' : 'Updating...',
                    first_name_placeholder: lang === 'is' ? 'Sláðu inn fornafn' : 'Enter first name',
                    last_name_placeholder: lang === 'is' ? 'Sláðu inn eftirnafn' : 'Enter last name',
                    email_placeholder: lang === 'is' ? 'Sláðu inn netfang' : 'Enter email address',
                    phone_placeholder: lang === 'is' ? 'Sláðu inn símanúmer' : 'Enter phone number',
                    status_placeholder: lang === 'is' ? 'Veldu stöðu' : 'Select status',
                  }}
                />
                <DeleteConfirmationModal
                  isOpen={isDeleteGuardianModalOpen}
                  onClose={() => setIsDeleteGuardianModalOpen(false)}
                  onConfirm={confirmDeleteGuardian}
                  title={lang === 'is' ? 'Eyða forráðamanni' : 'Delete Guardian'}
                  message={lang === 'is' ? 'Ertu viss um að þú viljir eyða þessum forráðamanni?' : 'Are you sure you want to delete this guardian?'}
                  loading={deletingGuardian}
                  error={guardianError}
                  translations={{
                    confirm_delete: lang === 'is' ? 'Eyða' : 'Delete',
                    cancel: lang === 'is' ? 'Hætta við' : 'Cancel',
                  }}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
