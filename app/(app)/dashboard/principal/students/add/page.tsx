'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Menu } from 'lucide-react';
import { StudentForm, type StudentFormData } from '@/app/components/shared/StudentForm';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import Loading from '@/app/components/shared/Loading';

function AddStudentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const { sidebarRef } = usePrincipalPageLayout();

  // Guardians and classes required for the form
  const [guardians, setGuardians] = useState<Array<{ id: string; email: string | null; full_name?: string; first_name?: string; last_name?: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentFormData | null>(null);

  useEffect(() => {
    loadGuardians();
    loadClasses();
  }, []);

  // Load a single student for editing if id is present
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) {
      setEditingStudent(null);
      return;
    }
    const loadStudent = async () => {
      try {
        const res = await fetch(`/api/students?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
        const s = json.student || json.students?.find((x: any) => x.id === id);
        if (s) {
          const guardianIds = (s.guardians || []).map((g: any) => g.users?.id || g.guardian_id || g.id).filter(Boolean);
          const mapped: StudentFormData = {
            id: s.id,
            first_name: s.users?.first_name || s.first_name || '',
            last_name: s.users?.last_name || s.last_name || '',
            dob: s.users?.dob || s.dob || '',
            gender: s.users?.gender || s.gender || 'unknown',
            class_id: s.class_id || '',
            phone: s.users?.phone || s.phone || '',
            address: s.users?.address || s.address || '',
            registration_time: s.registration_time || '',
            start_date: s.start_date || '',
            barngildi: s.barngildi ?? 0,
            student_language: (s.student_language === 'en' ? 'english' : s.student_language === 'is' ? 'icelandic' : (s.student_language || 'english')),
            social_security_number: s.users?.ssn || s.social_security_number || '',
            medical_notes: s.medical_notes_encrypted || '',
            allergies: s.allergies_encrypted || '',
            emergency_contact: s.emergency_contact_encrypted || '',
            guardian_ids: guardianIds,
          };
          setEditingStudent(mapped);
        }
      } catch (e) {
        console.error('Error loading student by id:', e);
      }
    };
    loadStudent();
  }, [searchParams]);

  async function loadGuardians() {
    try {
      const res = await fetch(`/api/guardians?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setGuardians(json.guardians || []);
    } catch (e: any) {
      console.error('Error loading guardians:', e.message);
    }
  }

  async function loadClasses() {
    try {
      const response = await fetch(`/api/classes`, { cache: 'no-store' });
      const data = await response.json();
      if (response.ok) {
        setClasses(data.classes || []);
      } else {
        console.error('Error loading classes:', data.error);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }

  async function submitStudent(data: StudentFormData) {
    try {
      setError(null);
      setLoadingSubmit(true);

      // Strip guardian_ids
      const { guardian_ids, ...studentOnly } = data as any;
      
      const res = await fetch('/api/students', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentOnly),
      });

      let json: any = {};
      try {
        const text = await res.text();
        if (text) json = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        throw new Error(`Server error: ${res.status} - ${res.statusText}`);
      }

      if (!res.ok) {
        const errorMsg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(errorMsg);
      }

      // Signal dashboards to refresh students and counts
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('students_data_changed', String(Date.now())); } catch {}
      }
      // Redirect back to principal students page
      router.push('/dashboard/principal/students');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingSubmit(false);
    }
  }

  // Show loading ONLY if we have no user yet
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      {/* Content Header */}
      <div className="mb-ds-sm flex flex-col gap-ds-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-ds-sm">
          {/* Mobile menu button */}
          <button
            onClick={() => sidebarRef.current?.open()}
            className="md:hidden p-2 rounded-ds-md hover:bg-mint-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-ds-h2 font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {editingStudent?.id ? t.edit_student : t.add_student}
            </h2>
            <p className="mt-1 text-ds-small text-slate-600 dark:text-slate-400">
              {editingStudent?.id ? t.add_student_subtitle : t.student_form_subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-ds-sm">
          <ProfileSwitcher />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-ds-md rounded-ds-md bg-red-50 border border-red-200 px-ds-md py-ds-sm text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Student Form */}
      <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
        <StudentForm
          asPage={true}
          isOpen={true}
          onClose={() => router.push('/dashboard/principal/students')}
          onSubmit={submitStudent}
          initialData={editingStudent || undefined}
          loading={loadingSubmit}
          error={error}
          guardians={guardians}
          classes={classes}
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
            student_phone: t.student_phone,
            student_registration_time: t.student_registration_time,
            student_registration_time_placeholder: t.student_registration_time_placeholder,
            student_address: t.student_address,
            student_address_placeholder: t.student_address_placeholder,
            student_start_date: t.student_start_date,
            student_child_value: t.student_child_value,
            student_child_value_placeholder: t.student_child_value_placeholder,
            student_language: t.student_language,
            student_social_security_number: t.student_social_security_number,
            student_social_security_number_placeholder: t.student_social_security_number_placeholder,
            student_phone_placeholder: t.student_phone_placeholder,
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
      </div>
    </>
  );
}

export default function AddStudentPage() {
  return (
    <PrincipalPageLayout>
      <Suspense fallback={<Loading fullScreen variant="sand" />}>
        <AddStudentPageContent />
      </Suspense>
    </PrincipalPageLayout>
  );
}

