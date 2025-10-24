'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Users, School, ChartBar as BarChart3, FileText, Plus, UserPlus, Download, ListFilter as Filter, Search, CircleCheck as CheckCircle2, Circle as XCircle, Eye, EyeOff, Settings, Bell, X, Edit, Trash2 } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import AnnouncementForm from './AnnouncementForm';
import AnnouncementList from './AnnouncementList';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { GuardianForm, type GuardianFormData } from './shared/GuardianForm';
import { GuardianTable } from './shared/GuardianTable';
import { StudentForm, type StudentFormData } from './shared/StudentForm';
import { StudentTable } from './shared/StudentTable';
import { DeleteConfirmationModal } from './shared/DeleteConfirmationModal';

type Lang = 'is' | 'en';

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function PrincipalDashboard({ lang = 'en' }: { lang?: Lang }) {
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { session, signOut } = useAuth?.() || {} as any;
  const router = useRouter();

  // Try to get org_id from multiple possible locations
  const userMetadata = session?.user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;

  // Fallback to default org ID if not found in metadata
  const finalOrgId = orgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;

  // 
  // Load data immediately when component mounts
  useEffect(() => {
    if (session?.user?.id) {
      // Load all data immediately in parallel without individual loading states
      const loadAllData = async () => {
        try {
          // Use Promise.allSettled to ensure all requests complete even if some fail
          await Promise.allSettled([
            loadOrgs(false),
            loadClasses(false),
            loadStaff(false),
            loadGuardians(false),
            loadStudents(false)
          ]);
        } finally {
          // Set loading to false after a short delay to ensure smooth transition
          setTimeout(() => setIsInitialLoading(false), 100);
        }
      };
      loadAllData();
    }
  }, [session?.user?.id, finalOrgId]);

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

  // Refresh all data function for real-time updates
  const refreshAllData = async () => {
    if (session?.user?.id) {
      await Promise.all([
        loadOrgs(),
        loadClasses(),
        loadStaff(),
        loadGuardians(),
        loadStudents()
      ]);
    }
  };

  // Demo data
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isStaffCRUDModalOpen, setIsStaffCRUDModalOpen] = useState(false);
  const [isDeleteStaffModalOpen, setIsDeleteStaffModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successCredentials, setSuccessCredentials] = useState<{ email: string; password: string; name: string } | null>(null);
  const [newClass, setNewClass] = useState({ name: '', description: '', capacity: '', org_id: '' });
  const [newStaff, setNewStaff] = useState({ name: '', email: '', role: 'teacher', phone: '', class_id: '' });
  const [classes, setClasses] = useState<Array<{ id: string; name: string; code: string | null; assigned_teachers: any[] }>>([]);
  const [loadingClass, setLoadingClass] = useState(false);
  const [isClassSuccessModalOpen, setIsClassSuccessModalOpen] = useState(false);
  const [createdClassName, setCreatedClassName] = useState('');

  // Staff management states
  const [staff, setStaff] = useState<Array<{ id: string; email: string; full_name: string; is_active: boolean; created_at: string }>>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Array<{ id: string; email: string; created_at: string; expires_at: string }>>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Guardian states
  const [guardians, setGuardians] = useState<Array<{ id: string; email: string | null; phone: string | null; full_name: string; org_id: string; is_active: boolean; created_at: string; metadata?: any }>>([]);
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [guardianForm, setGuardianForm] = useState<GuardianFormData>({ full_name: '', email: '', phone: '', org_id: '', is_active: true });
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [isDeleteGuardianModalOpen, setIsDeleteGuardianModalOpen] = useState(false);
  const [guardianToDelete, setGuardianToDelete] = useState<string | null>(null);

  // Student states
  const [students, setStudents] = useState<Array<{ id: string; first_name: string; last_name: string | null; dob: string | null; gender: string; class_id: string | null; created_at: string; classes?: any; guardians?: Array<{ id: string; relation: string; users?: { id: string; full_name: string; email: string } }> }>>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState<StudentFormData>({ first_name: '', last_name: '', dob: '', gender: 'unknown', class_id: '', medical_notes: '', allergies: '', emergency_contact: '', guardian_ids: [] });
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isDeleteStudentModalOpen, setIsDeleteStudentModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);

  // Student request states
  const [studentRequests, setStudentRequests] = useState<Array<{ id: string; first_name: string; last_name: string | null; dob: string | null; gender: string; class_id: string | null; status: string; requested_by: string; approved_by: string | null; rejected_by: string | null; created_at: string; classes?: any; requested_by_user?: { id: string; full_name: string; email: string } }>>([]);
  const [loadingStudentRequests, setLoadingStudentRequests] = useState(false);
  const [studentRequestError, setStudentRequestError] = useState<string | null>(null);

  // Organizations states
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string; timezone: string }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  
  // Global loading state for initial data load
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Auto-hide loading after maximum 2 seconds to prevent long loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);


  const kpis = [
    { label: t.kpi_students, value: students.length, icon: Users },
    { label: t.kpi_staff, value: staff.length, icon: School },
    { label: t.kpi_classes, value: classes.length, icon: BarChart3 },
    { label: t.kpi_incidents, value: 2, icon: FileText },
  ];


  function openCreateClassModal() {
    setNewClass({ name: '', description: '', capacity: '', org_id: finalOrgId || '' });
    setIsModalOpen(true);
  }

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault();
    if (!newClass.name.trim()) return;

    if (!session?.user?.id) {
      alert('User session not found. Please log in again.');
      return;
    }

    try {
      setLoadingClass(true);

      // Use a system user ID or the session user ID
      const userId = session.user.id;

      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newClass.name,
          code: newClass.description || null, // Use description as code for now
          created_by: userId,
          org_id: newClass.org_id || finalOrgId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create class');
      }

      // Store class name for success modal
      setCreatedClassName(newClass.name);

      // Refresh all data to update KPI cards immediately
      await refreshAllData();

      setNewClass({ name: '', description: '', capacity: '', org_id: '' });
      setIsModalOpen(false);

      // Show success modal instead of alert
      setIsClassSuccessModalOpen(true);
    } catch (error: any) {
      alert(`Error creating class: ${error.message}`);
    } finally {
      setLoadingClass(false);
    }
  }

  // Load classes data
  async function loadClasses(showLoading = true) {
    if (!finalOrgId) return;

    try {
      if (showLoading) setLoadingClass(true);
      const response = await fetch(`/api/classes?orgId=${finalOrgId}`);
      const data = await response.json();

      if (response.ok) {
        const classesData = data.classes || [];
        setClasses(classesData);

        // Update rows with dynamic data
        const dynamicRows = classesData.map((cls: any) => ({
          name: cls.name,
          students: 0, // Will be updated when students are added
          staff: cls.assigned_teachers?.length || 0,
          visible: true
        }));
      } else {
        console.error('Error loading classes:', data.error);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      if (showLoading) setLoadingClass(false);
    }
  }

  // Load staff members
  async function loadStaff(showLoading = true) {
    if (!finalOrgId) return;

    try {
      if (showLoading) setLoadingStaff(true);
      setStaffError(null);

      const response = await fetch(`/api/staff-management?orgId=${finalOrgId}`, {
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load staff');
      }

      setStaff(data.staff || []);
      setPendingInvitations(data.pending_invitations || []);
    } catch (error: any) {
      setStaffError(error.message);
    } finally {
      if (showLoading) setLoadingStaff(false);
    }
  }

  // Guardian functions
  async function loadGuardians(showLoading = true) {
    if (!finalOrgId) return;

    try {
      if (showLoading) {
        setLoadingGuardians(true);
      }
      setGuardianError(null);

      const res = await fetch(`/api/guardians?orgId=${finalOrgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const guardiansList = json.guardians || [];
      setGuardians(guardiansList);
    } catch (e: any) {
      console.error('❌ Error loading guardians:', e.message);
      setGuardianError(e.message);
    } finally {
      if (showLoading) {
        setLoadingGuardians(false);
      }
    }
  }

  // Student functions
  async function loadStudents(showLoading = true) {
    if (!finalOrgId) return;

    try {
      if (showLoading) {
        setLoadingStudents(true);
      }
      setStudentError(null);

      const res = await fetch(`/api/students?orgId=${finalOrgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const studentsList = json.students || [];
      setStudents(studentsList);
    } catch (e: any) {
      console.error('❌ Error loading students:', e.message);
      setStudentError(e.message);
    } finally {
      if (showLoading) {
        setLoadingStudents(false);
      }
    }
  }

  // Student request functions
  async function loadStudentRequests(showLoading = true) {
    if (!finalOrgId) return;

    try {
      if (showLoading) {
        setLoadingStudentRequests(true);
      }
      setStudentRequestError(null);

      const res = await fetch(`/api/student-requests?orgId=${finalOrgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const requestsList = json.student_requests || [];
      setStudentRequests(requestsList);
    } catch (e: any) {
      console.error('❌ Error loading student requests:', e.message);
      setStudentRequestError(e.message);
    } finally {
      if (showLoading) {
        setLoadingStudentRequests(false);
      }
    }
  }

  async function approveStudentRequest(requestId: string) {
    try {
      setStudentRequestError(null);
      const res = await fetch('/api/student-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          status: 'approved',
          approved_by: session?.user?.id
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      // Refresh both student requests and students
      await Promise.all([
        loadStudentRequests(false),
        loadStudents(false)
      ]);
    } catch (e: any) {
      setStudentRequestError(e.message);
    }
  }

  async function rejectStudentRequest(requestId: string) {
    try {
      setStudentRequestError(null);
      const res = await fetch('/api/student-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          status: 'rejected',
          rejected_by: session?.user?.id
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      // Refresh student requests
      await loadStudentRequests(false);
    } catch (e: any) {
      setStudentRequestError(e.message);
    }
  }


  // Load staff on mount and when orgId changes
  useEffect(() => {
    loadStaff();
    loadClasses();
    loadStudentRequests();
  }, [finalOrgId, session?.user?.id]);

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!newStaff.name.trim() || !newStaff.email.trim()) return;

    if (!finalOrgId) {
      alert('Organization ID not found. Please ensure you are logged in with a valid organization.');
      return;
    }

    if (!session?.user?.id) {
      alert('User session not found. Please log in again.');
      return;
    }

    try {
      setStaffError(null);
      setLoadingStaff(true); // Show loading state

      console.log('Sending staff invitation request:', {
        name: newStaff.name,
        email: newStaff.email,
        org_id: finalOrgId,
        created_by: session.user.id
      });

      const response = await fetch('/api/staff-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newStaff.name,
          email: newStaff.email,
          role: newStaff.role,
          phone: newStaff.phone || null,
          org_id: finalOrgId,
          created_by: session.user.id,
          class_id: newStaff.class_id || null,
        }),
      });

      console.log('Response status:', response.status);

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      // Reset form and close modal
      setNewStaff({ name: '', email: '', role: 'teacher', phone: '', class_id: '' });
      setIsStaffModalOpen(false);

      // Refresh all data to update KPI cards immediately
      await refreshAllData();

      // Show success message with credentials in modal
      if (data.user && data.user.password) {
        setSuccessCredentials({
          email: data.user.email,
          password: data.user.password,
          name: newStaff.name
        });
        setIsSuccessModalOpen(true);
      } else if (data.invitation?.message) {
        alert(`${data.invitation.message}`);
      } else {
        alert(`✅ Staff invitation sent successfully to ${newStaff.email}`);
      }
    } catch (error: any) {
      setStaffError(error.message);
      alert(`${t.staff_creation_error}: ${error.message}`);
    } finally {
      setLoadingStaff(false); // Hide loading state
    }
  }

  // Guardian form submission
  async function submitGuardian(data: GuardianFormData) {
    try {
      setGuardianError(null);
      setLoadingGuardians(true);

      const res = await fetch('/api/guardians', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      setIsGuardianModalOpen(false);
      await Promise.all([
        loadGuardians(false),
        loadOrgs()
      ]);
    } catch (e: any) {
      setGuardianError(e.message);
    } finally {
      setLoadingGuardians(false);
    }
  }

  // Student form submission
  async function submitStudent(data: StudentFormData) {
    try {
      setStudentError(null);
      setLoadingStudents(true);

      const res = await fetch('/api/students', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      setIsStudentModalOpen(false);
      await loadStudents(false);
    } catch (e: any) {
      setStudentError(e.message);
    } finally {
      setLoadingStudents(false);
    }
  }

  async function deleteStaffMember(id: string) {
    try {
      setStaffError(null);

      const response = await fetch(`/api/staff-management?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete staff');
      }

      setIsDeleteStaffModalOpen(false);
      setStaffToDelete(null);

      // Refresh all data to update KPI cards immediately
      await refreshAllData();
    } catch (error: any) {
      setStaffError(error.message);
    }
  }

  function openStaffCRUDModal() {
    setIsStaffCRUDModalOpen(true);
    setStaffError(null); // Clear any errors
    loadStaff(); // Refresh data when opening - will filter out accepted invitations
  }

  function openDeleteStaffModal(id: string) {
    setStaffToDelete(id);
    setIsDeleteStaffModalOpen(true);
  }

  // Guardian modal handlers
  function openCreateGuardianModal() {
    setGuardianForm({ full_name: '', email: '', phone: '', org_id: finalOrgId || '', is_active: true });
    setGuardianError(null);
    setIsGuardianModalOpen(true);
  }

  function openEditGuardianModal(guardian: any) {
    setGuardianForm({
      id: guardian.id,
      full_name: guardian.full_name,
      email: guardian.email || '',
      phone: guardian.phone || '',
      org_id: guardian.org_id,
      is_active: guardian.is_active
    });
    setGuardianError(null);
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
      const res = await fetch(`/api/guardians?id=${encodeURIComponent(guardianToDelete)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsDeleteGuardianModalOpen(false);
      setGuardianToDelete(null);
      await loadGuardians(false);
    } catch (e: any) {
      setGuardianError(e.message);
    }
  }

  // Student modal handlers
  function openCreateStudentModal() {
    setStudentForm({ first_name: '', last_name: '', dob: '', gender: 'unknown', class_id: '', medical_notes: '', allergies: '', emergency_contact: '', guardian_ids: [], org_id: finalOrgId || '' });
    setStudentError(null);
    setIsStudentModalOpen(true);
  }

  function openEditStudentModal(student: any) {
    setStudentForm({
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name || '',
      dob: student.dob || '',
      gender: student.gender || 'unknown',
      class_id: student.class_id || '',
      medical_notes: student.medical_notes_encrypted || '',
      allergies: student.allergies_encrypted || '',
      emergency_contact: student.emergency_contact_encrypted || '',
      guardian_ids: [], // Will be loaded separately\
      org_id: finalOrgId || ''
    } as StudentFormData);
    setStudentError(null);
    setIsStudentModalOpen(true);
  }

  function openDeleteStudentModal(id: string) {
    setStudentToDelete(id);
    setIsDeleteStudentModalOpen(true);
  }

  async function confirmDeleteStudent() {
    if (!studentToDelete) return;
    try {
      setStudentError(null);
      const res = await fetch(`/api/students?id=${encodeURIComponent(studentToDelete)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsDeleteStudentModalOpen(false);
      setStudentToDelete(null);
      await loadStudents(false);
    } catch (e: any) {
      setStudentError(e.message);
    }
  }

  async function cancelInvitation(invitationId: string) {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      setStaffError(null);

      const response = await fetch(`/api/staff-management?id=${encodeURIComponent(invitationId)}&type=invitation`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel invitation');
      }

      // Refresh all data to update KPI cards immediately
      await refreshAllData();
    } catch (error: any) {
      setStaffError(error.message);
      alert('Error cancelling invitation: ' + error.message);
    }
  }

  // Show loading overlay during initial data load
  if (isInitialLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading dashboard data...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.subtitle}</p>
        </div>

        {/* Profile switcher + actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center justify-end">
            <ProfileSwitcher /> {/* ← shows only if user has multiple roles */}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openCreateClassModal}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" /> {t.add_class}
            </button>
            <button
              onClick={() => setIsStaffModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <UserPlus className="h-4 w-4" /> {t.invite_staff}
            </button>
            <button
              onClick={openStaffCRUDModal}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white  dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Users className="h-4 w-4" /> {t.manage_staff}
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">
              <Download className="h-4 w-4" /> {t.export}
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
              <span className="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                <Icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              </span>
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {isInitialLoading || loadingStaff || loadingGuardians || loadingStudents ? (
                <div className="h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-600"></div>
              ) : (
                value
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Filter className="h-4 w-4" />
          <span>{t.classes_management}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateClassModal}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" />
            {t.add_class}
          </button>
        </div>
      </div>

      {/* Departments table */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.departments}</h2>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isInitialLoading || loadingStaff || loadingStudents ? (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
                Loading...
              </div>
            ) : (
              t.overview_hint
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">{t.col_name}</th>
                <th className="px-4 py-3">{t.col_students}</th>
                <th className="px-4 py-3">{t.col_staff}</th>
                <th className="px-4 py-3">{t.col_visible}</th>
                <th className="px-4 py-3">{t.col_actions}</th>
              </tr>
            </thead>
            <tbody className="[&_tr:not(:last-child)]:border-b [&_tr:not(:last-child)]:border-slate-200 dark:[&_tr:not(:last-child)]:border-slate-600">
              {isInitialLoading || loadingStaff || loadingStudents ? (
                // Loading skeleton rows
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={`loading-${i}`} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 bg-slate-200 dark:bg-slate-600 rounded"></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-8 bg-slate-200 dark:bg-slate-600 rounded"></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-8 bg-slate-200 dark:bg-slate-600 rounded"></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-6 w-16 bg-slate-200 dark:bg-slate-600 rounded-full"></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-6 w-20 bg-slate-200 dark:bg-slate-600 rounded"></div>
                    </td>
                  </tr>
                ))
              ) : (
                <>
                  {classes.map((cls) => (
                    <tr key={cls.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{cls.name}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {students.filter(s => s.class_id === cls.id).length}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {cls.assigned_teachers?.length || 0}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                            'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300'
                          )}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t.visible_yes}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => console.log('Toggle visibility for', cls.name)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t.show}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {classes.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-slate-500 dark:text-slate-400" colSpan={5}>
                        {t.empty}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guardian Management Section */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.guardians}</h2>
            {(isInitialLoading || loadingGuardians) && (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
                Loading...
              </div>
            )}
          </div>
          <GuardianTable
            guardians={guardians}
            loading={isInitialLoading || loadingGuardians}
            error={guardianError}
            onEdit={openEditGuardianModal}
            onDelete={openDeleteGuardianModal}
            onCreate={openCreateGuardianModal}
            translations={{
              guardians: t.guardians,
              full_name: t.full_name,
              email: t.email,
              phone: t.phone,
              status: t.status,
              active: t.active,
              inactive: t.inactive,
              actions: t.actions,
              create: t.create,
              no_guardians: t.no_guardians,
              loading: t.loading
            }}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.students}</h2>
            {(isInitialLoading || loadingStudents) && (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
                Loading...
              </div>
            )}
          </div>
          <StudentTable
            students={students}
            loading={isInitialLoading || loadingStudents}
            error={studentError}
            onEdit={openEditStudentModal}
            onDelete={openDeleteStudentModal}
            onCreate={openCreateStudentModal}
            translations={{
              students: t.students,
              student_name: t.student_name,
              student_class: t.student_class,
              student_guardians: t.student_guardians,
              student_dob: t.student_dob,
              student_gender: t.student_gender,
              actions: t.actions,
              create: t.create,
              no_students: t.no_students,
              loading: t.loading
            }}
          />

        </div>
      </div>

      {/* Announcements Section */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">{t.announcements_title}</h2>
          <AnnouncementForm
            orgId={orgId}
            lang={lang}
            onSuccess={() => {
              window.location.reload();
            }}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">{t.announcements_list}</h3>
          <AnnouncementList
            showAuthor={true}
            limit={5}
            lang={lang}
          />
        </div>
      </div>


      {/* Activity feed */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.recent_activity}</h3>
          <ul className="mt-3 space-y-3 text-sm">
            {[
              t.act_added_class.replace('{name}', 'Rauðkjarni'),
              t.act_invited.replace('{name}', 'Margrét Jónsdóttir'),
              t.act_visibility_off.replace('{name}', 'Rauðkjarni'),
              t.act_export,
            ].map((txt, i) => (
              <li key={i} className="rounded-xl border border-slate-200 p-3 text-slate-700 dark:border-slate-600 dark:text-slate-300">
                {txt}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.quick_tips}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
            <li>{t.tip_roles}</li>
            <li>{t.tip_visibility}</li>
            <li>{t.tip_exports}</li>
          </ul>
        </div>
      </div>




      {/* Add Class Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.add_class}</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddClass} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.class_name}
                </label>
                <input
                  type="text"
                  value={newClass.name}
                  onChange={(e) => setNewClass(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t.class_name_placeholder}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.class_description}
                </label>
                <textarea
                  value={newClass.description}
                  onChange={(e) => setNewClass(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t.class_description_placeholder}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.class_capacity}
                </label>
                <input
                  type="number"
                  value={newClass.capacity}
                  onChange={(e) => setNewClass(prev => ({ ...prev, capacity: e.target.value }))}
                  placeholder={t.class_capacity_placeholder}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  min="1"
                />
              </div>


              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={loadingClass}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loadingClass}
                  className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 dark:bg-black"
                >
                  {loadingClass ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    t.create_class
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.invite_staff}</h3>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.staff_name}
                </label>
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t.staff_name_placeholder}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.staff_email}
                </label>
                <input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, email: e.target.value }))}
                  placeholder={t.staff_email_placeholder}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.staff_role}
                </label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                >
                  <option value="teacher">{t.role_teacher}</option>
                  {/* <option value="assistant">{t.role_assistant}</option> */}
                  {/* <option value="specialist">{t.role_specialist}</option> */}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.staff_phone}
                </label>
                <input
                  type="tel"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder={t.staff_phone_placeholder}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.assign_to_class}
                </label>
                <select
                  value={newStaff.class_id}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, class_id: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                >
                  <option value="">{t.no_class_assigned}</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.code ? `(${cls.code})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t.class_assignment_note}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  disabled={loadingStaff}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loadingStaff}
                  className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 "
                >
                  {loadingStaff ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t.sending}
                    </>
                  ) : (
                    t.invite_staff_btn
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Management Modal */}
      {isStaffCRUDModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.staff_management}</h3>
              <button
                onClick={() => setIsStaffCRUDModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {staffError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {staffError}
              </div>
            )}

            {/* Active Staff Table */}
            <div className="mb-6">
              <h4 className="text-md font-medium mb-3 text-slate-900 dark:text-slate-100">{t.active_staff_members}</h4>
              <div className="overflow-y-auto max-h-64 rounded-md border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-slate-700 z-10">
                    <tr className="text-left text-slate-600 dark:text-slate-300">
                      <th className="py-2 pr-3 pl-3">{t.name}</th>
                      <th className="py-2 pr-3">{t.email}</th>
                      <th className="py-2 pr-3">{t.status}</th>
                      <th className="py-2 pr-3">{t.joined}</th>
                      <th className="py-2 pr-3">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                    {loadingStaff ? (
                      <tr><td colSpan={5} className="py-4 text-center text-slate-600 dark:text-slate-400">{t.loading}</td></tr>
                    ) : staff.length === 0 ? (
                      <tr><td colSpan={5} className="py-4 text-center text-slate-500 dark:text-slate-400">{t.no_staff_members}</td></tr>
                    ) : (
                      staff.map((s) => (
                        <tr key={s.id} className="h-12 hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                          <td className="py-2 pr-3 pl-3 text-slate-900 dark:text-slate-100">{s.full_name}</td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{s.email}</td>
                          <td className="py-2 pr-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${s.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                              {s.is_active ? t.active : t.inactive}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{new Date(s.created_at).toLocaleDateString()}</td>
                          <td className="py-2 pr-3">
                            <button
                              onClick={() => openDeleteStaffModal(s.id)}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border-red-300 dark:border-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                              {t.delete}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pending Invitations Table */}
            <div>
              <h4 className="text-md font-medium mb-3 text-slate-900 dark:text-slate-100">{t.pending_invitations}</h4>
              <div className="overflow-y-auto max-h-48 rounded-md border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-slate-700 z-10">
                    <tr className="text-left text-slate-600 dark:text-slate-300">
                      <th className="py-2 pr-3 pl-3">{t.email}</th>
                      <th className="py-2 pr-3">{t.sent}</th>
                      <th className="py-2 pr-3">{t.expires}</th>
                      <th className="py-2 pr-3">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                    {loadingStaff ? (
                      <tr><td colSpan={4} className="py-4 text-center text-slate-600 dark:text-slate-400">{t.loading}</td></tr>
                    ) : pendingInvitations.length === 0 ? (
                      <tr><td colSpan={4} className="py-4 text-center text-slate-500 dark:text-slate-400">{t.no_pending_invitations}</td></tr>
                    ) : (
                      pendingInvitations.map((inv) => (
                        <tr key={inv.id} className="h-12 hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                          <td className="py-2 pr-3 pl-3 text-slate-900 dark:text-slate-100">{inv.email}</td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{new Date(inv.created_at).toLocaleDateString()}</td>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{new Date(inv.expires_at).toLocaleDateString()}</td>
                          <td className="py-2 pr-3">
                            <button
                              onClick={() => cancelInvitation(inv.id)}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 text-xs"
                            >
                              <X className="h-3 w-3" />
                              {t.cancel}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsStaffCRUDModalOpen(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Staff Confirmation Modal */}
      {isDeleteStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t.remove_staff_member}
              </h3>
              <button
                onClick={() => setIsDeleteStaffModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-slate-600 dark:text-slate-300">
                {t.remove_staff_confirm}
              </p>
            </div>

            {staffError && (
              <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">{staffError}</div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteStaffModalOpen(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => staffToDelete && deleteStaffMember(staffToDelete)}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
              >
                {t.remove}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Class Creation Success Modal */}
      {isClassSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden dark:bg-slate-800">
            {/* Header */}
            <div className="bg-slate-900 dark:from-slate-700 dark:to-slate-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-900 dark:bg-slate-200 dark:text-slate-800">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white dark:text-slate-100">{t.class_created}</h3>
                    <p className="text-sm text-blue-50 dark:text-slate-300">{t.class_created_subtitle}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsClassSuccessModalOpen(false);
                    setCreatedClassName('');
                  }}
                  className="rounded-lg p-1 hover:bg-white/20 text-white dark:text-slate-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Success Message */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 dark:bg-slate-900/20 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-slate-900 dark:text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">{t.class_is_ready}</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      <strong>{createdClassName}</strong> {t.class_created_message}
                    </p>
                  </div>
                </div>
              </div>

              {/* Class Info */}
              <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t.class_details}</h4>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{t.name}:</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{createdClassName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{t.status}:</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full dark:text-green-300 dark:bg-green-900/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-600"></span>
                      {t.active}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{t.students}:</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{t.staff}:</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">0</span>
                  </div>
                </div>
              </div>

              {/* <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-green-900 mb-2">What's Next?</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Invite teachers and assign them to this class</li>
                      <li>• Add students to the class roster</li>
                      <li>• Create announcements for the class</li>
                    </ul>
                  </div>
                </div>
              </div> */}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 flex gap-3 dark:bg-slate-700">
              <button
                onClick={() => setIsStaffModalOpen(true)}
                className="flex-1 rounded-lg border-2 border-slate-500 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:border-slate-400 dark:hover:bg-slate-900/20 transition-colors"
              >
                {t.invite_staff}
              </button>
              <button
                onClick={() => {
                  setIsClassSuccessModalOpen(false);
                  setCreatedClassName('');
                }}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 transition-colors"
              >
                {t.done}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal with Credentials */}
      {isSuccessModalOpen && successCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden dark:bg-slate-800">
            {/* Header */}
            <div className="bg-black px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{t.staff_invited_success}</h3>
                    <p className="text-sm text-green-50">{t.invitation_sent_to} {successCredentials.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsSuccessModalOpen(false);
                    setSuccessCredentials(null);
                  }}
                  className="rounded-lg p-1 hover:bg-white/20 text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Success Message */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 dark:bg-slate-900/20 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-slate-600 dark:text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">{t.account_created_email_sent}</h4>
                    <p className="text-sm text-salte-700 dark:text-slate-300">
                      {t.invitation_email_sent} <strong>{successCredentials.email}</strong> {t.with_login_credentials}
                    </p>
                  </div>
                </div>
              </div>

              {/* Credentials Box */}
              <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t.login_credentials}</h4>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-white p-3 border border-slate-200 dark:bg-slate-800 dark:border-slate-600">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">{t.email}</p>
                      <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">{successCredentials.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(successCredentials.email);
                      }}
                      className="ml-3 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      {t.copy}
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-white p-3 border border-slate-200 dark:bg-slate-800 dark:border-slate-600">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">{t.password}</p>
                      <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">{successCredentials.password}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(successCredentials.password);
                      }}
                      className="ml-3 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      {t.copy}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 flex gap-3 dark:bg-slate-700">
              <button
                onClick={() => {
                  const text = `Email: ${successCredentials.email}\nPassword: ${successCredentials.password}`;
                  navigator.clipboard.writeText(text);
                }}
                className="flex-1 rounded-lg border-2 border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {t.copy_all_credentials}
              </button>
              <button
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  setSuccessCredentials(null);
                }}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 transition-colors"
              >
                {t.done}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guardian Form Modal */}
      <GuardianForm
        isOpen={isGuardianModalOpen}
        onClose={() => setIsGuardianModalOpen(false)}
        onSubmit={submitGuardian}
        initialData={guardianForm}
        loading={loadingGuardians}
        error={guardianError}
        orgs={orgs}
        translations={{
          create_guardian: t.create_guardian,
          edit_guardian: t.edit_guardian,
          full_name: t.full_name,
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
          full_name_placeholder: t.full_name_placeholder,
          email_placeholder: t.email_placeholder,
          phone_placeholder: t.phone_placeholder,
          status_placeholder: t.status_placeholder
        }}
      />

      {/* Student Form Modal */}
      <StudentForm
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        onSubmit={submitStudent}
        initialData={studentForm}
        loading={loadingStudents}
        error={studentError}
        guardians={guardians}
        classes={classes}
        orgId={finalOrgId || ''}
        translations={{
          create_student: t.create_student,
          edit_student: t.edit_student,
          student_first_name: t.first_name,
          student_last_name: t.last_name,
          student_dob: t.dob,
          student_gender: t.gender,
          student_class: t.class,
          student_guardians: t.guardians,
          student_medical_notes: t.medical_notes,
          student_allergies: t.allergies,
          student_emergency_contact: t.emergency_contact,
          student_first_name_placeholder: t.student_first_name_placeholder,
          student_last_name_placeholder: t.student_last_name_placeholder,
          student_medical_notes_placeholder: t.student_medical_notes_placeholder,
          student_allergies_placeholder: t.student_allergies_placeholder,
          student_emergency_contact_placeholder: t.student_emergency_contact_placeholder,
          gender_unknown: t.gender_unknown,
          gender_male: t.gender_male,
          gender_female: t.gender_female,
          gender_other: t.gender_other,
          no_class_assigned: t.no_class_assigned,
          no_guardians_available: t.no_guardians_available,
          student_age_requirement: t.student_age_requirement,
          create: t.create,
          update: t.update,
          cancel: t.cancel,
          creating: t.creating,
          updating: t.updating
        }}
      />

      {/* Delete Guardian Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteGuardianModalOpen}
        onClose={() => setIsDeleteGuardianModalOpen(false)}
        onConfirm={confirmDeleteGuardian}
        title={t.delete_guardian}
        message={t.delete_guardian_confirm}
        error={guardianError}
        translations={{
          confirm_delete: t.delete,
          cancel: t.cancel
        }}
      />

      {/* Delete Student Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteStudentModalOpen}
        onClose={() => setIsDeleteStudentModalOpen(false)}
        onConfirm={confirmDeleteStudent}
        title={t.delete_student}
        message={t.delete_student_confirm}
        error={studentError}
        translations={{
          confirm_delete: t.delete,
          cancel: t.cancel
        }}
      />

      {/* Student Requests Management Section */}
      <div className="mt-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.student_requests}</h2>
            {(isInitialLoading || loadingStudentRequests) && (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
                Loading...
              </div>
            )}
          </div>

          {studentRequestError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {studentRequestError}
            </div>
          )}

          {isInitialLoading || loadingStudentRequests ? (
            // Loading skeleton
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`loading-${i}`} className="animate-pulse rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-slate-200 dark:bg-slate-600 rounded"></div>
                      <div className="h-3 w-24 bg-slate-200 dark:bg-slate-600 rounded"></div>
                    </div>
                    <div className="h-6 w-20 bg-slate-200 dark:bg-slate-600 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : studentRequests.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              {t.no_student_requests}
            </div>
          ) : (
            <div className="space-y-3">
              {studentRequests.map((request) => (
                <div key={request.id} className={`rounded-lg border p-4 ${
                  request.status === 'pending' 
                    ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-600 dark:bg-yellow-900/20' 
                    : request.status === 'approved'
                    ? 'border-green-200 bg-green-50 dark:border-green-600 dark:bg-green-900/20'
                    : 'border-red-200 bg-red-50 dark:border-red-600 dark:bg-red-900/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {request.first_name} {request.last_name}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {t.requested_by}: {request.requested_by_user?.full_name || 'Unknown'}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {t.class}: {request.classes?.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {t.request_created_at}: {new Date(request.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        request.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : request.status === 'approved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {request.status === 'pending' ? t.request_pending : request.status === 'approved' ? t.request_approved : t.request_rejected}
                      </span>
                      {request.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => approveStudentRequest(request.id)}
                            className="rounded-lg bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                          >
                            {t.approve_request}
                          </button>
                          <button
                            onClick={() => rejectStudentRequest(request.id)}
                            className="rounded-lg bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                          >
                            {t.reject_request}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* -------------------- copy -------------------- */

const enText = {
  title: 'Principal Dashboard',
  subtitle: 'Manage groups, staff and visibility.',
  kpi_students: 'Total students',
  kpi_staff: 'Total staff',
  kpi_classes: 'Classes',
  kpi_incidents: 'Incidents (30d)',
  classes_management: 'Classes Management',
  add_class: 'Add class',
  invite_staff: 'Invite staff',
  refresh: 'Refresh',
  export: 'Export',
  settings: 'Settings',
  only_visible: 'Show only visible',
  search_ph: 'Search classes…',
  departments: 'Departments / Classes',
  overview_hint: 'Overview of groups across the school',
  col_name: 'Name',
  col_students: 'Students',
  col_staff: 'Staff',
  col_visible: 'Visible',
  col_actions: 'Actions',
  visible_yes: 'Yes',
  visible_no: 'No',
  hide: 'Hide',
  show: 'Show',
  empty: 'No classes match your filters.',
  recent_activity: 'Recent activity',
  quick_tips: 'Quick tips',
  act_added_class: 'Added class: {name}',
  act_invited: 'Invited new staff member: {name}',
  act_visibility_off: 'Set {name} to hidden',
  act_export: 'Exported monthly report',
  tip_roles: 'Use roles to limit access (RBAC).',
  tip_visibility: 'Toggle visibility per class before publishing.',
  tip_exports: 'Export data and audit trails anytime.',

  // Announcements
  announcements_title: 'Create Announcement',
  announcements_list: 'School Announcements',

  // Modal
  class_name: 'Class Name',
  class_name_placeholder: 'Enter class name',
  class_description: 'Description',
  class_description_placeholder: 'Enter class description (optional)',
  class_capacity: 'Capacity',
  class_capacity_placeholder: 'Enter max students',
  organization: 'Organization',
  select_organization: 'Select organization',
  cancel: 'Cancel',
  create_class: 'Create Class',

  // Staff Modal
  staff_name: 'Full Name',
  staff_name_placeholder: 'Enter full name',
  staff_email: 'Email',
  staff_email_placeholder: 'Enter email address',
  staff_role: 'Role',
  staff_phone: 'Phone',
  staff_phone_placeholder: 'Enter phone number (optional)',
  role_teacher: 'Teacher',
  role_assistant: 'Assistant',
  role_specialist: 'Specialist',
  invite_staff_btn: 'Send Invitation',
  staff_created_success: 'Staff member created successfully:',
  invitation_sent: 'Invitation has been sent.',
  staff_creation_error: 'Error creating staff member',
  assign_to_class: 'Assign to Class (Optional)',
  no_class_assigned: 'No class assigned',
  class_assignment_note: 'Teacher will be assigned to this class',
  sending: 'Sending...',
  remove_staff_member: 'Remove Staff Member',
  remove_staff_confirm: 'Are you sure you want to remove this staff member? This action cannot be undone.',
  remove: 'Remove',
  class_created: 'Class Created!',
  class_created_subtitle: 'Successfully added to your dashboard',
  class_is_ready: 'Class is Ready',
  class_created_message: 'has been created and is now visible in your dashboard.',
  class_details: 'Class Details',
  name: 'Name',
  status: 'Status',
  active: 'Active',
  staff: 'Staff',
  done: 'Done',
  staff_invited_success: 'Staff Invited Successfully!',
  invitation_sent_to: 'Invitation sent to',
  account_created_email_sent: 'Account Created & Email Sent',
  invitation_email_sent: 'An invitation email has been sent to',
  with_login_credentials: 'with login credentials.',
  login_credentials: 'Login Credentials',
  password: 'Password',
  copy: 'Copy',
  copy_all_credentials: 'Copy All Credentials',
  manage_staff: 'Manage Staff',
  staff_management: 'Staff Management',
  active_staff_members: 'Active Staff Members',
  pending_invitations: 'Pending Invitations',
  joined: 'Joined',
  sent: 'Sent',
  expires: 'Expires',
  actions: 'Actions',
  inactive: 'Inactive',
  delete: 'Delete',
  loading: 'Loading...',
  no_staff_members: 'No staff members yet',
  no_pending_invitations: 'No pending invitations',
  close: 'Close',

  // Guardian translations
  guardians: 'Guardians',
  create_guardian: 'Create Guardian',
  edit_guardian: 'Edit Guardian',
  delete_guardian: 'Delete Guardian',
  delete_guardian_confirm: 'Are you sure you want to delete this guardian?',
  no_guardians: 'No guardians yet',
  error_loading_guardians: 'Error loading guardians',
  error_creating_guardian: 'Error creating guardian',
  error_updating_guardian: 'Error updating guardian',

  // Student translations
  students: 'Students',
  create_student: 'Create Student',
  edit_student: 'Edit Student',
  delete_student: 'Delete Student',
  delete_student_confirm: 'Are you sure you want to delete this student?',
  student_name: 'Name',
  student_class: 'Class',
  student_guardians: 'Guardians',
  student_dob: 'Date of Birth',
  student_gender: 'Gender',
  no_students: 'No students yet',
  error_loading_students: 'Error loading students',
  error_creating_student: 'Error creating student',
  error_updating_student: 'Error updating student',
  student_age_requirement: 'Student must be between 0-18 years old',

  // Student form specific translations
  student_first_name_placeholder: 'Enter first name',
  student_last_name_placeholder: 'Enter last name',
  student_medical_notes_placeholder: 'Enter medical notes (optional)',
  student_allergies_placeholder: 'Enter allergies (optional)',
  student_emergency_contact_placeholder: 'Enter emergency contact (optional)',
  gender_unknown: 'Unknown',
  gender_male: 'Male',
  gender_female: 'Female',
  gender_other: 'Other',
  no_guardians_available: 'No guardians available',

  // Common form fields (only unique keys)
  full_name: 'Full Name',
  email: 'Email',
  phone: 'Phone',
  first_name: 'First Name',
  last_name: 'Last Name',
  dob: 'Date of Birth',
  gender: 'Gender',
  class: 'Class',
  medical_notes: 'Medical Notes',
  allergies: 'Allergies',
  emergency_contact: 'Emergency Contact',
  full_name_placeholder: 'Enter full name',
  email_placeholder: 'Enter email address',
  phone_placeholder: 'Enter phone number',
  status_placeholder: 'Select status',

  // Student request translations
  student_requests: 'Student Requests',
  no_student_requests: 'No student requests',
  requested_by: 'Requested by',
  request_created_at: 'Created at',
  request_pending: 'Pending',
  request_approved: 'Approved',
  request_rejected: 'Rejected',
  approve_request: 'Approve',
  reject_request: 'Reject',

  // Common form actions
  create: 'Create',
  update: 'Update',
  creating: 'Creating...',
  updating: 'Updating...',

};

const isText = {
  title: 'Stjórnandayfirlit',
  subtitle: 'Sýsla með hópa, starfsfólk og sýnileika.',
  kpi_students: 'Heildarfjöldi nemenda',
  kpi_staff: 'Heildarfjöldi starfsmanna',
  kpi_classes: 'Hópar',
  kpi_incidents: 'Atvik (30 dagar)',
  classes_management: 'Hópastjórnun',
  add_class: 'Bæta við hóp',
  invite_staff: 'Bjóða starfsmanni',
  refresh: 'Endurnýja',
  export: 'Flytja út',
  settings: 'Stillingar',
  only_visible: 'Sýna aðeins sýnilega',
  search_ph: 'Leita að hópum…',
  departments: 'Deildir / Hópar',
  overview_hint: 'Yfirsýn yfir hópa í skólanum',
  col_name: 'Nafn',
  col_students: 'Nemendur',
  col_staff: 'Starfsmenn',
  col_visible: 'Sýnileg',
  col_actions: 'Aðgerðir',
  visible_yes: 'Já',
  visible_no: 'Nei',
  hide: 'Gera ósýnilegt',
  show: 'Gera sýnilegt',
  empty: 'Engir hópar passa við síur.',
  recent_activity: 'Nýlegar aðgerðir',
  quick_tips: 'Flýtiráð',
  act_added_class: 'Bætt við hóp: {name}',
  act_invited: 'Boð sent til starfsmanns: {name}',
  act_visibility_off: 'Hópur {name} gerður ósýnilegur',
  act_export: 'Útflutningur á mánaðarskýrslu',
  tip_roles: 'Notaðu hlutverk til að stýra aðgengi (RBAC).',
  tip_visibility: 'Kveiktu/slökktu á sýnileika á hópum áður en birt er.',
  tip_exports: 'Flyttu út gögn og atvikaskrár hvenær sem er.',

  // Announcements
  announcements_title: 'Búa til tilkynningu',
  announcements_list: 'Tilkynningar skóla',

  // Modal
  class_name: 'Nafn hóps',
  class_name_placeholder: 'Sláðu inn nafn hóps',
  class_description: 'Lýsing',
  class_description_placeholder: 'Sláðu inn lýsingu hóps (valfrjálst)',
  class_capacity: 'Fjöldi',
  class_capacity_placeholder: 'Sláðu inn hámarksfjölda nemenda',
  organization: 'Stofnun',
  select_organization: 'Veldu stofnun',
  cancel: 'Hætta við',
  create_class: 'Búa til hóp',

  // Staff Modal
  staff_name: 'Fullt nafn',
  staff_name_placeholder: 'Sláðu inn fullt nafn',
  staff_email: 'Netfang',
  staff_email_placeholder: 'Sláðu inn netfang',
  staff_role: 'Hlutverk',
  staff_phone: 'Sími',
  staff_phone_placeholder: 'Sláðu inn símanúmer (valfrjálst)',
  role_teacher: 'Kennari',
  role_assistant: 'Aðstoðarkennari',
  role_specialist: 'Sérfræðingur',
  invite_staff_btn: 'Senda boð',
  staff_created_success: 'Starfsmaður búinn til:',
  invitation_sent: 'Boð hefur verið sent.',
  staff_creation_error: 'Villa við að búa til starfsmann',
  assign_to_class: 'Úthluta til hóps (valfrjálst)',
  no_class_assigned: 'Enginn hópur úthlutaður',
  class_assignment_note: 'Kennari verður úthlutaður til þessa hóps',
  sending: 'Sendi...',
  remove_staff_member: 'Fjarlægja starfsmann',
  remove_staff_confirm: 'Ertu viss um að þú viljir fjarlægja þennan starfsmann? Þessa aðgerð er ekki hægt að afturkalla.',
  remove: 'Fjarlægja',
  class_created: 'Hópur búinn til!',
  class_created_subtitle: 'Bætt við yfirlitið þitt',
  class_is_ready: 'Hópurinn er tilbúinn',
  class_created_message: 'hefur verið búinn til og er nú sýnilegur í yfirlitinu þínu.',
  class_details: 'Upplýsingar um hóp',
  name: 'Nafn',
  status: 'Staða',
  active: 'Virkur',
  students: 'Nemendur',
  staff: 'Starfsmenn',
  done: 'Lokið',
  staff_invited_success: 'Starfsmaður boðinn með góðum árangri!',
  invitation_sent_to: 'Boð sent til',
  account_created_email_sent: 'Aðgangur búinn til og tölvupóstur sentur',
  invitation_email_sent: 'Boð hefur verið sent til',
  with_login_credentials: 'með innskráningarskilyrðum.',
  login_credentials: 'Innskráningarskilyrði',
  email: 'Netfang',
  password: 'Lykilorð',
  copy: 'Afrita',
  copy_all_credentials: 'Afrita öll skilyrði',
  manage_staff: 'Sýsla með starfsfólk',
  staff_management: 'Sýsla með starfsfólk',
  active_staff_members: 'Virkir starfsmenn',
  pending_invitations: 'Bíðandi boð',
  joined: 'Gekk til liðs',
  sent: 'Sent',
  expires: 'Rennur út',
  actions: 'Aðgerðir',
  inactive: 'Óvirkur',
  delete: 'Eyða',
  loading: 'Hleður...',
  no_staff_members: 'Engir starfsmenn enn',
  no_pending_invitations: 'Engin bíðandi boð',
  close: 'Loka',

  // Guardian translations
  guardians: 'Forráðamenn',
  create_guardian: 'Búa til forráðamann',
  edit_guardian: 'Breyta forráðamanni',
  delete_guardian: 'Eyða forráðamanni',
  delete_guardian_confirm: 'Ertu viss um að þú viljir eyða þessum forráðamanni?',
  no_guardians: 'Engir forráðamenn enn',
  error_loading_guardians: 'Villa við að hlaða forráðamönnum',
  error_creating_guardian: 'Villa við að búa til forráðamann',
  error_updating_guardian: 'Villa við að uppfæra forráðamann',

  // Student translations
  student: 'Nemendur',
  create_student: 'Búa til nemanda',
  edit_student: 'Breyta nemanda',
  delete_student: 'Eyða nemanda',
  delete_student_confirm: 'Ertu viss um að þú viljir eyða þessum nemanda?',
  student_name: 'Nafn',
  student_class: 'Hópur',
  student_guardians: 'Forráðamenn',
  student_dob: 'Fæðingardagur',
  student_gender: 'Kyn',
  no_students: 'Engir nemendur enn',
  error_loading_students: 'Villa við að hlaða nemendum',
  error_creating_student: 'Villa við að búa til nemanda',
  error_updating_student: 'Villa við að uppfæra nemanda',
  student_age_requirement: 'Nemandi verður að vera á aldrinum 0-18 ára',

  // Student form specific translations
  student_first_name_placeholder: 'Sláðu inn fornafn',
  student_last_name_placeholder: 'Sláðu inn eftirnafn',
  student_medical_notes_placeholder: 'Sláðu inn læknisfræðilegar athugasemdir (valfrjálst)',
  student_allergies_placeholder: 'Sláðu inn ofnæmi (valfrjálst)',
  student_emergency_contact_placeholder: 'Sláðu inn neyðarsamband (valfrjálst)',
  gender_unknown: 'Óþekkt',
  gender_male: 'Karl',
  gender_female: 'Kona',
  gender_other: 'Annað',
  no_guardians_available: 'Engir forráðamenn tiltækir',

  // Common form fields (only unique keys)
  full_name: 'Fullt nafn',
  phone: 'Sími',
  first_name: 'Fornafn',
  last_name: 'Eftirnafn',
  dob: 'Fæðingardagur',
  gender: 'Kyn',
  class: 'Hópur',
  medical_notes: 'Læknisfræðilegar athugasemdir',
  allergies: 'Ofnæmi',
  emergency_contact: 'Neyðarsamband',
  full_name_placeholder: 'Sláðu inn fullt nafn',
  email_placeholder: 'Sláðu inn netfang',
  phone_placeholder: 'Sláðu inn símanúmer',
  status_placeholder: 'Veldu staðu',

  // Student request translations
  student_requests: 'Beiðnir nemenda',
  no_student_requests: 'Engar beiðnir nemenda',
  requested_by: 'Beiðni frá',
  request_created_at: 'Búið til',
  request_pending: 'Bíður',
  request_approved: 'Samþykkt',
  request_rejected: 'Hafnað',
  approve_request: 'Samþykkja',
  reject_request: 'Hafna',

  // Common form actions
  create: 'Búa til',
  update: 'Uppfæra',
  creating: 'Býr til...',
  updating: 'Uppfærir...',

};
