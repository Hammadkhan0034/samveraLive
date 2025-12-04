'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { StudentForm } from '@/app/components/shared/StudentForm';
import type { StudentFormData } from '@/lib/types/students';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
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

  const loadGuardians = useCallback(async () => {
    try {
      const res = await fetch(`/api/guardians?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setGuardians(json.guardians || []);
    } catch (e) {
      console.error('Error loading guardians:', e);
    }
  }, []);

  const loadClasses = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadGuardians();
    loadClasses();
  }, [loadGuardians, loadClasses]);

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
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || `Failed with ${res.status}`);
        }
        
        const json = await res.json();
        const s = json.student || json.students?.find((x: { id: string }) => x.id === id);
        
        if (s) {
          const guardianIds = (s.guardians || [])
            .map((g: { users?: { id: string }; guardian_id?: string; id: string }) => 
              g.users?.id || g.guardian_id || g.id
            )
            .filter(Boolean) as string[];

          const mapped: StudentFormData = {
            id: s.id,
            first_name: s.users?.first_name || s.first_name || '',
            last_name: s.users?.last_name || s.last_name || '',
            dob: s.users?.dob || s.dob || '',
            gender: s.users?.gender || s.gender || 'unknown',
            class_id: s.class_id || '',
            address: s.users?.address || s.address || '',
            start_date: s.start_date || '',
            barngildi: s.barngildi ?? 0,
            student_language: s.student_language === 'en' 
              ? 'english' 
              : s.student_language === 'is' 
                ? 'icelandic' 
                : (s.student_language || 'english'),
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
        setError(e instanceof Error ? e.message : 'Failed to load student');
      }
    };

    loadStudent();
  }, [searchParams]);

  const submitStudent = useCallback(async (data: StudentFormData) => {
    try {
      setError(null);
      setLoadingSubmit(true);

      // Include guardian_ids in the request - filter out empty strings
      const payload = {
        ...data,
        guardian_ids: (data.guardian_ids || []).filter(id => id && id.trim() !== ''),
      };
      
      const res = await fetch('/api/students', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const errorMsg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(errorMsg);
      }

      // Signal dashboards to refresh students and counts
      if (typeof window !== 'undefined') {
        try { 
          localStorage.setItem('students_data_changed', String(Date.now())); 
        } catch {}
      }
      
      router.push('/dashboard/principal/students');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit student');
    } finally {
      setLoadingSubmit(false);
    }
  }, [router]);

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
      <PageHeader
        title={editingStudent?.id ? t.edit_student : t.add_student}
        subtitle={editingStudent?.id ? t.add_student_subtitle : t.student_form_subtitle}
        showBackButton={false}
      />

      {/* Error Message */}
      {error && (
        <div className="mb-ds-md rounded-ds-md bg-red-50 border border-red-200 px-ds-md py-ds-sm text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Student Form */}
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
        />
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

