'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  School,
  BookOpen,
  Settings,
  BarChart3,
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
import { GuardianForm, type GuardianFormData } from './shared/GuardianForm';
import { GuardianTable } from './shared/GuardianTable';
import { StudentForm, type StudentFormData } from './shared/StudentForm';
import { StudentTable } from './shared/StudentTable';
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
  const { lang, t: contextT } = useLanguage();
  const router = useRouter();
  
  // Translation logic
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string; timezone: string }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgForm, setOrgForm] = useState<{ id?: string; name: string; slug: string; timezone: string }>({ name: '', slug: '', timezone: 'UTC' });
  const [orgError, setOrgError] = useState<string | null>(null);
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false);
  const [principals, setPrincipals] = useState<Array<{ id: string; email: string | null; phone: string | null; full_name: string; org_id: string; is_active: boolean; created_at: string }>>([]);
  const [loadingPrincipals, setLoadingPrincipals] = useState(false);
  const [principalError, setPrincipalError] = useState<string | null>(null);
  const [isSubmittingPrincipal, setIsSubmittingPrincipal] = useState(false);
  const [principalForm, setPrincipalForm] = useState<{ id?: string; full_name: string; email?: string; phone?: string; org_id: string; is_active?: boolean }>({ full_name: '', email: '', phone: '', org_id: '', is_active: true });
  
  // Guardian states
  const [guardians, setGuardians] = useState<Array<{ id: string; email: string | null; phone: string | null; full_name: string; org_id: string; is_active: boolean; created_at: string; metadata?: any; org_name?: string }>>([]);
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [isSubmittingGuardian, setIsSubmittingGuardian] = useState(false);
  const [guardianForm, setGuardianForm] = useState<{ id?: string; full_name: string; email: string; phone: string; org_id: string; is_active?: boolean }>({ full_name: '', email: '', phone: '', org_id: '', is_active: true });
  const [guardianRefreshKey, setGuardianRefreshKey] = useState(0);

  // Student states
  const [students, setStudents] = useState<Array<{ id: string; first_name: string; last_name: string | null; dob: string | null; gender: string; class_id: string | null; created_at: string; classes?: any; guardians?: Array<{ id: string; relation: string; users?: { id: string; full_name: string; email: string } }> }>>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState<{ id?: string; first_name: string; last_name: string; dob: string; gender: string; class_id: string; medical_notes: string; allergies: string; emergency_contact: string; org_id: string; guardian_ids: string[] }>({ first_name: '', last_name: '', dob: '', gender: 'unknown', class_id: '', medical_notes: '', allergies: '', emergency_contact: '', org_id: '', guardian_ids: [] });

  // Classes states
  const [classes, setClasses] = useState<Array<{ id: string; name: string; code: string | null }>>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Global loading state for initial data load
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Auto-hide loading after maximum 500ms to prevent long loading
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
      console.log('✅ Organizations loaded:', json.orgs?.length || 0);
    } catch (e: any) {
      setOrgError(e.message);
      console.error('❌ Error loading organizations:', e.message);
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
      const method = orgForm.id ? 'PUT' : 'POST';
      const res = await fetch('/api/orgs', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(orgForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setOrgForm({ name: '', slug: '', timezone: 'UTC' });
      setIsOrgModalOpen(false);
      await loadOrgs();
    } catch (e: any) {
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
      setOrgError(null);
      const res = await fetch(`/api/orgs?id=${encodeURIComponent(orgToDelete)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsDeleteOrgModalOpen(false);
      setOrgToDelete(null);
      await loadOrgs();
    } catch (e: any) {
      setOrgError(e.message);
    }
  }

  // Load data immediately when component mounts
  React.useEffect(() => {
    const loadAllData = async () => {
      try {
        console.log('🔄 Loading all data for Admin Dashboard...');
        // Use Promise.allSettled to ensure all requests complete even if some fail
        const results = await Promise.allSettled([
          loadOrgs(),
          loadClasses(),
          loadPrincipals(),
          loadGuardians(),
          loadStudents()
        ]);
        
        // Log results for debugging
        results.forEach((result, index) => {
          const names = ['loadOrgs', 'loadClasses', 'loadPrincipals', 'loadGuardians', 'loadStudents'];
          if (result.status === 'rejected') {
            console.error(`❌ ${names[index]} failed:`, result.reason);
          } else {
            console.log(`✅ ${names[index]} completed`);
          }
        });
        
        console.log('✅ All data loading attempts completed');
      } catch (error) {
        console.error('❌ Error loading data:', error);
      } finally {
        // Set loading to false immediately when data is loaded
        setIsInitialLoading(false);
      }
    };
    loadAllData();
  }, []);

  async function loadClasses() {
    try {
      setLoadingClasses(true);
      console.log('🔄 Loading classes...');
      const res = await fetch('/api/classes', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setClasses(json.classes || []);
      console.log('✅ Classes loaded:', json.classes?.length || 0);
    } catch (e: any) {
      console.error('❌ Error loading classes:', e.message);
    } finally {
      setLoadingClasses(false);
    }
  }

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
      console.log('✅ Principals loaded:', json.principals?.length || 0, 'Principals:', json.principals);
    } catch (e: any) {
      setPrincipalError(e.message);
      console.error('❌ Error loading principals:', e.message);
    } finally {
      setLoadingPrincipals(false);
    }
  }

  // Refresh guardians and students when orgs change
  React.useEffect(() => {
    if (orgs.length > 0) {
      console.log('🔄 Refreshing guardians and students after orgs loaded...');
      loadGuardians(false); // Refresh guardians when orgs change, but don't show loading
      loadStudents(false); // Refresh students when orgs change, but don't show loading
    }
  }, [orgs]);

  // Fallback: Try to load guardians again after a delay if they're still empty
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (guardians.length === 0 && !loadingGuardians) {
        console.log('🔄 Fallback: Trying to load guardians again...');
        loadGuardians(false);
      }
    }, 2000); // Wait 2 seconds after initial load

    return () => clearTimeout(timer);
  }, [guardians.length, loadingGuardians]);

  // Test function to manually test the guardians API
  const testGuardiansAPI = async () => {
    try {
      console.log('🧪 Testing guardians API directly...');
      const res = await fetch('/api/guardians?orgId=1&t=' + Date.now(), { cache: 'no-store' });
      const json = await res.json();
      console.log('🧪 Direct API test result:', json);
      return json;
    } catch (e) {
      console.error('🧪 Direct API test failed:', e);
      return null;
    }
  };


  async function submitPrincipal(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      setIsSubmittingPrincipal(true);
      setPrincipalError(null);
      const method = principalForm.id ? 'PUT' : 'POST';
      const res = await fetch('/api/principals', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(principalForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setPrincipalForm({ id: undefined, full_name: '', email: '', org_id: '', is_active: true });
      setIsPrincipalModalOpen(false);
      await loadPrincipals();
    } catch (e: any) {
      setPrincipalError(e.message);
    } finally {
      setIsSubmittingPrincipal(false);
    }
  }

  function openCreatePrincipalModal() {
    setPrincipalForm({ full_name: '', email: '', phone: '', org_id: (orgs[0]?.id || ''), is_active: true });
    setPrincipalError(null);
    setIsPrincipalModalOpen(true);
  }

  function openEditPrincipalModal(principal: { id: string; email: string | null; phone: string | null; full_name: string; org_id: string; is_active: boolean }) {
    setPrincipalForm({ id: principal.id, full_name: principal.full_name, email: principal.email || '', phone: principal.phone || '', org_id: principal.org_id, is_active: principal.is_active });
    setPrincipalError(null);
    setIsPrincipalModalOpen(true);
  }

  function openDeletePrincipalModal(id: string) {
    setPrincipalToDelete(id);
    setIsDeletePrincipalModalOpen(true);
  }

  async function confirmDeletePrincipal() {
    if (!principalToDelete) return;
    try {
      setPrincipalError(null);
      const res = await fetch(`/api/principals?id=${encodeURIComponent(principalToDelete)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsDeletePrincipalModalOpen(false);
      setPrincipalToDelete(null);
      await loadPrincipals();
    } catch (e: any) {
      setPrincipalError(e.message);
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
        const res = await fetch(`/api/guardians?orgId=1&t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        
        if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
        
        const guardiansList = json.guardians || [];
        setGuardians(guardiansList);
        setGuardianRefreshKey(prev => prev + 1);
        console.log('✅ Default guardians loaded:', guardiansList.length);
        return;
      }
      
      // Load guardians from ALL organizations
      const allGuardians = [];
      
      for (const org of orgs) {
        try {
          console.log(`🔄 Loading guardians for org: ${org.name} (${org.id})`);
          const res = await fetch(`/api/guardians?orgId=${org.id}&t=${Date.now()}`, { cache: 'no-store' });
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
      setGuardianRefreshKey(prev => prev + 1); // Force re-render
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
            
      setIsGuardianModalOpen(false);
      setGuardianForm({ full_name: '', email: '', phone: '', org_id: '', is_active: true });
      
      // Force refresh the guardians list (without showing loading state)
      console.log('🔄 About to call loadGuardians()...');
      await loadGuardians(false);
      console.log('🔄 Guardians list refreshed');
      
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
    const orgName = orgs.length > 0 ? orgs[0].name : 'Default Organization';
    console.log('🏢 Opening guardian modal with orgId:', orgId, 'Org Name:', orgName, 'Available orgs:', orgs);
    setGuardianForm({ full_name: '', email: '', phone: '', org_id: orgId, is_active: true });
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

  // Student functions
  async function loadStudents(showLoading = true) {
    try {
      if (showLoading) {
        setLoadingStudents(true);
      }
      setStudentError(null);
      
      // Use the first available organization ID from the orgs list
      const orgId = orgs.length > 0 ? orgs[0].id : '1';
      console.log('🔄 Loading students for orgId:', orgId);
      
      const res = await fetch(`/api/students?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      
      const studentsList = json.students || [];
      setStudents(studentsList);
      console.log('✅ Students loaded:', studentsList.length);
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
      
      const res = await fetch(`/api/guardians?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      
      const guardiansList = json.guardians || [];
      setGuardians(guardiansList);
      
      // Also refresh classes
      await loadClasses();
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
            
      setIsStudentModalOpen(false);
      setStudentForm({ first_name: '', last_name: '', dob: '', gender: 'unknown', class_id: '', medical_notes: '', allergies: '', emergency_contact: '', org_id: '', guardian_ids: [] });
      
      // Force refresh the students list (without showing loading state)
      await loadStudents(false);
      
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
    setStudentForm({ first_name: '', last_name: '', dob: '', gender: 'unknown', class_id: '', medical_notes: '', allergies: '', emergency_contact: '', org_id: orgId, guardian_ids: [] });
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
      guardian_ids: [] // Will be loaded separately
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
      await loadStudents(false);
    } catch (e: any) {
      setStudentError(e.message);
    }
  }

  // Calculate real stats from loaded data - force recalculation when guardians change
  const stats: AdminStats = React.useMemo(() => {
    const calculatedStats = {
      totalUsers: principals.length + guardians.length + students.length,
      totalTeachers: 0, // Teachers are not loaded in Admin Dashboard
      totalStudents: students.length,
      totalParents: guardians.length,
      activeUsers: principals.filter(p => p.is_active).length + guardians.filter(g => g.is_active).length + students.length,
      newRegistrations: principals.filter(p => {
        const createdDate = new Date(p.created_at || 0);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return createdDate > weekAgo;
      }).length + guardians.filter(g => {
        const createdDate = new Date(g.created_at || 0);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return createdDate > weekAgo;
      }).length + students.filter(s => {
        const createdDate = new Date(s.created_at || 0);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return createdDate > weekAgo;
      }).length
    };

    // Debug stats calculation
    console.log('📊 Stats calculation (memoized):', {
      principals: principals.length,
      guardians: guardians.length,
      students: students.length,
      totalParents: calculatedStats.totalParents,
      totalUsers: calculatedStats.totalUsers,
      refreshKey: guardianRefreshKey
    });

    return calculatedStats;
  }, [principals.length, guardians.length, students.length, guardianRefreshKey]);

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

  const StatCard = ({ title, value, icon: Icon, color, trend }: {
    title: string;
    value: number;
    icon: React.ComponentType<any>;
    color: string;
    trend?: string;
  }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-200 dark:border-slate-700 h-36">
      <div className="flex items-start justify-between h-full">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{value.toLocaleString()}</p>
          <div className="h-4">
            {trend && (
              <p className="text-xs text-green-600 dark:text-green-400">{trend}</p>
            )}
          </div>
        </div>
        <div className={`p-3 rounded-lg ${color} flex-shrink-0`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
    </div>
  );

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

  // Show loading overlay during initial data load
  // if (isInitialLoading) {
  //   return (
  //     <div className="max-w-7xl mx-auto">
  //       <div className="flex items-center justify-center min-h-[500px]">
  //         <div className="text-center">
  //           <div className="mb-6">
  //             <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 mx-auto mb-4"></div>
  //             <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
  //               Loading Admin Dashboard
  //             </h2>
  //           </div>
            
  //           {/* Loading steps */}
  //           {/* <div className="space-y-3 text-left max-w-md mx-auto">
  //             <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
  //               <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
  //               <span className="text-sm text-slate-700 dark:text-slate-300">Loading organizations...</span>
  //             </div>
  //             <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
  //               <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
  //               <span className="text-sm text-slate-700 dark:text-slate-300">Loading principals...</span>
  //             </div>
  //             <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
  //               <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
  //               <span className="text-sm text-slate-700 dark:text-slate-300">Loading guardians...</span>
  //             </div>
  //             <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
  //               <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
  //               <span className="text-sm text-slate-700 dark:text-slate-300">Loading students...</span>
  //             </div>
  //             <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
  //               <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
  //               <span className="text-sm text-slate-700 dark:text-slate-300">Preparing dashboard...</span>
  //             </div>
  //           </div> */}
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
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

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8"
      >
        <StatCard
          title={t.totalUsers}
          value={stats.totalUsers}
          icon={Users}
          color="bg-blue-500"
          trend={`+12% ${t.thisMonth}`}
        />
        <StatCard
          title={t.teachers}
          value={stats.totalTeachers}
          icon={GraduationCap}
          color="bg-green-500"
        />
        <StatCard
          title={t.students}
          value={stats.totalStudents}
          icon={BookOpen}
          color="bg-purple-500"
        />
        <StatCard
          title={t.parents}
          value={stats.totalParents}
          icon={Users}
          color="bg-orange-500"
          key={`parents-${guardianRefreshKey}`}
        />
        <StatCard
          title={t.activeUsers}
          value={stats.activeUsers}
          icon={Activity}
          color="bg-emerald-500"
          trend={`+8% ${t.thisWeek}`}
        />
        <StatCard
          title={t.newThisWeek}
          value={stats.newRegistrations}
          icon={UserPlus}
          color="bg-pink-500"
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Organizations Manager */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="lg:col-span-1"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.organizations}</h3>
              <button
                onClick={openCreateOrgModal}
                className="inline-flex items-center gap-0.5 rounded-lg bg-black text-white px-3 py-2 text-sm dark:bg-black dark:text-white"
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
                    <th className="py-2 pr-3">{t.table_slug}</th>
                    <th className="py-2 pr-3">{t.table_timezone}</th>
                    <th className="py-2 pr-3">{t.table_actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {loadingOrgs ? (
                    <tr><td colSpan={4} className="py-4">{t.table_loading}</td></tr>
                  ) : orgs.length === 0 ? (
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
          transition={{ duration: 0.6, delay: 0.4 }}
          className="lg:col-span-1"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.principals}</h3>
              <button
                onClick={openCreatePrincipalModal}
                className="inline-flex items-center gap-0.5 rounded-lg bg-black text-white px-3 py-2 text-sm dark:bg-black dark:text-white "
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
                  {loadingPrincipals ? (
                    <tr><td colSpan={6} className="py-4">{t.table_loading}</td></tr>
                  ) : principals.length === 0 ? (
                    <tr><td colSpan={6} className="py-4">{t.table_no_data}</td></tr>
                  ) : (
                    principals.map((p) => (
                      <tr key={p.id} className="h-12 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 dark:text-slate-100">
                        <td className="py-2 pr-3">{p.full_name}</td>
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

        {/* Guardians Manager */}
        {/* <motion.div
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-1"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.guardians}</h3>
              <div className="flex gap-2">
                <button
                  onClick={openCreateGuardianModal}
                  className="inline-flex items-center gap-0.5 rounded-lg bg-black text-white px-3 py-2 text-sm dark:bg-black dark:text-white"
                >
                  <Plus className="h-3.5 w-3.5 mt-0.5" />
                  {t.create}
                </button>
              </div>
            </div>
            
            {guardianError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {guardianError}
              </div>
            )}
            
            <div className="overflow-y-auto max-h-64 rounded-md border border-slate-200 dark:border-slate-700" key={`guardian-table-${guardianRefreshKey}`}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                  <tr className="text-left text-slate-600 dark:text-slate-300">
                    <th className="py-2 pr-3">{t.full_name}</th>
                    <th className="py-2 pr-3">{t.email}</th>
                    <th className="py-2 pr-3">{t.phone}</th>
                    <th className="py-2 pr-3">Organization</th>
                    <th className="py-2 pr-3">{t.status}</th>
                    <th className="py-2 pr-3">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {loadingGuardians ? (
                    <tr><td colSpan={6} className="py-4">{t.loading}</td></tr>
                  ) : guardians.length === 0 ? (
                    <tr><td colSpan={6} className="py-4">{t.no_guardians}</td></tr>
                  ) : (
                    guardians.map((g) => (
                      <tr key={`${g.id}-${guardianRefreshKey}`} className="h-12 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 dark:text-slate-100">
                        <td className="py-2 pr-3">{g.full_name}</td>
                        <td className="py-2 pr-3">{g.email || '—'}</td>
                        <td className="py-2 pr-3">{g.phone || '—'}</td>
                        <td className="py-2 pr-3">{g.org_name || orgs.find(o => o.id === g.org_id)?.name || 'Unknown'}</td>
                        <td className="py-2 pr-3">{g.is_active ? t.active : t.inactive}</td>
                        <td className="py-2 pr-3 space-x-2">
                          <button
                            onClick={() => openEditGuardianModal(g)}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 dark:border-slate-700 dark:hover:bg-slate-700"
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => openDeleteGuardianModal(g.id)}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-red-50 text-red-600 border-red-300 dark:border-red-700 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div> */}

        {/* Students Manager */}
        {/* <motion.div
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-1"
        >
          <StudentTable
            students={students}
            loading={loadingStudents}
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
              loading: t.loading,
              no_students: t.no_students
            }}
          />
        </motion.div> */}
      </div>

      {/* Recent Activities and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Recent Activities */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
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
          transition={{ delay: 0.5 }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
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
                  className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                >
                  <div className={`p-2 rounded-lg ${action.color}`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{action.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{action.description}</p>
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
        transition={{ delay: 0.4 }}
        className="mt-8"
      >
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            {t.systemStatus}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="p-2 bg-green-500 rounded-lg">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {orgForm.id ? t.edit_organization : t.create_organization}
              </h3>
              <button
                onClick={() => setIsOrgModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitOrg} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.organization_name}
                </label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder={t.organization_name_placeholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.organization_slug}
                </label>
                <input
                  type="text"
                  value={orgForm.slug}
                  onChange={(e) => setOrgForm((p) => ({ ...p, slug: e.target.value }))}
                  placeholder={t.organization_slug_placeholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.organization_timezone}
                </label>
                <input
                  type="text"
                  value={orgForm.timezone}
                  onChange={(e) => setOrgForm((p) => ({ ...p, timezone: e.target.value }))}
                  placeholder={t.organization_timezone_placeholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                />
              </div>

              {orgError && (
                <div className="text-sm text-red-600 dark:text-red-400">{orgError}</div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOrgModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {t.cancel_delete}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOrg}
                  className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      {isDeleteOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t.delete_organization_title}
              </h3>
              <button
                onClick={() => setIsDeleteOrgModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-slate-600 dark:text-slate-400">
                {t.delete_organization_message}
              </p>
            </div>

            {orgError && (
              <div className="mb-4 text-sm text-red-600 dark:text-red-400">{orgError}</div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteOrgModalOpen(false)}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {t.cancel_delete}
              </button>
              <button
                onClick={confirmDeleteOrg}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                {t.confirm_delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Principal Create/Edit Modal */}
      {isPrincipalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {principalForm.id ? t.edit_principal : t.create_principal}
              </h3>
              <button
                onClick={() => setIsPrincipalModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitPrincipal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.principal_name}
                </label>
                <input
                  type="text"
                  value={principalForm.full_name}
                  onChange={(e) => setPrincipalForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder={t.principal_name_placeholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.principal_email}
                </label>
                <input
                  type="email"
                  value={principalForm.email || ''}
                  onChange={(e) => setPrincipalForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder={t.principal_email_placeholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.principal_phone}
                </label>
                <input
                  type="tel"
                  value={principalForm.phone || ''}
                  onChange={(e) => setPrincipalForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder={t.principal_phone_placeholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.principal_org}
                </label>
                <select
                  value={principalForm.org_id}
                  onChange={(e) => setPrincipalForm((p) => ({ ...p, org_id: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                  required
                >
                  <option value="">Select organization</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.status}
                </label>
                <select
                  value={principalForm.is_active ? 'true' : 'false'}
                  onChange={(e) => setPrincipalForm((p) => ({ ...p, is_active: e.target.value === 'true' }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              {principalError && (
                <div className="text-sm text-red-600 dark:text-red-400">{principalError}</div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsPrincipalModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {t.cancel_delete}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPrincipal}
                  className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      {isDeletePrincipalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t.delete_principal_title}
              </h3>
              <button
                onClick={() => setIsDeletePrincipalModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-slate-600 dark:text-slate-400">
                {t.delete_principal_message}
              </p>
            </div>

            {principalError && (
              <div className="mb-4 text-sm text-red-600 dark:text-red-400">{principalError}</div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeletePrincipalModalOpen(false)}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {t.cancel_delete}
              </button>
              <button
                onClick={confirmDeletePrincipal}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                {t.confirm_delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guardian Create/Edit Modal */}
      <GuardianForm
        isOpen={isGuardianModalOpen}
        onClose={() => setIsGuardianModalOpen(false)}
        onSubmit={async (data: GuardianFormData) => {
          try {
            setIsSubmittingGuardian(true);
            setGuardianError(null);
            
            const method = data.id ? 'PUT' : 'POST';
            const requestData = {
              ...data,
              created_by: 'admin-user-id' // In real app, get from session
            };
            
            console.log('🔄 Submitting guardian:', requestData);
            
            const res = await fetch('/api/guardians', {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestData),
            });
            const json = await res.json();
            
            console.log('📥 Guardian submission response:', json);
            
            if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
            
            console.log('✅ Guardian created/updated successfully');
            
            // Close modal and reset form
            setIsGuardianModalOpen(false);
            setGuardianForm({ full_name: '', email: '', phone: '', org_id: '', is_active: true });
            
            // Force refresh guardians list
            console.log('🔄 Refreshing guardians list...');
            await loadGuardians(false);
            
            // Force refresh stats by updating refresh key
            setGuardianRefreshKey(prev => prev + 1);
            
            console.log('✅ Guardian list and stats refreshed');
          } catch (error: any) {
            console.error('❌ Error submitting guardian:', error);
            setGuardianError(error.message);
          } finally {
            setIsSubmittingGuardian(false);
          }
        }}
        initialData={guardianForm}
        loading={isSubmittingGuardian}
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

      {/* Delete Guardian Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteGuardianModalOpen}
        onClose={() => setIsDeleteGuardianModalOpen(false)}
        onConfirm={confirmDeleteGuardian}
        title={t.delete_guardian}
        message={t.delete_guardian_confirm}
        error={guardianError}
        translations={{
          confirm_delete: t.confirm_delete,
          cancel: t.cancel_delete
        }}
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
          
          setIsStudentModalOpen(false);
          setStudentForm({ first_name: '', last_name: '', dob: '', gender: 'unknown', class_id: '', medical_notes: '', allergies: '', emergency_contact: '', org_id: '', guardian_ids: [] });
          await loadStudents(false);
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

      {/* Student Create/Edit Modal - OLD */}
      {false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {studentForm.id ? t.edit_student : t.create_student}
              </h3>
              <button
                onClick={() => setIsStudentModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitStudent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_first_name}
                  </label>
                  <input
                    type="text"
                    value={studentForm.first_name}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder={t.student_first_name_placeholder}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_last_name}
                  </label>
                  <input
                    type="text"
                    value={studentForm.last_name}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder={t.student_last_name_placeholder}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_dob}
                  </label>
                  <input
                    type="date"
                    value={studentForm.dob}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, dob: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 dark:bg-slate-700 dark:text-slate-200 ${
                      studentForm.dob && !validateStudentAge(studentForm.dob)
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                  />
                  <p className={`mt-1 text-xs ${
                    studentForm.dob && !validateStudentAge(studentForm.dob)
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_gender}
                  </label>
                  <select
                    value={studentForm.gender}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, gender: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="unknown">{t.gender_unknown}</option>
                    <option value="male">{t.gender_male}</option>
                    <option value="female">{t.gender_female}</option>
                    <option value="other">{t.gender_other}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_class}
                </label>
                <select
                  value={studentForm.class_id}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, class_id: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
                >
                  <option value="">{t.no_class_assigned}</option>
                  {/* Classes will be loaded from API */}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
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
                {/* <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t.student_guardians_dropdown_help}
                </p> */}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_medical_notes}
                </label>
                <textarea
                  value={studentForm.medical_notes}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, medical_notes: e.target.value }))}
                  placeholder={t.student_medical_notes_placeholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_allergies}
                </label>
                <textarea
                  value={studentForm.allergies}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, allergies: e.target.value }))}
                  placeholder={t.student_allergies_placeholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_emergency_contact}
                </label>
                <textarea
                  value={studentForm.emergency_contact}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, emergency_contact: e.target.value }))}
                  placeholder={t.student_emergency_contact_placeholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  rows={2}
                />
              </div>

              {studentError && (
                <div className="text-sm text-red-600 dark:text-red-400">{studentError}</div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loadingStudents || (!!studentForm.dob && !validateStudentAge(studentForm.dob))}
                  className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

// Translation objects
const enText = {
  // Admin Dashboard
  adminDashboard: 'Admin Dashboard',
  manageUsersSchools: 'Manage users, schools, and system settings',
  adminAccess: 'Admin Access',
  fullPermissions: 'Full permissions granted',
  totalUsers: 'Total Users',
  teachers: 'Teachers',
  parents: 'Parents',
  activeUsers: 'Active Users',
  newThisWeek: 'New This Week',
  thisMonth: 'this month',
  thisWeek: 'this week',
  quickActions: 'Quick Actions',
  systemStatus: 'System Status',
  database: 'Database',
  operational: 'Operational',
  api: 'API',
  healthy: 'Healthy',
  backup: 'Backup',
  pending: 'Pending',
  recentActivities: 'Recent Activities',
  registeredAs: 'registered as',
  loggedIn: 'logged in',
  systemAlertTriggered: 'System alert triggered',
  addNewUser: 'Add New User',
  createNewUserAccount: 'Create new user account',
  manageSchools: 'Manage Schools',
  configureSchoolSettings: 'Configure school settings',
  systemSettings: 'System Settings',
  configureSystemPreferences: 'Configure system preferences',
  generateReports: 'Generate Reports',
  createUsageAnalyticsReports: 'Create usage analytics reports',
  
  // Guardian Management
  guardians: 'Guardians',
  create_guardian: 'Create Guardian',
  edit_guardian: 'Edit Guardian',
  delete_guardian: 'Delete Guardian',
  full_name: 'Full Name',
  email: 'Email',
  phone: 'Phone',
  organization: 'Organization',
  status: 'Status',
  active: 'Active',
  inactive: 'Inactive',
  actions: 'Actions',
  create: 'Create',
  update: 'Update',
  cancel: 'Cancel',
  delete: 'Delete',
  refresh: 'Refresh',
  loading: 'Loading...',
  no_guardians: 'No guardians found',
  delete_guardian_confirm: 'Are you sure you want to delete this guardian? This action cannot be undone.',
  guardian_created: 'Guardian created successfully!',
  guardian_updated: 'Guardian updated successfully!',
  guardian_deleted: 'Guardian deleted successfully!',
  error_creating_guardian: 'Error creating guardian',
  error_updating_guardian: 'Error updating guardian',
  error_deleting_guardian: 'Error deleting guardian',
  error_loading_guardians: 'Error loading guardians',
  
  // Organization Management
  organizations: 'Organizations',
  create_organization: 'Create Organization',
  edit_organization: 'Edit Organization',
  delete_organization: 'Delete Organization',
  organization_name: 'Organization Name',
  organization_slug: 'Slug',
  organization_timezone: 'Timezone',
  organization_name_placeholder: 'Enter organization name',
  organization_slug_placeholder: 'Enter slug (e.g., my-org)',
  organization_timezone_placeholder: 'Enter timezone (e.g., UTC)',
  delete_organization_confirm: 'Are you sure you want to delete this organization? This action cannot be undone.',
  organization_created: 'Organization created successfully!',
  organization_updated: 'Organization updated successfully!',
  organization_deleted: 'Organization deleted successfully!',
  error_creating_organization: 'Error creating organization',
  error_updating_organization: 'Error updating organization',
  error_deleting_organization: 'Error deleting organization',
  error_loading_organizations: 'Error loading organizations',
  
  // Principal Management
  principals: 'Principals',
  create_principal: 'Create Principal',
  edit_principal: 'Edit Principal',
  delete_principal: 'Delete Principal',
  principal_name: 'Full Name',
  principal_email: 'Email',
  principal_phone: 'Phone',
  principal_org: 'Organization',
  principal_status: 'Status',
  principal_name_placeholder: 'Enter full name',
  principal_email_placeholder: 'Enter email address',
  principal_phone_placeholder: 'Enter phone number',
  delete_principal_confirm: 'Are you sure you want to delete this principal? This action cannot be undone.',
  principal_created: 'Principal created successfully!',
  principal_updated: 'Principal updated successfully!',
  principal_deleted: 'Principal deleted successfully!',
  error_creating_principal: 'Error creating principal',
  error_updating_principal: 'Error updating principal',
  error_deleting_principal: 'Error deleting principal',
  error_loading_principals: 'Error loading principals',
  
  // Table Headers and Labels
  table_name: 'Name',
  table_slug: 'Slug',
  table_timezone: 'Timezone',
  table_actions: 'Actions',
  table_edit: 'Edit',
  table_delete: 'Delete',
  table_no_data: 'No data available',
  table_loading: 'Loading...',
  table_select_org: 'Select organization',
  organization_placeholder: 'Select organization',
  full_name_placeholder: 'Enter full name',
  email_placeholder: 'Enter email address',
  phone_placeholder: 'Enter phone number',
  status_placeholder: 'Select status',
  
  // Delete Modal Translations
  delete_organization_title: 'Delete Organization',
  delete_organization_message: 'Are you sure you want to delete this organization? This action cannot be undone.',
  delete_principal_title: 'Delete Principal',
  delete_principal_message: 'Are you sure you want to delete this principal? This action cannot be undone.',
  delete_guardian_title: 'Delete Guardian',
  delete_guardian_message: 'Are you sure you want to delete this guardian? This action cannot be undone.',
  confirm_delete: 'Delete',
  cancel_delete: 'Cancel',
  creating: 'Creating...',
  updating: 'Updating...',
  
  // Student Management
  students: 'Students',
  create_student: 'Create Student',
  edit_student: 'Edit Student',
  delete_student: 'Delete Student',
  student_name: 'Name',
  student_first_name: 'First Name',
  student_last_name: 'Last Name',
  student_class: 'Class',
  student_dob: 'Date of Birth',
  student_gender: 'Gender',
  student_medical_notes: 'Medical Notes',
  student_allergies: 'Allergies',
  student_emergency_contact: 'Emergency Contact',
  student_first_name_placeholder: 'Enter first name',
  student_last_name_placeholder: 'Enter last name',
  student_medical_notes_placeholder: 'Enter medical notes (optional)',
  student_allergies_placeholder: 'Enter allergies (optional)',
  student_emergency_contact_placeholder: 'Enter emergency contact info (optional)',
  gender_unknown: 'Unknown',
  gender_male: 'Male',
  gender_female: 'Female',
  gender_other: 'Other',
  no_class_assigned: 'No class assigned',
  no_students: 'No students found',
  delete_student_title: 'Delete Student',
  delete_student_confirm: 'Are you sure you want to delete this student? This action cannot be undone.',
  student_age_requirement: 'Student must be between 0-18 years old',
  student_guardians: 'Guardians',
  student_guardians_help: 'Select one or more guardians for this student',
  student_guardians_dropdown_help: 'Hold Ctrl/Cmd to select multiple guardians',
  no_guardians_available: 'No guardians available',
};

const isText = {
  // Admin Dashboard
  adminDashboard: 'Stjórnandayfirlit',
  manageUsersSchools: 'Sýsla með notendur, skóla og kerfisstillingar',
  adminAccess: 'Stjórnandaaðgangur',
  fullPermissions: 'Full aðgangsréttindi veitt',
  totalUsers: 'Heildarfjöldi notenda',
  teachers: 'Kennarar',
  parents: 'Foreldrar',
  activeUsers: 'Virkir notendur',
  newThisWeek: 'Nýir þessa viku',
  thisMonth: 'þennan mánuð',
  thisWeek: 'þessa viku',
  quickActions: 'Flýtiaðgerðir',
  systemStatus: 'Kerfisstaða',
  database: 'Gagnagrunnur',
  operational: 'Í rekstri',
  api: 'API',
  healthy: 'Heilbrigt',
  backup: 'Öryggisafrit',
  pending: 'Í bið',
  recentActivities: 'Nýlegar aðgerðir',
  registeredAs: 'skráður sem',
  loggedIn: 'skráður inn',
  systemAlertTriggered: 'Kerfisviðvörun kveikt',
  addNewUser: 'Bæta við nýjum notanda',
  createNewUserAccount: 'Búa til nýjan notandaaðgang',
  manageSchools: 'Sýsla með skóla',
  configureSchoolSettings: 'Stilla skólastillingar',
  systemSettings: 'Kerfisstillingar',
  configureSystemPreferences: 'Stilla kerfisvalkosti',
  generateReports: 'Búa til skýrslur',
  createUsageAnalyticsReports: 'Búa til notkunargreiningarskýrslur',
  
  // Guardian Management
  guardians: 'Forráðamenn',
  create_guardian: 'Búa til forráðamann',
  edit_guardian: 'Breyta forráðamanni',
  delete_guardian: 'Eyða forráðamanni',
  full_name: 'Fullt nafn',
  email: 'Netfang',
  phone: 'Sími',
  organization: 'Stofnun',
  status: 'Staða',
  active: 'Virkur',
  inactive: 'Óvirkur',
  actions: 'Aðgerðir',
  create: 'Búa til',
  update: 'Uppfæra',
  cancel: 'Hætta við',
  delete: 'Eyða',
  refresh: 'Endurnýja',
  loading: 'Hleður...',
  no_guardians: 'Engir forráðamenn fundust',
  delete_guardian_confirm: 'Ertu viss um að þú viljir eyða þessum forráðamanni? Þessa aðgerð er ekki hægt að afturkalla.',
  guardian_created: 'Forráðamaður búinn til með góðum árangri!',
  guardian_updated: 'Forráðamaður uppfærður með góðum árangri!',
  guardian_deleted: 'Forráðamaður eytt með góðum árangri!',
  error_creating_guardian: 'Villa við að búa til forráðamann',
  error_updating_guardian: 'Villa við að uppfæra forráðamann',
  error_deleting_guardian: 'Villa við að eyða forráðamanni',
  error_loading_guardians: 'Villa við að hlaða forráðamönnum',
  
  // Organization Management
  organizations: 'Stofnanir',
  create_organization: 'Búa til stofnun',
  edit_organization: 'Breyta stofnun',
  delete_organization: 'Eyða stofnun',
  organization_name: 'Nafn stofnunar',
  organization_slug: 'Slug',
  organization_timezone: 'Tímabelti',
  organization_name_placeholder: 'Sláðu inn nafn stofnunar',
  organization_slug_placeholder: 'Sláðu inn slug (t.d. min-stofnun)',
  organization_timezone_placeholder: 'Sláðu inn tímabelti (t.d. UTC)',
  delete_organization_confirm: 'Ertu viss um að þú viljir eyða þessari stofnun? Þessa aðgerð er ekki hægt að afturkalla.',
  organization_created: 'Stofnun búin til með góðum árangri!',
  organization_updated: 'Stofnun uppfærð með góðum árangri!',
  organization_deleted: 'Stofnun eytt með góðum árangri!',
  error_creating_organization: 'Villa við að búa til stofnun',
  error_updating_organization: 'Villa við að uppfæra stofnun',
  error_deleting_organization: 'Villa við að eyða stofnun',
  error_loading_organizations: 'Villa við að hlaða stofnunum',
  
  // Principal Management
  principals: 'Skólastjórar',
  create_principal: 'Búa til skólastjóra',
  edit_principal: 'Breyta skólastjóra',
  delete_principal: 'Eyða skólastjóra',
  principal_name: 'Fullt nafn',
  principal_email: 'Netfang',
  principal_phone: 'Sími',
  principal_org: 'Stofnun',
  principal_status: 'Staða',
  principal_name_placeholder: 'Sláðu inn fullt nafn',
  principal_email_placeholder: 'Sláðu inn netfang',
  principal_phone_placeholder: 'Sláðu inn símanúmer',
  delete_principal_confirm: 'Ertu viss um að þú viljir eyða þessum skólastjóra? Þessa aðgerð er ekki hægt að afturkalla.',
  principal_created: 'Skólastjóri búinn til með góðum árangri!',
  principal_updated: 'Skólastjóri uppfærður með góðum árangri!',
  principal_deleted: 'Skólastjóri eytt með góðum árangri!',
  error_creating_principal: 'Villa við að búa til skólastjóra',
  error_updating_principal: 'Villa við að uppfæra skólastjóra',
  error_deleting_principal: 'Villa við að eyða skólastjóra',
  error_loading_principals: 'Villa við að hlaða skólastjórum',
  
  // Table Headers and Labels
  table_name: 'Nafn',
  table_slug: 'Slug',
  table_timezone: 'Tímabelti',
  table_actions: 'Aðgerðir',
  table_edit: 'Breyta',
  table_delete: 'Eyða',
  table_no_data: 'Engin gögn tiltæk',
  table_loading: 'Hleður...',
  table_select_org: 'Veldu stofnun',
  organization_placeholder: 'Veldu stofnun',
  full_name_placeholder: 'Sláðu inn fullt nafn',
  email_placeholder: 'Sláðu inn netfang',
  phone_placeholder: 'Sláðu inn símanúmer',
  status_placeholder: 'Veldu staðu',
  
  // Delete Modal Translations
  delete_organization_title: 'Eyða stofnun',
  delete_organization_message: 'Ertu viss um að þú viljir eyða þessari stofnun? Þessa aðgerð er ekki hægt að afturkalla.',
  delete_principal_title: 'Eyða skólastjóra',
  delete_principal_message: 'Ertu viss um að þú viljir eyða þessum skólastjóra? Þessa aðgerð er ekki hægt að afturkalla.',
  delete_guardian_title: 'Eyða forráðamanni',
  delete_guardian_message: 'Ertu viss um að þú viljir eyða þessum forráðamanni? Þessa aðgerð er ekki hægt að afturkalla.',
  confirm_delete: 'Eyða',
  cancel_delete: 'Hætta við',
  creating: 'Býr til...',
  updating: 'Uppfærir...',
  
  // Student Management
  students: 'Nemendur',
  create_student: 'Búa til nemanda',
  edit_student: 'Breyta nemanda',
  delete_student: 'Eyða nemanda',
  student_name: 'Nafn',
  student_first_name: 'Fornafn',
  student_last_name: 'Eftirnafn',
  student_class: 'Hópur',
  student_dob: 'Fæðingardagur',
  student_gender: 'Kyn',
  student_medical_notes: 'Læknisupplýsingar',
  student_allergies: 'Ofnæmi',
  student_emergency_contact: 'Neyðarsamband',
  student_first_name_placeholder: 'Sláðu inn fornafn',
  student_last_name_placeholder: 'Sláðu inn eftirnafn',
  student_medical_notes_placeholder: 'Sláðu inn læknisupplýsingar (valfrjálst)',
  student_allergies_placeholder: 'Sláðu inn ofnæmi (valfrjálst)',
  student_emergency_contact_placeholder: 'Sláðu inn neyðarsamband (valfrjálst)',
  gender_unknown: 'Óþekkt',
  gender_male: 'Karl',
  gender_female: 'Kona',
  gender_other: 'Annað',
  no_class_assigned: 'Enginn hópur úthlutaður',
  no_students: 'Engir nemendur fundust',
  delete_student_title: 'Eyða nemanda',
  delete_student_confirm: 'Ertu viss um að þú viljir eyða þessum nemanda? Þessa aðgerð er ekki hægt að afturkalla.',
  student_age_requirement: 'Nemandi verður að vera á aldrinum 0-18 ára',
  student_guardians: 'Forráðamenn',
  student_guardians_help: 'Veldu einn eða fleiri forráðamenn fyrir þennan nemanda',
  student_guardians_dropdown_help: 'Halda Ctrl/Cmd niðri til að velja marga forráðamenn',
  no_guardians_available: 'Engir forráðamenn í boði',
};
