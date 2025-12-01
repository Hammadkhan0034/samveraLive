'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  School,
  BookOpen,
  Settings,
  Shield,
  UserPlus,
  GraduationCap,
  FileText,
  Database,
  Activity,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { StudentForm, type StudentFormData } from './shared/StudentForm';
import { DeleteConfirmationModal } from './shared/DeleteConfirmationModal';

interface AdminStats {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  totalParents: number;
  activeUsers: number;
  newRegistrations: number;
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string; timezone: string }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgForm, setOrgForm] = useState<{ id?: string; name: string; slug: string; timezone: string }>({ name: '', slug: '', timezone: 'UTC' });
  const [orgError, setOrgError] = useState<string | null>(null);
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false);
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);
  const [principals, setPrincipals] = useState<Array<{ id: string; email: string | null; phone: string | null; full_name?: string; first_name?: string | null; last_name?: string | null; name?: string | null; org_id: string; is_active: boolean; created_at: string }>>([]);
  const [loadingPrincipals, setLoadingPrincipals] = useState(false);
  const [principalError, setPrincipalError] = useState<string | null>(null);
  const [isSubmittingPrincipal, setIsSubmittingPrincipal] = useState(false);
  const [isDeletingPrincipal, setIsDeletingPrincipal] = useState(false);
  const [principalForm, setPrincipalForm] = useState<{ id?: string; first_name?: string; last_name?: string; full_name: string; email?: string; phone?: string; org_id: string; is_active?: boolean }>({ first_name: '', last_name: '', full_name: '', email: '', phone: '', org_id: '', is_active: true });
  const [principalPhoneError, setPrincipalPhoneError] = useState<string | null>(null);

  // Guardian states
  const [guardians, setGuardians] = useState<Array<{ id: string; email: string | null; phone: string | null; full_name: string; org_id: string; is_active: boolean; created_at: string; metadata?: any; org_name?: string }>>([]);
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [isSubmittingGuardian, setIsSubmittingGuardian] = useState(false);
  const [guardianForm, setGuardianForm] = useState<{ id?: string; first_name: string; last_name: string; email: string; phone: string; org_id: string; is_active?: boolean }>({ first_name: '', last_name: '', email: '', phone: '', org_id: '', is_active: true });

  // Teachers states
  const [teachers, setTeachers] = useState<Array<{ id: string; email: string | null; phone: string | null; first_name: string; last_name: string; org_id: string; is_active: boolean; created_at: string; org_name?: string }>>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  // Student states
  const [students, setStudents] = useState<Array<{ id: string; first_name: string; last_name: string | null; dob: string | null; gender: string; class_id: string | null; created_at: string; classes?: any; guardians?: Array<{ id: string; relation: string; users?: { id: string; full_name: string; email: string } }> }>>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState<StudentFormData>({ first_name: '', last_name: '', dob: '', gender: 'unknown', class_id: '', medical_notes: '', allergies: '', emergency_contact: '', org_id: '', guardian_ids: [], phone: '', address: '', registration_time: '', start_date: '', barngildi: 0, student_language: '', social_security_number: '' });

  // Classes states
  const [classes, setClasses] = useState<Array<{ id: string; name: string; code: string | null }>>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Global loading state - always false to show KPIs immediately
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const didInit = React.useRef(false);
  
  // Server-provided statistics
  const [serverStats, setServerStats] = useState<AdminStats | null>(null);

  // Modal states
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isDeleteOrgModalOpen, setIsDeleteOrgModalOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<string | null>(null);
  const [isPrincipalModalOpen, setIsPrincipalModalOpen] = useState(false);
  const [isDeletePrincipalModalOpen, setIsDeletePrincipalModalOpen] = useState(false);
  const [principalToDelete, setPrincipalToDelete] = useState<string | null>(null);
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [isDeleteGuardianModalOpen, setIsDeleteGuardianModalOpen] = useState(false);
  const [guardianToDelete, setGuardianToDelete] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isDeleteStudentModalOpen, setIsDeleteStudentModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);

  async function loadOrgs() {
    try {
      setLoadingOrgs(true);
      setOrgError(null);
      console.log('🔄 Loading organizations...');
      const res = await fetch('/api/orgs', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setOrgs(json.orgs || []);
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('admin_orgs', JSON.stringify(json.orgs || []));
        }
      } catch { }
      console.log('✅ Organizations loaded:', json.orgs?.length || 0, 'Organizations:', json.orgs);
    } catch (e: any) {
      setOrgError(e.message);
      console.error('❌ Error loading organizations:', e.message);
      // Keep existing orgs on error to avoid table flicker
    } finally {
      setLoadingOrgs(false);
    }
  }

  async function submitOrg(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      setIsSubmittingOrg(true);
      setOrgError(null);

      console.log('🔄 Submitting organization:', orgForm);

      const method = orgForm.id ? 'PUT' : 'POST';
      const res = await fetch('/api/orgs', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(orgForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      console.log('✅ Organization created/updated successfully');

      // Close modal and reset form
      setOrgForm({ name: '', slug: '', timezone: 'UTC' });
      setIsOrgModalOpen(false);

      // Optimistically update orgs if API returned the org; otherwise, refresh
      if ((json as any).org) {
        setOrgs(prev => {
          const idx = prev.findIndex(o => o.id === (json as any).org.id);
          if (idx === -1) return [(json as any).org, ...prev];
          const copy = [...prev];
          copy[idx] = (json as any).org;
          return copy;
        });
      }
      // Refresh dashboard data to ensure stats are updated
      loadDashboardData().catch(err => console.error('Error refreshing dashboard:', err));
    } catch (e: any) {
      console.error('❌ Error submitting organization:', e.message);
      setOrgError(e.message);
    } finally {
      setIsSubmittingOrg(false);
    }
  }

  function openCreateOrgModal() {
    setOrgForm({ name: '', slug: '', timezone: 'UTC' });
    setOrgError(null);
    setIsOrgModalOpen(true);
  }

  function openEditOrgModal(org: { id: string; name: string; slug: string; timezone: string }) {
    setOrgForm(org);
    setOrgError(null);
    setIsOrgModalOpen(true);
  }

  function openDeleteOrgModal(id: string) {
    setOrgToDelete(id);
    setIsDeleteOrgModalOpen(true);
  }

  async function confirmDeleteOrg() {
    if (!orgToDelete) return;
    try {
      setIsDeletingOrg(true);
      setOrgError(null);

      console.log('🔄 Deleting organization:', orgToDelete);

      const res = await fetch(`/api/orgs?id=${encodeURIComponent(orgToDelete)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      console.log('✅ Organization deleted successfully');

      // Close modal and reset state
      setIsDeleteOrgModalOpen(false);
      setOrgToDelete(null);

      // Optimistically remove from orgs to avoid flicker
      setOrgs(prev => prev.filter(o => o.id !== orgToDelete));
    } catch (e: any) {
      console.error('❌ Error deleting organization:', e.message);
      setOrgError(e.message);
    } finally {
      setIsDeletingOrg(false);
    }
  }

  // Load dashboard data from single API endpoint
  async function loadDashboardData() {
    try {
      console.log('🔄 Loading admin dashboard data from API...');
      
      const res = await fetch('/api/admin-dashboard', { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `Failed with ${res.status}`);
      }

      console.log('📥 Admin dashboard API response:', {
        stats: json.stats,
        orgs: json.orgs?.length || 0,
        principals: json.principals?.length || 0,
        teachers: json.teachers?.length || 0,
        guardians: json.guardians?.length || 0,
        students: json.students?.length || 0
      });

      // Update all state from single response
      setOrgs(json.orgs || []);
      setPrincipals(json.principals || []);
      setTeachers(json.teachers || []);
      setGuardians(json.guardians || []);
      setStudents(json.students || []);
      setServerStats(json.stats || null);

      // Cache data for instant loading on refresh
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('admin_orgs', JSON.stringify(json.orgs || []));
          sessionStorage.setItem('admin_principals', JSON.stringify(json.principals || []));
          sessionStorage.setItem('admin_teachers', JSON.stringify(json.teachers || []));
          sessionStorage.setItem('admin_guardians', JSON.stringify(json.guardians || []));
          sessionStorage.setItem('admin_students', JSON.stringify(json.students || []));
          sessionStorage.setItem('admin_stats', JSON.stringify(json.stats || null));
        } catch { }
      }

      console.log('✅ Admin dashboard data loaded successfully');
    } catch (e: any) {
      console.error('❌ Error loading admin dashboard data:', e.message);
      setOrgError(e.message);
      setPrincipalError(e.message);
      setGuardianError(e.message);
      setStudentError(e.message);
    }
  }

  // Load data immediately when component mounts - always load fresh, no cached data on refresh
  React.useEffect(() => {
    // Always clear in-memory data on mount to avoid showing stale values
    setOrgs([]);
    setPrincipals([]);
    setGuardians([]);
    setTeachers([]);
    setStudents([]);
    setServerStats(null);

    // Always load fresh data - only skip if already initialized in this render cycle
    if (didInit.current) {
      console.log('⏭️ Skipping data reload (already initialized this render)');
      return;
    }
    didInit.current = true;
    // Start loading fresh data immediately - no cached data on refresh
    loadDashboardData();
  }, []);

  // loadClasses removed to reduce unnecessary code and requests

  async function loadPrincipals() {
    try {
      setLoadingPrincipals(true);
      setPrincipalError(null);
      console.log('🔄 Loading principals...');
      const res = await fetch('/api/principals', { cache: 'no-store' });
      const json = await res.json();

      console.log('📥 Principals API response:', json);

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setPrincipals(json.principals || []);
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('admin_principals', JSON.stringify(json.principals || []));
        }
      } catch { }
      console.log('✅ Principals loaded:', json.principals?.length || 0, 'Principals:', json.principals);
    } catch (e: any) {
      setPrincipalError(e.message);
      console.error('❌ Error loading principals:', e.message);
      // Keep existing principals on error to avoid table flicker
    } finally {
      setLoadingPrincipals(false);
    }
  }

  // Validate phone number (optional but must be valid if provided)
  function validatePhoneNumber(phone: string | undefined): boolean {
    if (!phone || phone.trim() === '') return true; // Phone is optional
    // Allow various phone formats: digits, spaces, dashes, parentheses, plus sign
    // Minimum 7 digits, maximum 20 characters
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    const digitsOnly = phone.replace(/\D/g, '');
    return phoneRegex.test(phone.trim()) && digitsOnly.length >= 7 && digitsOnly.length <= 15;
  }

  async function submitPrincipal(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      setIsSubmittingPrincipal(true);
      setPrincipalError(null);

      // Validate phone number if provided
      if (principalForm.phone && !validatePhoneNumber(principalForm.phone)) {
        setPrincipalError(t.principal_phone_invalid || 'Please enter a valid phone number');
        setIsSubmittingPrincipal(false);
        return;
      }

      console.log('🔄 Submitting principal:', principalForm);

      const method = principalForm.id ? 'PUT' : 'POST';
      const res = await fetch('/api/principals', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(principalForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      console.log('✅ Principal created/updated successfully');

      // Optimistically update principals list immediately for instant KPI update
      if (json.principal || json.user) {
        const newPrincipal = json.principal || json.user;
        setPrincipals(prev => {
          // Check if already exists (update) or add new
          const exists = prev.find(p => p.id === newPrincipal.id);
          if (exists) {
            return prev.map(p => p.id === newPrincipal.id ? { ...p, ...newPrincipal } : p);
          } else {
            return [...prev, newPrincipal];
          }
        });
      }

      // Close modal and reset form
      setPrincipalForm({ id: undefined, full_name: '', email: '', org_id: '', is_active: true });
      setPrincipalPhoneError(null);
      setIsPrincipalModalOpen(false);

      // Force refresh dashboard data in background to ensure data is in sync
      loadDashboardData().catch(err => console.error('Error refreshing dashboard:', err));
    } catch (e: any) {
      console.error('❌ Error submitting principal:', e.message);
      setPrincipalError(e.message);
    } finally {
      setIsSubmittingPrincipal(false);
    }
  }

  function openCreatePrincipalModal() {
    setPrincipalForm({ first_name: '', last_name: '', full_name: '', email: '', phone: '', org_id: (orgs[0]?.id || ''), is_active: true });
    setPrincipalError(null);
    setPrincipalPhoneError(null);
    setIsPrincipalModalOpen(true);
  }

  function openEditPrincipalModal(principal: { id: string; email: string | null; phone: string | null; full_name?: string; first_name?: string | null; last_name?: string | null; name?: string | null; org_id: string; is_active: boolean }) {
    // Use first_name and last_name if available directly, otherwise split full_name or name
    let first = principal.first_name || '';
    let last = principal.last_name || '';
    
    if (!first && !last) {
      // Fallback: split full_name or name
      const fullName = principal.full_name || principal.name || '';
      const parts = fullName.trim().split(/\s+/);
      first = parts.shift() || '';
      last = parts.join(' ');
    }
    
    const fullName = [first, last].filter(Boolean).join(' ').trim();
    setPrincipalForm({ 
      id: principal.id, 
      first_name: first, 
      last_name: last, 
      full_name: fullName, 
      email: principal.email || '', 
      phone: principal.phone || '', 
      org_id: principal.org_id, 
      is_active: principal.is_active 
    });
    setPrincipalError(null);
    setPrincipalPhoneError(null);
    setIsPrincipalModalOpen(true);
  }

  function openDeletePrincipalModal(id: string) {
    setPrincipalToDelete(id);
    setIsDeletePrincipalModalOpen(true);
  }

  async function confirmDeletePrincipal() {
    if (!principalToDelete) return;
    try {
      setIsDeletingPrincipal(true);
      setPrincipalError(null);

      console.log('🔄 Deleting principal:', principalToDelete);

      const res = await fetch(`/api/principals?id=${encodeURIComponent(principalToDelete)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      console.log('✅ Principal deleted successfully');

      // Close modal and reset state
      setIsDeletePrincipalModalOpen(false);
      setPrincipalToDelete(null);

      // Force refresh dashboard data to ensure stats are updated
      console.log('🔄 Refreshing dashboard data...');
      await loadDashboardData();

      console.log('✅ Dashboard data refreshed');
    } catch (e: any) {
      console.error('❌ Error deleting principal:', e.message);
      setPrincipalError(e.message);
    } finally {
      setIsDeletingPrincipal(false);
    }
  }

  // Teachers functions - Load teachers from ALL organizations
  async function loadTeachers(showLoading = true) {
    try {
      if (showLoading) {
        setLoadingTeachers(true);
      }

      console.log('🔄 Loading teachers from ALL organizations. Available orgs:', orgs);

      if (orgs.length === 0) {
        console.log('⚠️ No organizations available, skipping teachers load');
        setTeachers([]);
        return;
      }

      // Load teachers from ALL organizations
      const allTeachers = [];

      for (const org of orgs) {
        try {
          console.log(`🔄 Loading teachers for org: ${org.name} (${org.id})`);
          const res = await fetch(`/api/staff-management?t=${Date.now()}`, { cache: 'no-store' });
          const json = await res.json();

          if (res.ok && json.staff) {
            const orgTeachers = json.staff.map((teacher: any) => ({
              id: teacher.id,
              email: teacher.email || null,
              phone: teacher.phone || null,
              first_name: teacher.first_name || '',
              last_name: teacher.last_name || '',
              org_id: teacher.org_id || org.id,
              is_active: teacher.is_active !== false,
              created_at: teacher.created_at || new Date().toISOString(),
              org_name: org.name // Add organization name for display
            }));
            allTeachers.push(...orgTeachers);
            console.log(`✅ Loaded ${orgTeachers.length} teachers from ${org.name}`);
          } else {
            console.log(`⚠️ No teachers found for ${org.name}`);
          }
        } catch (orgError) {
          console.error(`❌ Error loading teachers for ${org.name}:`, orgError);
        }
      }

      console.log('📋 Total teachers from all orgs:', allTeachers.length);
      setTeachers(allTeachers);
      // Cache teachers for instant loading on refresh
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('admin_teachers', JSON.stringify(allTeachers));
        } catch { }
      }
      console.log('✅ All teachers loaded and state updated');

    } catch (e: any) {
      console.error('❌ Error loading teachers:', e.message);
    } finally {
      if (showLoading) {
        setLoadingTeachers(false);
      }
    }
  }

  // Guardian functions - Load guardians from ALL organizations
  async function loadGuardians(showLoading = true) {
    try {
      if (showLoading) {
        setLoadingGuardians(true);
      }
      setGuardianError(null);

      console.log('🔄 Loading guardians from ALL organizations. Available orgs:', orgs);

      if (orgs.length === 0) {
        console.log('⚠️ No organizations available, using default org');
        const res = await fetch(`/api/guardians?t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();

        if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

        const guardiansList = json.guardians || [];
        setGuardians(guardiansList);
        console.log('✅ Default guardians loaded:', guardiansList.length);
        return;
      }

      // Load guardians from ALL organizations
      const allGuardians = [];

      for (const org of orgs) {
        try {
          console.log(`🔄 Loading guardians for org: ${org.name} (${org.id})`);
          const res = await fetch(`/api/guardians?t=${Date.now()}`, { cache: 'no-store' });
          const json = await res.json();

          if (res.ok && json.guardians) {
            const orgGuardians = json.guardians.map((guardian: any) => ({
              ...guardian,
              org_name: org.name // Add organization name for display
            }));
            allGuardians.push(...orgGuardians);
            console.log(`✅ Loaded ${orgGuardians.length} guardians from ${org.name}`);
          } else {
            console.log(`⚠️ No guardians found for ${org.name}`);
          }
        } catch (orgError) {
          console.error(`❌ Error loading guardians for ${org.name}:`, orgError);
        }
      }

      console.log('📋 Total guardians from all orgs:', allGuardians.length);
      console.log('📋 All guardians:', allGuardians);

      setGuardians(allGuardians);
      // Cache guardians for instant loading on refresh
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('admin_guardians', JSON.stringify(allGuardians));
        } catch { }
      }
      console.log('✅ All guardians loaded and state updated');

    } catch (e: any) {
      console.error('❌ Error loading guardians:', e.message);
      setGuardianError(e.message);
    } finally {
      if (showLoading) {
        setLoadingGuardians(false);
      }
    }
  }

  async function submitGuardian(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      setIsSubmittingGuardian(true);
      setGuardianError(null);
      const method = guardianForm.id ? 'PUT' : 'POST';
      const requestData = {
        ...guardianForm,
        created_by: 'admin-user-id' // In real app, get from session
      };

      const res = await fetch('/api/guardians', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });
      const json = await res.json();
      console.log('📥 Guardian API response:', json);

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      // Optimistically update guardians list immediately for instant KPI update
      if (json.guardian || json.user) {
        const newGuardian = json.guardian || json.user;
        setGuardians(prev => {
          // Check if already exists (update) or add new
          const exists = prev.find(g => g.id === newGuardian.id);
          if (exists) {
            return prev.map(g => g.id === newGuardian.id ? { ...g, ...newGuardian } : g);
          } else {
            return [...prev, { ...newGuardian, org_name: orgs.find(o => o.id === newGuardian.org_id)?.name || '' }];
          }
        });
      }

      setIsGuardianModalOpen(false);
      setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', org_id: '', is_active: true });

      // Force refresh dashboard data in background to ensure data is in sync
      console.log('🔄 Refreshing dashboard data in background...');
      loadDashboardData().catch(err => console.error('Error refreshing dashboard:', err));

      // Guardian created successfully - data already refreshed in table
    } catch (e: any) {
      console.error('❌ Error submitting guardian:', e.message);
      setGuardianError(e.message);
    } finally {
      setIsSubmittingGuardian(false);
    }
  }

  function openCreateGuardianModal() {
    const orgId = orgs.length > 0 ? orgs[0].id : '1';
    setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', org_id: orgId, is_active: true });
    setGuardianError(null);
    setIsGuardianModalOpen(true);
  }



  function openEditGuardianModal(guardian: any) {
    const [fn, ...rest] = (guardian.full_name || '').trim().split(/\s+/);
    setGuardianForm({
      id: guardian.id,
      first_name: guardian.first_name ?? fn ?? '',
      last_name: guardian.last_name ?? rest.join(' ') ?? '',
      email: guardian.email || '',
      phone: guardian.phone || '',
      org_id: guardian.org_id || (orgs.length > 0 ? orgs[0].id : '1'),
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
      await loadDashboardData();
    } catch (e: any) {
      setGuardianError(e.message);
    }
  }

  // Student functions - Load students from ALL organizations
  async function loadStudents(showLoading = true) {
    try {
      if (showLoading) {
        setLoadingStudents(true);
      }
      setStudentError(null);

      console.log('🔄 Loading students from ALL organizations. Available orgs:', orgs);

      if (orgs.length === 0) {
        console.log('⚠️ No organizations available, skipping students load');
        setStudents([]);
        return;
      }

      // Load students from ALL organizations
      const allStudents = [];

      for (const org of orgs) {
        try {
          console.log(`🔄 Loading students for org: ${org.name} (${org.id})`);
          const res = await fetch(`/api/students?t=${Date.now()}`, { cache: 'no-store' });
          const json = await res.json();

          if (res.ok && json.students) {
            // Flatten the nested structure - students API returns users nested
            const orgStudents = json.students.map((student: any) => ({
              id: student.id || student.user_id,
              user_id: student.user_id,
              class_id: student.class_id,
              org_id: org.id,
              first_name: student.users?.first_name || student.first_name || '',
              last_name: student.users?.last_name || student.last_name || null,
              dob: student.users?.dob || student.dob || null,
              gender: student.users?.gender || student.gender || 'unknown',
              phone: student.users?.phone || student.phone || null,
              address: student.users?.address || student.address || null,
              ssn: student.users?.ssn || student.ssn || null,
              registration_time: student.registration_time || null,
              start_date: student.start_date || null,
              barngildi: student.barngildi || null,
              created_at: student.created_at || new Date().toISOString(),
              classes: student.classes || null,
              guardians: student.guardians || [],
              org_name: org.name // Add organization name for display
            }));
            allStudents.push(...orgStudents);
            console.log(`✅ Loaded ${orgStudents.length} students from ${org.name}`);
            console.log(`📋 Sample student data:`, orgStudents[0]);
          } else {
            console.log(`⚠️ No students found for ${org.name}`, json);
          }
        } catch (orgError) {
          console.error(`❌ Error loading students for ${org.name}:`, orgError);
        }
      }

      console.log('📋 Total students from all orgs:', allStudents.length);
      console.log('📋 Students data (first 3):', allStudents.slice(0, 3));
      console.log('📋 All students count for stats:', allStudents.length);

      // Validate students data before setting
      const validStudents = allStudents.filter((s: any) => s && (s.id || s.user_id));
      console.log('✅ Valid students count (after filtering):', validStudents.length);

      setStudents(validStudents);
      // Cache students for instant loading on refresh
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('admin_students', JSON.stringify(validStudents));
          console.log('✅ Students cached in sessionStorage');
        } catch { }
      }
      console.log('✅ All students loaded and state updated - students count:', validStudents.length);
    } catch (e: any) {
      console.error('❌ Error loading students:', e.message);
      setStudentError(e.message);
    } finally {
      if (showLoading) {
        setLoadingStudents(false);
      }
    }
  }

  // Load guardians and classes when student modal opens
  async function loadGuardiansForStudent() {
    try {
      const orgId = orgs.length > 0 ? orgs[0].id : '1';

      const res = await fetch(`/api/guardians?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const guardiansList = json.guardians || [];
      setGuardians(guardiansList);

      // Also refresh classes
    } catch (e: any) {
      console.error('❌ Error loading guardians for student:', e.message);
    }
  }

  // Validate student age
  function validateStudentAge(dob: string): boolean {
    if (!dob) return true; // No DOB is valid

    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Calculate actual age
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ? age - 1
      : age;

    return actualAge >= 0 && actualAge <= 18;
  }

  async function submitStudent(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      setIsSubmittingStudent(true);
      setStudentError(null);

      // Validate age before submitting
      if (studentForm.dob && !validateStudentAge(studentForm.dob)) {
        setStudentError('Student age must be between 0 and 18 years old');
        return;
      }

      const method = studentForm.id ? 'PUT' : 'POST';
      const requestData = {
        ...studentForm,
        created_by: 'admin-user-id' // In real app, get from session
      };

      const res = await fetch('/api/students', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      // Optimistically update students list immediately for instant KPI update
      if (json.student || json.user) {
        const newStudent = json.student || json.user;
        setStudents(prev => {
          // Check if already exists (update) or add new
          const exists = prev.find(s => s.id === newStudent.id);
          if (exists) {
            return prev.map(s => s.id === newStudent.id ? { ...s, ...newStudent } : s);
          } else {
            return [...prev, { ...newStudent, org_name: orgs.find(o => o.id === newStudent.org_id)?.name || '' }];
          }
        });
      }

      setIsStudentModalOpen(false);
      setStudentForm({
        first_name: '',
        last_name: '',
        dob: '',
        gender: 'unknown',
        class_id: '',
        medical_notes: '',
        allergies: '',
        emergency_contact: '',
        // keeps the same org the user selected
        org_id: studentForm.org_id || (orgs[0]?.id || '1'),
        guardian_ids: [],
        phone: '',
        address: '',
        registration_time: '',
        start_date: '',
        barngildi: 0,
        student_language: '',
        social_security_number: ''
      });

      // Force refresh the students list in background to ensure data is in sync
      loadStudents(false).catch(err => console.error('Error refreshing students:', err));

      // Student created successfully - data already refreshed in table
    } catch (e: any) {
      console.error('❌ Error submitting student:', e.message);
      setStudentError(e.message);
    } finally {
      setIsSubmittingStudent(false);
    }
  }

  function openCreateStudentModal() {
    const orgId = orgs.length > 0 ? orgs[0].id : '1';
    setStudentForm({ first_name: '', last_name: '', dob: '', gender: 'unknown', class_id: '', medical_notes: '', allergies: '', emergency_contact: '', org_id: orgId, guardian_ids: [], phone: '', address: '', registration_time: '', start_date: '', barngildi: 0, student_language: '', social_security_number: '' });
    setStudentError(null);
    setIsStudentModalOpen(true);
    // Load guardians when opening the modal
    loadGuardiansForStudent();
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
      org_id: student.org_id || (orgs.length > 0 ? orgs[0].id : '1'),
      guardian_ids: [],

      // required fields to satisfy StudentFormData
      phone: student.phone || '',
      address: student.address || '',
      registration_time: student.registration_time || '',
      start_date: student.start_date || '',
      barngildi: student.barngildi ?? 0,
      student_language: student.student_language || '',
      social_security_number: student.social_security_number || ''
    });
    setStudentError(null);
    setIsStudentModalOpen(true);
    // Load guardians when opening the modal
    loadGuardiansForStudent();
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
      await loadDashboardData();
    } catch (e: any) {
      setStudentError(e.message);
    }
  }

  // Use server-provided stats, fallback to default if not loaded yet
  const stats: AdminStats = React.useMemo(() => {
    if (serverStats) {
      return serverStats;
    }
    // Return default stats while loading
    return {
      totalUsers: 0,
      totalTeachers: 0,
      totalStudents: 0,
      totalParents: 0,
      activeUsers: 0,
      newRegistrations: 0
    };
  }, [serverStats]);

  const recentActivities = [
    { id: 1, type: 'user_registration', user: 'Anna Jónsdóttir', role: 'Teacher', time: '2 minutes ago' },
    { id: 2, type: 'user_login', user: 'Björn Guðmundsson', role: 'Student', time: '5 minutes ago' },
    { id: 3, type: 'user_registration', user: 'Sigríður Einarsdóttir', role: 'Parent', time: '12 minutes ago' },
    { id: 4, type: 'system_alert', user: 'System', role: 'System', time: '1 hour ago' },
  ];

  const quickActions = [
    {
      title: t.addNewUser,
      description: t.createNewUserAccount,
      icon: UserPlus,
      color: 'bg-blue-500',
      action: () => console.log('Add user')
    },
    {
      title: t.manageSchools,
      description: t.configureSchoolSettings,
      icon: School,
      color: 'bg-green-500',
      action: () => console.log('Manage schools')
    },
    {
      title: t.systemSettings,
      description: t.configureSystemPreferences,
      icon: Settings,
      color: 'bg-purple-500',
      action: () => console.log('System settings')
    },
    {
      title: t.generateReports,
      description: t.createUsageAnalyticsReports,
      icon: FileText,
      color: 'bg-orange-500',
      action: () => console.log('Generate reports')
    },
  ];

  // Tinted backgrounds for stat cards
  const statCardBgColors = [
    'bg-pale-blue dark:bg-slate-800',
    'bg-pale-yellow dark:bg-slate-800',
    'bg-pale-peach dark:bg-slate-800',
    'bg-mint-100 dark:bg-slate-800',
  ];

  const StatCard = ({ title, value, icon: Icon, color, trend, onClick, index = 0 }: {
    title: string;
    value: number;
    icon: React.ComponentType<any>;
    color: string;
    trend?: string;
    onClick?: () => void;
    index?: number;
  }) => {
    const bgColor = statCardBgColors[index % statCardBgColors.length];
    return (
      <div
        className={`rounded-ds-lg p-ds-md shadow-ds-card h-36 ${bgColor} ${onClick ? 'cursor-pointer hover:shadow-ds-lg transition-all duration-200' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : -1}
      >
        <div className="flex items-start justify-between h-full">
          <div className="flex-1">
            <p className="text-ds-small font-medium text-slate-600 dark:text-slate-400 mb-1">{title}</p>
            <p className="text-ds-h2 font-bold text-slate-900 dark:text-slate-100 mb-1">{value.toLocaleString()}</p>
            <div className="h-4">
              {trend && (
                <p className="text-ds-tiny text-mint-600 dark:text-green-400">{trend}</p>
              )}
            </div>
          </div>
          <div className="rounded-ds-md bg-white/50 dark:bg-slate-700 p-3 flex-shrink-0">
            <Icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
          </div>
        </div>
      </div>
    );
  };

  const ActivityItem = ({ activity }: { activity: any }) => {
    const getActivityIcon = () => {
      switch (activity.type) {
        case 'user_registration':
          return <UserPlus className="h-4 w-4 text-green-500" />;
        case 'user_login':
          return <Activity className="h-4 w-4 text-blue-500" />;
        case 'system_alert':
          return <AlertTriangle className="h-4 w-4 text-orange-500" />;
        default:
          return <Activity className="h-4 w-4 text-slate-500" />;
      }
    };

    const getActivityText = () => {
      switch (activity.type) {
        case 'user_registration':
          return `${activity.user} ${t.registeredAs} ${activity.role}`;
        case 'user_login':
          return `${activity.user} ${t.loggedIn}`;
        case 'system_alert':
          return t.systemAlertTriggered;
        default:
          return 'Unknown activity';
      }
    };

    return (
      <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
        {getActivityIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {getActivityText()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{activity.time}</p>
        </div>
      </div>
    );
  };


  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500 mt-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {t.adminDashboard}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {t.manageUsersSchools}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.adminAccess}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.fullPermissions}</p>
            </div>
            {/* Sign out button removed from Admin header; use Navbar sign out instead */}
          </div>
        </div>
      </motion.div>


      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-ds-md mb-ds-lg"
      >
        <StatCard
          title={t.totalUsers}
          value={stats.totalUsers}
          icon={Users}
          color="bg-blue-500"
          trend={`+12% ${t.thisMonth}`}
          index={0}
        />
        <StatCard
          title={t.teachers}
          value={stats.totalTeachers}
          icon={GraduationCap}
          color="bg-green-500"
          index={1}
        />
        <StatCard
          title={t.students}
          value={stats.totalStudents ?? 0}
          icon={BookOpen}
          color="bg-purple-500"
          key={`students-${students.length}-${stats.totalStudents}`}
          index={2}
        />
        <StatCard
          title={t.parents}
          value={stats.totalParents}
          icon={Users}
          color="bg-orange-500"
          key={`parents-${stats.totalParents}`}
          index={3}
        />
        <StatCard
          title={t.activeUsers}
          value={stats.activeUsers}
          icon={Activity}
          color="bg-emerald-500"
          trend={`+8% ${t.thisWeek}`}
          index={0}
        />
        <StatCard
          title={t.newThisWeek}
          value={stats.newRegistrations}
          icon={UserPlus}
          color="bg-pink-500"
          index={1}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-ds-md">
        {/* Organizations Manager */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0 }}
          className="lg:col-span-1"
        >
          <div className="bg-white dark:bg-slate-800 rounded-ds-lg p-ds-md shadow-ds-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">{t.organizations}</h3>
              <button
                onClick={openCreateOrgModal}
                className="inline-flex items-center gap-0.5 rounded-ds-md bg-mint-500 hover:bg-mint-600 text-white px-3 py-2 text-ds-small transition-colors"
              >
                <Plus className="h-3.5 w-3.5 mt-0.5" />
                {t.create}
              </button>
            </div>
            <div className="overflow-y-auto max-h-64 rounded-ds-md border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                  <tr className="text-left text-slate-600 dark:text-slate-300">
                    <th className="py-2 pr-3">{t.table_name}</th>
                    <th className="py-2 pr-3">{t.table_slug}</th>
                    <th className="py-2 pr-3">{t.table_timezone}</th>
                    <th className="py-2 pr-3">{t.table_actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {orgs.length === 0 ? (
                    <tr><td colSpan={4} className="py-4">{t.table_no_data}</td></tr>
                  ) : (
                    orgs.map((o) => (
                      <tr key={o.id} className="h-12 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 dark:text-slate-100">
                        <td className="py-2 pr-3">{o.name}</td>
                        <td className="py-2 pr-3">{o.slug}</td>
                        <td className="py-2 pr-3">{o.timezone}</td>
                        <td className="py-2 pr-3 space-x-2">
                          <button
                            onClick={() => openEditOrgModal(o)}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 dark:border-slate-700 dark:hover:bg-slate-700"
                          >
                            <Edit className="h-3 w-3" />
                            {/* {t.table_edit} */}
                          </button>
                          <button
                            onClick={() => openDeleteOrgModal(o.id)}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-red-50 text-red-600 border-red-300 dark:border-red-700 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3 w-3" />
                            {/* {t.table_delete} */}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Principals Manager */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0 }}
          className="lg:col-span-1"
        >
          <div className="bg-white dark:bg-slate-800 rounded-ds-md p-ds-md shadow-ds-card border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">{t.principals}</h3>
              <button
                onClick={openCreatePrincipalModal}
                className="inline-flex items-center gap-0.5 rounded-ds-md bg-mint-500 text-white px-3 py-2 text-ds-small hover:bg-mint-600 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 mt-0.5" />
                {t.create}
              </button>
            </div>
            <div className="overflow-y-auto max-h-64 rounded-md border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                  <tr className="text-left text-slate-600 dark:text-slate-300">
                    <th className="py-2 pr-3">{t.table_name}</th>
                    <th className="py-2 pr-3">{t.principal_email}</th>
                    <th className="py-2 pr-3">{t.principal_phone}</th>
                    <th className="py-2 pr-3">{t.principal_org}</th>
                    <th className="py-2 pr-3">{t.principal_status}</th>
                    <th className="py-2 pr-3">{t.table_actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {principals.length === 0 ? (
                    <tr><td colSpan={6} className="py-4">{t.table_no_data}</td></tr>
                  ) : (
                    principals.map((p) => (
                      <tr key={p.id} className="h-12 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 dark:text-slate-100">
                        <td className="py-2 pr-3">{(p as any).name || p.email || '—'}</td>
                        <td className="py-2 pr-3">{p.email || '—'}</td>
                        <td className="py-2 pr-3">{p.phone || '—'}</td>
                        <td className="py-2 pr-3">{orgs.find(o => o.id === p.org_id)?.name || p.org_id}</td>
                        <td className="py-2 pr-3">{p.is_active ? t.active : t.inactive}</td>
                        <td className="py-2 pr-3 space-x-2">
                          <button
                            onClick={() => openEditPrincipalModal(p)}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 dark:border-slate-700 dark:hover:bg-slate-700"
                          >
                            <Edit className="h-3 w-3" />
                            {/* {t.table_edit} */}
                          </button>
                          <button
                            onClick={() => openDeletePrincipalModal(p.id)}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-red-50 text-red-600 border-red-300 dark:border-red-700 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3 w-3" />
                            {/* {t.table_delete} */}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

      </div>

      {/* Recent Activities and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Recent Activities */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-ds-md p-ds-md shadow-ds-card border border-slate-200 dark:border-slate-700">
            <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Recent Activities
            </h3>
            <div className="space-y-3">
              {recentActivities.map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-ds-md p-ds-md shadow-ds-card border border-slate-200 dark:border-slate-700">
            <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {t.quickActions}
            </h3>
            <div className="space-y-0.5">
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  onClick={action.action}
                  className="w-full flex items-center space-x-3 p-3 rounded-ds-md hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                >
                  <div className={`p-2 rounded-ds-md ${action.color}`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{action.title}</p>
                    <p className="text-ds-small text-slate-500 dark:text-slate-400">{action.description}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* System Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
        className="mt-8"
      >
        <div className="bg-white dark:bg-slate-800 rounded-ds-md p-ds-md shadow-ds-card border border-slate-200 dark:border-slate-700">
          <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100 mb-4">
            {t.systemStatus}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-3 rounded-ds-md bg-green-50 dark:bg-green-900/20">
              <div className="p-2 bg-green-500 rounded-ds-md">
                <Database className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">{t.database}</p>
                <p className="text-sm text-green-600 dark:text-green-400">{t.operational}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="p-2 bg-green-500 rounded-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">{t.api}</p>
                <p className="text-sm text-green-600 dark:text-green-400">{t.healthy}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-100">{t.backup}</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">{t.pending}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Organization Create/Edit Modal */}
      {isOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-ds-lg bg-white dark:bg-slate-800 p-ds-md shadow-ds-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
                {orgForm.id ? t.edit_organization : t.create_organization}
              </h3>
              <button
                onClick={() => setIsOrgModalOpen(false)}
                className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitOrg} className="space-y-4">
              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.organization_name}
                </label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder={t.organization_name_placeholder}
                  className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.organization_slug}
                </label>
                <input
                  type="text"
                  value={orgForm.slug}
                  onChange={(e) => setOrgForm((p) => ({ ...p, slug: e.target.value }))}
                  placeholder={t.organization_slug_placeholder}
                  className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.organization_timezone}
                </label>
                <input
                  type="text"
                  value={orgForm.timezone}
                  onChange={(e) => setOrgForm((p) => ({ ...p, timezone: e.target.value }))}
                  placeholder={t.organization_timezone_placeholder}
                  className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:text-white"
                />
              </div>

              {orgError && (
                <div className="text-ds-small text-red-600 dark:text-red-400">{orgError}</div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOrgModalOpen(false)}
                  className="flex-1 rounded-ds-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-ds-small hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t.cancel_delete}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOrg}
                  className="flex-1 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {isSubmittingOrg ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {orgForm.id ? t.updating : t.creating}
                    </>
                  ) : (
                    orgForm.id ? t.update : t.create
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Organization Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteOrgModalOpen}
        onClose={() => setIsDeleteOrgModalOpen(false)}
        onConfirm={confirmDeleteOrg}
        title={t.delete_organization_title}
        message={t.delete_organization_message}
        loading={isDeletingOrg}
        error={orgError}
        confirmButtonText={t.confirm_delete}
        cancelButtonText={t.cancel_delete}
      />

      {/* Principal Create/Edit Modal */}
      {isPrincipalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-ds-lg bg-white dark:bg-slate-800 p-ds-md shadow-ds-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
                {principalForm.id ? t.edit_principal : t.create_principal}
              </h3>
              <button
                onClick={() => {
                  setIsPrincipalModalOpen(false);
                  setPrincipalPhoneError(null);
                }}
                className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitPrincipal} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.principal_first_name}
                  </label>
                  <input
                    type="text"
                    value={principalForm.first_name || ''}
                    onChange={(e) => setPrincipalForm((p) => ({ ...p, first_name: e.target.value, full_name: `${e.target.value} ${p.last_name || ''}`.trim() }))}
                    placeholder={t.principal_first_name_placeholder}
                    className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.principal_last_name}
                  </label>
                  <input
                    type="text"
                    value={principalForm.last_name || ''}
                    onChange={(e) => setPrincipalForm((p) => ({ ...p, last_name: e.target.value, full_name: `${p.first_name || ''} ${e.target.value}`.trim() }))}
                    placeholder={t.principal_last_name_placeholder}
                    className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.principal_email}
                </label>
                <input
                  type="email"
                  value={principalForm.email || ''}
                  onChange={(e) => setPrincipalForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder={t.principal_email_placeholder}
                  className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.principal_phone}
                </label>
                <input
                  type="tel"
                  value={principalForm.phone || ''}
                  onChange={(e) => {
                    const phoneValue = e.target.value;
                    setPrincipalForm((p) => ({ ...p, phone: phoneValue }));
                    // Validate on change
                    if (phoneValue && !validatePhoneNumber(phoneValue)) {
                      setPrincipalPhoneError(t.principal_phone_invalid || 'Please enter a valid phone number');
                    } else {
                      setPrincipalPhoneError(null);
                    }
                  }}
                  onBlur={(e) => {
                    // Validate on blur
                    if (e.target.value && !validatePhoneNumber(e.target.value)) {
                      setPrincipalPhoneError(t.principal_phone_invalid || 'Please enter a valid phone number');
                    } else {
                      setPrincipalPhoneError(null);
                    }
                  }}
                  placeholder={t.principal_phone_placeholder}
                  className={`w-full rounded-ds-md border bg-white dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 dark:text-white ${
                    principalPhoneError
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                      : 'border-slate-300 dark:border-slate-600 focus:border-mint-500 focus:ring-mint-500'
                  }`}
                />
                {principalPhoneError && (
                  <p className="mt-1 text-ds-tiny text-red-600 dark:text-red-400">{principalPhoneError}</p>
                )}
              </div>

              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.principal_org}
                </label>
                <select
                  value={principalForm.org_id}
                  onChange={(e) => setPrincipalForm((p) => ({ ...p, org_id: e.target.value }))}
                  className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:text-white"
                  required
                >
                  <option value="">Select organization</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.status}
                </label>
                <select
                  value={principalForm.is_active ? 'true' : 'false'}
                  onChange={(e) => setPrincipalForm((p) => ({ ...p, is_active: e.target.value === 'true' }))}
                  className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-ds-small text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:text-white"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              {principalError && (
                <div className="text-ds-small text-red-600 dark:text-red-400">{principalError}</div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsPrincipalModalOpen(false);
                    setPrincipalPhoneError(null);
                  }}
                  className="flex-1 rounded-ds-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-ds-small hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t.cancel_delete}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPrincipal}
                  className="flex-1 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {isSubmittingPrincipal ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {principalForm.id ? t.updating : t.creating}
                    </>
                  ) : (
                    principalForm.id ? t.update : t.create
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Principal Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeletePrincipalModalOpen}
        onClose={() => setIsDeletePrincipalModalOpen(false)}
        onConfirm={confirmDeletePrincipal}
        title={t.delete_principal_title}
        message={t.delete_principal_message}
        loading={isDeletingPrincipal}
        error={principalError}
        confirmButtonText={t.confirm_delete}
        cancelButtonText={t.cancel_delete}
      />


      {/* Student Create/Edit Modal */}
      <StudentForm
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        onSubmit={async (data: StudentFormData) => {
          const method = data.id ? 'PUT' : 'POST';
          const requestData = {
            ...data,
            created_by: 'admin-user-id' // In real app, get from session
          };

          const res = await fetch('/api/students', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
          });
          const json = await res.json();

          if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

          // Optimistically update students list immediately for instant KPI update
          if (json.student || json.user) {
            const newStudent = json.student || json.user;
            setStudents(prev => {
              // Check if already exists (update) or add new
              const exists = prev.find(s => s.id === newStudent.id);
              if (exists) {
                return prev.map(s => s.id === newStudent.id ? { ...s, ...newStudent } : s);
              } else {
                return [...prev, { ...newStudent, org_name: orgs.find(o => o.id === newStudent.org_id)?.name || '' }];
              }
            });
          }

      setIsStudentModalOpen(false);
      setStudentForm({ first_name: '', last_name: '', dob: '', gender: 'unknown', class_id: '', medical_notes: '', allergies: '', emergency_contact: '', org_id: '', guardian_ids: [], phone: '', address: '', registration_time: '', start_date: '', barngildi: 0, student_language: '', social_security_number: '' });

      // Force refresh dashboard data in background to ensure data is in sync
      loadDashboardData().catch(err => console.error('Error refreshing dashboard:', err));
        }}
        initialData={studentForm}
        loading={isSubmittingStudent}
        error={studentError}
        guardians={guardians}
        classes={classes}
        orgId={process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7'}
        translations={{
          create_student: t.create_student,
          edit_student: t.edit_student,
          student_first_name: t.student_first_name,
          student_last_name: t.student_last_name,
          student_dob: t.student_dob,
          student_gender: t.student_gender,
          student_class: t.student_class,
          student_guardians: t.student_guardians,
          student_medical_notes: t.student_medical_notes,
          student_allergies: t.student_allergies,
          student_emergency_contact: t.student_emergency_contact,
          student_phone: t.phone,
          student_registration_time: 'Registration Time',
          student_address: t.address,
          student_start_date: 'Start Date',
          student_child_value: 'Child value',
          student_language: 'Language',
          student_social_security_number: t.ssn,
          student_first_name_placeholder: t.student_first_name_placeholder,
          student_last_name_placeholder: t.student_last_name_placeholder,
          student_medical_notes_placeholder: t.student_medical_notes_placeholder,
          student_allergies_placeholder: t.student_allergies_placeholder,
          student_emergency_contact_placeholder: t.student_emergency_contact_placeholder,
          student_registration_time_placeholder: 'YYYY-MM-DD HH:MM',
          student_social_security_number_placeholder: t.ssn_placeholder,
          student_phone_placeholder: t.phone_placeholder,
          student_child_value_placeholder: '1.0 or 1.7',
          student_address_placeholder: t.address_placeholder,
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

      {/* Student Create/Edit Modal - OLD */}
      {false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-ds-lg bg-white dark:bg-slate-800 p-ds-md shadow-ds-lg max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
                {studentForm.id ? t.edit_student : t.create_student}
              </h3>
              <button
                onClick={() => setIsStudentModalOpen(false)}
                className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitStudent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_first_name}
                  </label>
                  <input
                    type="text"
                    value={studentForm.first_name}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder={t.student_first_name_placeholder}
                    className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_last_name}
                  </label>
                  <input
                    type="text"
                    value={studentForm.last_name}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder={t.student_last_name_placeholder}
                    className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_dob}
                  </label>
                  <input
                    type="date"
                    value={studentForm.dob}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, dob: e.target.value }))}
                    className={`w-full rounded-ds-md border px-3 py-2 text-ds-small focus:outline-none focus:ring-1 dark:bg-slate-700 dark:text-slate-200 ${studentForm.dob && !validateStudentAge(studentForm.dob)
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 dark:border-slate-600 focus:border-mint-500 focus:ring-mint-500'
                      }`}
                  />
                  <p className={`mt-1 text-ds-tiny ${studentForm.dob && !validateStudentAge(studentForm.dob)
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-slate-500 dark:text-slate-400'
                    }`}>
                    {studentForm.dob && !validateStudentAge(studentForm.dob)
                      ? 'Student age must be between 0-18 years old'
                      : t.student_age_requirement
                    }
                  </p>
                </div>

                <div>
                  <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_gender}
                  </label>
                  <select
                    value={studentForm.gender}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, gender: e.target.value }))}
                    className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="Unknown">{t.gender_unknown}</option>
                    <option value="Male">{t.gender_male}</option>
                    <option value="Female">{t.gender_female}</option>
                    <option value="Other">{t.gender_other}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_class}
                </label>
                <select
                  value={studentForm.class_id}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, class_id: e.target.value }))}
                  className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200"
                >
                  <option value="">{t.no_class_assigned}</option>
                  {/* Classes will be loaded from API */}
                </select>
              </div>

              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_guardians}
                </label>
                <select
                  multiple
                  value={studentForm.guardian_ids}
                  onChange={(e) => {
                    const selectedIds = Array.from(e.target.selectedOptions, option => option.value);
                    setStudentForm(prev => ({
                      ...prev,
                      guardian_ids: selectedIds
                    }));
                  }}
                  className="w-full rounded-ds-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200"
                  size={4}
                >
                  {guardians.length === 0 ? (
                    <option value="" disabled>{t.no_guardians_available}</option>
                  ) : (
                    guardians.map((guardian) => (
                      <option key={guardian.id} value={guardian.id}>
                        {guardian.full_name}
                      </option>
                    ))
                  )}
                </select>
                {/* <p className="mt-1 text-ds-tiny text-slate-500 dark:text-slate-400">
                  {t.student_guardians_dropdown_help}
                </p> */}
              </div>

              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_medical_notes}
                </label>
                <textarea
                  value={studentForm.medical_notes}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, medical_notes: e.target.value }))}
                  placeholder={t.student_medical_notes_placeholder}
                  className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_allergies}
                </label>
                <textarea
                  value={studentForm.allergies}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, allergies: e.target.value }))}
                  placeholder={t.student_allergies_placeholder}
                  className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_emergency_contact}
                </label>
                <textarea
                  value={studentForm.emergency_contact}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, emergency_contact: e.target.value }))}
                  placeholder={t.student_emergency_contact_placeholder}
                  className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 px-3 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  rows={2}
                />
              </div>

              {studentError && (
                <div className="text-ds-small text-red-600 dark:text-red-400">{studentError}</div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="flex-1 rounded-ds-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-ds-small hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loadingStudents || (!!studentForm.dob && !validateStudentAge(studentForm.dob))}
                  className="flex-1 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {loadingStudents ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {studentForm.id ? t.updating : t.creating}
                    </>
                  ) : (
                    studentForm.id ? t.update : t.create
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteStudentModalOpen}
        onClose={() => setIsDeleteStudentModalOpen(false)}
        onConfirm={confirmDeleteStudent}
        title={t.delete_student_title}
        message={t.delete_student_confirm}
        error={studentError}
        translations={{
          confirm_delete: t.confirm_delete,
          cancel: t.cancel
        }}
      />

    </div>
  );
}
