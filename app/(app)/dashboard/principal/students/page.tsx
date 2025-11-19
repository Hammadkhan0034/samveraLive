'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { ArrowLeft, Plus, Filter, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { StudentForm, type StudentFormData } from '@/app/components/shared/StudentForm';
import { StudentTable } from '@/app/components/shared/StudentTable';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';

type Lang = 'is' | 'en';

export default function StudentsPage() {
  const { t } = useLanguage();
  const { user, loading, isSigningIn } = useRequireAuth(['principal']);
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

  // Student states - initialize with cached data
  const [students, setStudents] = useState<Array<{ id: string; first_name: string; last_name: string | null; dob: string | null; gender: string; class_id: string | null; phone: string | null; address: string | null; registration_number: string | null; start_date: string | null; child_value: string | null; language: string | null; social_security_number: string | null; created_at: string; classes?: any; guardians?: Array<{ id: string; relation: string; users?: { id: string; full_name: string; email: string } }> }>>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('students_cache');
      return cached ? JSON.parse(cached) : [];
    }
    return [];
  });
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submittingStudent, setSubmittingStudent] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState<StudentFormData>({ 
    first_name: '', 
    last_name: '', 
    dob: '', 
    gender: 'unknown', 
    class_id: '', 
    phone: '',
    address: '',
    registration_time: '',
    start_date: '',
    barngildi: 0,
    student_language: 'english',
    social_security_number: '',
    medical_notes: '', 
    allergies: '', 
    emergency_contact: '', 
    guardian_ids: [], 
    org_id: '' 
  });
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isDeleteStudentModalOpen, setIsDeleteStudentModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);

  // Guardian states (needed for student form)
  const [guardians, setGuardians] = useState<Array<{ id: string; email: string | null; phone: string | null; full_name: string; org_id: string; is_active: boolean; created_at: string; metadata?: any }>>([]);
  const [loadingGuardians, setLoadingGuardians] = useState(false);

  // Classes states (needed for student form)
  const [classes, setClasses] = useState<Array<{ id: string; name: string; code: string | null; assigned_teachers: any[] }>>([]);

  // Filter states
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Language handled by global context

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isFilterDropdownOpen && !target.closest('.filter-dropdown')) {
        setIsFilterDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterDropdownOpen]);

  // Load data on mount - start immediately
  useEffect(() => {
    loadStudents();
    loadGuardians();
    loadClasses();
  }, []);

  // Also load when user and orgId are available
  useEffect(() => {
    if (user?.id && finalOrgId) {
      loadStudents(false);
      loadGuardians(false);
      loadClasses(false);
    }
  }, [user?.id, finalOrgId]);

  // Load students
  async function loadStudents(showLoading = true) {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;

    try {
      if (showLoading) {
        setLoadingStudents(true);
      }
      setStudentError(null);

      const res = await fetch(`/api/students?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const studentsList = json.students || [];
      setStudents(studentsList);
      
      // Cache the data for instant loading
      if (typeof window !== 'undefined') {
        localStorage.setItem('students_cache', JSON.stringify(studentsList));
      }
    } catch (e: any) {
      console.error('❌ Error loading students:', e.message);
      setStudentError(e.message);
    } finally {
      if (showLoading) {
        setLoadingStudents(false);
      }
    }
  }

  // Load guardians
  async function loadGuardians(showLoading = true) {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;

    try {
      if (showLoading) {
        setLoadingGuardians(true);
      }

      const res = await fetch(`/api/guardians?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const guardiansList = json.guardians || [];
      setGuardians(guardiansList);
    } catch (e: any) {
      console.error('❌ Error loading guardians:', e.message);
    } finally {
      if (showLoading) {
        setLoadingGuardians(false);
      }
    }
  }

  // Load classes
  async function loadClasses(showLoading = false) {
    const orgId = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!orgId) return;

    try {
      const response = await fetch(`/api/classes?orgId=${orgId}`, { cache: 'no-store' });
      const data = await response.json();

      if (response.ok) {
        const classesData = data.classes || [];
        setClasses(classesData);
      } else {
        console.error('Error loading classes:', data.error);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }

  // Student form submission
  async function submitStudent(data: StudentFormData) {
    try {
      setStudentError(null);
      setSubmittingStudent(true);

      const res = await fetch('/api/students', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });


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


      // Close modal and reset form
      setIsStudentModalOpen(false);
      setStudentForm({ 
        first_name: '', 
        last_name: '', 
        dob: '', 
        gender: 'unknown', 
        class_id: '', 
        phone: '',
        address: '',
        registration_time: '',
        start_date: '',
        barngildi: 0,
        student_language: 'english',
        social_security_number: '',
        medical_notes: '', 
        allergies: '', 
        emergency_contact: '', 
        guardian_ids: [], 
        org_id: finalOrgId || '' 
      });

      // Refresh students list
      await loadStudents(false);
    } catch (e: any) {
      console.error('❌ Error submitting student:', e.message);
      setStudentError(e.message);
    } finally {
      setSubmittingStudent(false);
    }
  }

  // Student create now navigates to dedicated page
  function openCreateStudentModal() {
    router.push('/dashboard/add-student');
  }

  function openEditStudentModal(student: any) {
    router.push(`/dashboard/add-student?id=${encodeURIComponent(student.id)}`);
  }

  function openDeleteStudentModal(id: string) {
    setStudentToDelete(id);
    setIsDeleteStudentModalOpen(true);
  }

  async function confirmDeleteStudent() {
    if (!studentToDelete) return;
    try {
      setStudentError(null);
      setDeletingStudent(true);
     

      const res = await fetch(`/api/students?id=${encodeURIComponent(studentToDelete)}`, { method: 'DELETE' });
      
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
      setIsDeleteStudentModalOpen(false);
      setStudentToDelete(null);
      await loadStudents(false);
    } catch (e: any) {
      setStudentError(e.message);
    } finally {
      setDeletingStudent(false);
    }
  }

  // Compute loading state without early returning (to preserve hook order)
  const showInitialLoading = loading && !user && isSigningIn;

  // Filter students based on selected class and search
  const filteredStudents = useMemo(() => {
    const byClass = selectedClassFilter === 'all' ? students : students.filter(s => s.class_id === selectedClassFilter);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byClass;
    return byClass.filter((s) => {
      const first = ((s as any).users?.first_name || s.first_name || '').toLowerCase();
      const last = ((s as any).users?.last_name || s.last_name || '').toLowerCase();
      const full = `${first} ${last}`.trim();
      const cls = (s as any).classes?.name ? String((s as any).classes.name).toLowerCase() : '';
      return first.includes(q) || last.includes(q) || full.includes(q) || cls.includes(q);
    });
  }, [students, selectedClassFilter, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(start, start + itemsPerPage);
  }, [filteredStudents, currentPage]);

  // Get filter options
  const filterOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [
      { value: 'all', label: t.all_classes }
    ];
    
    // Add classes to options
    if (classes && classes.length > 0) {
      classes.forEach(cls => {
        options.push({
          value: cls.id,
          label: cls.name || `Class ${cls.id.slice(0, 8)}`
        });
      });
    }
    
    return options;
  }, [classes, t]);

  if (showInitialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading students page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 mt-14 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> {t.back}
          </button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.students}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.add_student_subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={openCreateStudentModal}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Plus className="h-4 w-4" /> {t.add_student}
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.students}</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={'Search students...'}
                className="pl-3 pr-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 w-64"
              />
            </div>
            {/* Filter Dropdown */}
            <div className="relative filter-dropdown">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-2 rounded-md bg-transparent border border-gray-300 text-sm px-3 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{filterOptions.find(opt => opt.value === selectedClassFilter)?.label || t.all_classes}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isFilterDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-sand-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-50">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSelectedClassFilter(option.value);
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-sm text-left dark:hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg ${
                      selectedClassFilter === option.value 
                        ? 'bg-slate-200 dark:bg-slate-700 text-gray-700 dark:text-slate-100  dark:hover:bg-slate-700' 
                        : 'text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>
          
        </div>
        <StudentTable
          students={paginatedStudents}
          error={studentError}
          onEdit={openEditStudentModal}
          onDelete={openDeleteStudentModal}
          onCreate={openCreateStudentModal}
          translations={{
            students: t.students,
            student_name: t.student_name,
            student_first_name: t.first_name,
            student_last_name: t.last_name,
            student_class: t.student_class,
            student_guardians: t.student_guardians,
            student_dob: t.student_dob,
            student_gender: t.student_gender,
            actions: t.actions,
            create: t.create,
            no_students: t.no_students,
            edit: t.edit,
            delete: t.delete
          }}
        />
        {/* Pagination controls */}
        <div className="mt-4 w-full flex justify-end gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {t.prev || 'Prev'}
          </button>
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx + 1)}
              className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm ${currentPage === idx + 1 ? 'bg-white text-black border border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600' : 'border border-slate-400 dark:border-slate-600 dark:text-slate-200'}`}
            >
              {idx + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {t.next || 'Next'}
          </button>
        </div>
      </div>

      {/* Student Form Modal */}
      <StudentForm
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        onSubmit={submitStudent}
        initialData={studentForm}
        loading={submittingStudent}
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
          student_status: 'Status',
          status_pending: 'Pending',
          status_approved: 'Approved',
          status_rejected: 'Rejected',
          student_guardians: t.guardians,
          student_medical_notes: t.medical_notes,
          student_allergies: t.allergies,
          student_emergency_contact: t.emergency_contact,
          student_phone: t.student_phone || 'Phone',
          student_registration_time: t.student_registration_time || 'Registration Time',
          student_registration_time_placeholder: t.student_registration_time_placeholder || 'Enter registration time',
          student_address: t.student_address || 'Address',
          student_address_placeholder: t.student_address_placeholder || 'Enter address',
          student_start_date: t.student_start_date || 'Start Date',
          student_child_value: t.student_child_value || 'Child Value',
          student_child_value_placeholder: t.student_child_value_placeholder || 'Enter child value',
          student_language: t.student_language || 'Language',
          student_social_security_number: t.student_social_security_number || 'Social Security Number',
          student_social_security_number_placeholder: t.student_social_security_number_placeholder || 'Enter social security number',
          student_phone_placeholder: t.student_phone_placeholder || 'Enter phone number',
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

      {/* Delete Student Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteStudentModalOpen}
        onClose={() => setIsDeleteStudentModalOpen(false)}
        onConfirm={confirmDeleteStudent}
        title={t.delete_student}
        message={t.delete_student_confirm}
        loading={deletingStudent}
        error={studentError}
        translations={{
          confirm_delete: t.delete,
          cancel: t.cancel
        }}
        />
      </main>
    </div>
  );
}

// Translations removed - using centralized translations from @/lib/translations


