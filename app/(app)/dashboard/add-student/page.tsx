'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { StudentForm, type StudentFormData } from '@/app/components/shared/StudentForm';

export default function AddStudentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, isSigningIn } = useRequireAuth();
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);

  // Try to get org_id from multiple possible locations
  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const role = (userMetadata?.role || userMetadata?.user_role || userMetadata?.app_role || '').toString().toLowerCase();
  const rolesArr: any[] = Array.isArray(userMetadata?.roles) ? userMetadata?.roles : [];
  const activeRole = (userMetadata?.activeRole || '').toString().toLowerCase();
  const isPrincipal = [role, activeRole, ...rolesArr].some((r) => typeof r === 'string' && r.toLowerCase() === 'principal');
  const defaultStatus: 'pending' | 'approved' = isPrincipal ? 'approved' : 'pending';

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

  // Guardians and classes required for the form
  const [guardians, setGuardians] = useState<Array<{ id: string; email: string | null; full_name?: string; first_name?: string; last_name?: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentFormData | null>(null);

  useEffect(() => {
    loadGuardians();
    loadClasses();
  }, [finalOrgId]);

  // Load a single student for editing if id is present
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) {
      setEditingStudent(null);
      return;
    }
    const loadStudent = async () => {
      try {
        const res = await fetch(`/api/students?id=${encodeURIComponent(id)}&orgId=${encodeURIComponent(finalOrgId)}`, { cache: 'no-store' });
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
            org_id: finalOrgId || ''
          };
          setEditingStudent(mapped);
        }
      } catch (e) {
        console.error('Error loading student by id:', e);
      }
    };
    loadStudent();
  }, [searchParams, finalOrgId]);

  async function loadGuardians() {
    const oid = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!oid) return;
    try {
      const res = await fetch(`/api/guardians?orgId=${oid}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setGuardians(json.guardians || []);
    } catch (e: any) {
      console.error('Error loading guardians:', e.message);
    }
  }

  async function loadClasses() {
    const oid = finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    if (!oid) return;
    try {
      const response = await fetch(`/api/classes?orgId=${oid}`, { cache: 'no-store' });
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

      // If principal → create student directly; otherwise create a student request
      const isPrincipalNow = isPrincipal;

      let res: Response;
      if (isPrincipalNow) {
        // Strip guardian_ids and ensure status defaults to approved
        const { guardian_ids, ...studentOnly } = data as any;
        if (!studentOnly.status) studentOnly.status = defaultStatus;
        res = await fetch('/api/students', {
          method: data.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(studentOnly),
        });
      } else {
        // Teacher: create a student request (pending)
        const requestPayload: any = {
          first_name: data.first_name,
          last_name: data.last_name,
          dob: data.dob || null,
          gender: data.gender || 'unknown',
          medical_notes: data.medical_notes || '',
          allergies: data.allergies || '',
          emergency_contact: data.emergency_contact || '',
          status: 'pending',
          class_id: data.class_id || null,
          barngildi: data.barngildi ?? 0,
          ssn: data.social_security_number || '',
          address: data.address || '',
          phone: data.phone || '',
          registration_time: data.registration_time || '',
          start_date: data.start_date || '',
          guardian_ids: data.guardian_ids || [],
          requested_by: user?.id,
          org_id: finalOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '',
        };
        res = await fetch('/api/student-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        });
      }

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
      router.back();
    } catch (e: any) {
      setError(e.message);
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
            <p className="text-slate-600 dark:text-slate-400">Loading add student…</p>
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
              <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <ArrowLeft className="h-4 w-4" /> {t.back}
              </button>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{editingStudent?.id ? t.edit_student : t.title}</h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{editingStudent?.id ? '' : t.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Render the StudentForm inline as a full page form (no modal) */}
          <StudentForm
            asPage={true}
            isOpen={true}
            onClose={() => router.back()}
            onSubmit={submitStudent}
            initialData={editingStudent || {
              first_name: '',
              last_name: '',
              dob: '',
              gender: 'unknown',
              class_id: '',
              status: defaultStatus,
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
            }}
            loading={loadingSubmit}
            error={error}
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
              student_phone: t.student_phone,
              student_registration_time: t.student_registration_time,
              student_registration_time_placeholder: t.student_registration_time_placeholder,
              student_address: t.student_address,
              student_address_placeholder: t.student_address_placeholder,
              student_start_date: t.student_start_date,
              student_child_value: t.student_child_value,
              student_child_value_placeholder: t.student_child_value_placeholder,
              student_language: t.student_language,
              student_status: 'Status',
              status_pending: 'Pending',
              status_approved: 'Approved',
              status_rejected: 'Rejected',
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
      </main>
    </div>
  );
}

const enText = {
  title: 'Add Student',
  subtitle: 'Fill the details below to create a new student.',
  back: 'Back',
  create_student: 'Create Student',
  edit_student: 'Edit Student',
  first_name: 'First Name',
  last_name: 'Last Name',
  dob: 'Date of Birth',
  gender: 'Gender',
  class: 'Class',
  guardians: 'Guardians',
  medical_notes: 'Medical Notes',
  allergies: 'Allergies',
  emergency_contact: 'Emergency Contact',
  student_first_name_placeholder: 'Enter first name',
  student_last_name_placeholder: 'Enter last name',
  student_medical_notes_placeholder: 'Enter medical notes (optional)',
  student_allergies_placeholder: 'Enter allergies (optional)',
  student_emergency_contact_placeholder: 'Enter emergency contact (optional)',
  student_phone: 'Phone',
  student_registration_time: 'Registration Time',
  student_registration_time_placeholder: 'Enter registration time',
  student_address: 'Address',
  student_address_placeholder: 'Enter address',
  student_start_date: 'Start Date',
  student_child_value: 'Child Value',
  student_child_value_placeholder: 'Enter child value',
  student_language: 'Language',
  student_social_security_number: 'Social Security Number',
  student_social_security_number_placeholder: 'Enter social security number',
  student_phone_placeholder: 'Enter phone number',
  gender_unknown: 'Unknown',
  gender_male: 'Male',
  gender_female: 'Female',
  gender_other: 'Other',
  no_class_assigned: 'No class assigned',
  no_guardians_available: 'No guardians available',
  student_age_requirement: 'Student must be between 0-18 years old',
  create: 'Create',
  update: 'Update',
  cancel: 'Cancel',
  creating: 'Creating...',
  updating: 'Updating...'
};

const isText = {
  title: 'Bæta við nemanda',
  subtitle: 'Fylltu út upplýsingar til að stofna nýjan nemanda.',
  back: 'Til baka',
  create_student: 'Búa til nemanda',
  edit_student: 'Breyta nemanda',
  first_name: 'Fornafn',
  last_name: 'Eftirnafn',
  dob: 'Fæðingardagur',
  gender: 'Kyn',
  class: 'Hópur',
  guardians: 'Forráðamenn',
  medical_notes: 'Læknisfræðilegar athugasemdir',
  allergies: 'Ofnæmi',
  emergency_contact: 'Neyðarsamband',
  student_first_name_placeholder: 'Sláðu inn fornafn',
  student_last_name_placeholder: 'Sláðu inn eftirnafn',
  student_medical_notes_placeholder: 'Sláðu inn læknisfræðilegar athugasemdir (valfrjálst)',
  student_allergies_placeholder: 'Sláðu inn ofnæmi (valfrjálst)',
  student_emergency_contact_placeholder: 'Sláðu inn neyðarsamband (valfrjálst)',
  student_phone: 'Sími',
  student_registration_time: 'Skráningartími',
  student_registration_time_placeholder: 'Sláðu inn skráningartíma',
  student_address: 'Heimilisfang',
  student_address_placeholder: 'Sláðu inn heimilisfang',
  student_start_date: 'Upphafsdagur',
  student_child_value: 'Barnagildi',
  student_child_value_placeholder: 'Sláðu inn barnagildi',
  student_language: 'Tungumál',
  student_social_security_number: 'Kennitala',
  student_social_security_number_placeholder: 'Sláðu inn kennitölu',
  student_phone_placeholder: 'Sláðu inn símanúmer',
  gender_unknown: 'Óþekkt',
  gender_male: 'Karl',
  gender_female: 'Kona',
  gender_other: 'Annað',
  no_class_assigned: 'Enginn hópur úthlutaður',
  no_guardians_available: 'Engir forráðamenn tiltækir',
  student_age_requirement: 'Nemandi verður að vera á aldrinum 0-18 ára',
  create: 'Búa til',
  update: 'Uppfæra',
  cancel: 'Hætta við',
  creating: 'Býr til...',
  updating: 'Uppfærir...'
};



