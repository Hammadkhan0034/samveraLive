import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getRequestAuthContext, getCurrentUserOrgId } from '@/lib/server-helpers';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { StudentHeader } from '@/app/components/student/StudentHeader';
import { StudentInfoCard } from '@/app/components/student/StudentInfoCard';
import { ClassCard } from '@/app/components/student/ClassCard';
import { GuardianList } from '@/app/components/student/GuardianList';
import { MedicalInfo } from '@/app/components/student/MedicalInfo';
import { StudentDetailSkeleton } from '@/app/components/loading-skeletons/StudentDetailSkeleton';
import type { Student } from '@/lib/types/attendance';
import type { User } from '@/lib/types/users';
import type { UserMetadata, SamveraRole } from '@/lib/types/auth';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface StudentDetailData extends Student {
  users?: User | null;
  classes?: {
    id: string;
    name: string;
    code?: string | null;
    created_by?: string | null;
    created_at?: string;
    users?: {
      first_name?: string;
      last_name?: string | null;
    } | null;
  } | null;
  guardians?: Array<{
    id: string;
    relation: string;
    guardian_id?: string;
    student_id?: string;
    users?: {
      id: string;
      first_name: string;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      avatar_url: string | null;
    } | null;
  }>;
}

async function fetchStudentData(studentId: string, orgId: string, userId: string, userRoles: SamveraRole[]): Promise<StudentDetailData | null> {
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }

  // Check if user has access
  const isPrincipalAdminTeacher = userRoles.some((role) =>
    ['principal', 'admin', 'teacher'].includes(role)
  );
  const isGuardian = userRoles.includes('guardian');

  // For guardians, check if they're linked to this student
  if (isGuardian && !isPrincipalAdminTeacher) {
    const { data: relationship, error: relError } = await supabaseAdmin
      .from('guardian_students')
      .select('id')
      .eq('guardian_id', userId)
      .eq('student_id', studentId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (relError || !relationship) {
      // Guardian doesn't have access to this student
      return null;
    }
  }

  // Fetch student with all joins
  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select(`
      id,
      user_id,
      class_id,
      org_id,
      registration_time,
      start_date,
      student_language,
      barngildi,
      medical_notes_encrypted,
      allergies_encrypted,
      emergency_contact_encrypted,
      created_at,
      updated_at,
      users:users!students_user_id_fkey (
        id,
        org_id,
        email,
        phone,
        ssn,
        address,
        canLogin,
        first_name,
        last_name,
        role,
        bio,
        avatar_url,
        gender,
        last_login_at,
        is_active,
        is_staff,
        status,
        dob,
        theme,
        language,
        deleted_at,
        created_at,
        updated_at
      ),
      classes:classes!students_class_id_fkey (
        id,
        name,
        code,
        created_by,
        created_at,
        users:users!classes_created_by_fkey (
          first_name,
          last_name
        )
      )
    `)
    .eq('id', studentId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (studentError || !student) {
    return null;
  }

  // Fetch guardians separately
  const { data: guardians, error: guardiansError } = await supabaseAdmin
    .from('guardian_students')
    .select(`
      id,
      relation,
      guardian_id,
      student_id,
      users:users!guardian_students_guardian_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone,
        avatar_url
      )
    `)
    .eq('student_id', studentId)
    .eq('org_id', orgId);

  if (guardiansError) {
    console.error('Error fetching guardians:', guardiansError);
  }

  // Transform the data to match our component expectations
  const userData = student.users as any;
  const studentData: StudentDetailData = {
    id: student.id,
    user_id: student.user_id,
    class_id: student.class_id,
    first_name: userData?.first_name || '',
    last_name: userData?.last_name || null,
    dob: userData?.dob || null,
    gender: userData?.gender || 'unknown',
    created_at: student.created_at,
    updated_at: student.updated_at || null,
    registration_time: student.registration_time,
    start_date: student.start_date,
    student_language: student.student_language,
    barngildi: student.barngildi,
    medical_notes_encrypted: student.medical_notes_encrypted,
    allergies_encrypted: student.allergies_encrypted,
    emergency_contact_encrypted: student.emergency_contact_encrypted,
    users: student.users as User | null,
    classes: student.classes
      ? {
          id: student.classes.id,
          name: student.classes.name,
          code: student.classes.code || null,
          created_by: student.classes.created_by || null,
          created_at: student.classes.created_at || null,
          users: (student.classes as any).users || null,
        }
      : null,
    guardians: (guardians || []).map((g: any) => ({
      id: g.id,
      relation: g.relation || 'Guardian',
      guardian_id: g.guardian_id,
      student_id: g.student_id,
      users: g.users,
    })),
  };

  return studentData;
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { id: studentId } = await params;

  try {
    // Get authenticated user with role check
    const { user } = await getRequestAuthContext({
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
      requireOrg: true,
    });

    const metadata = user.user_metadata as UserMetadata | undefined;
    const orgId = metadata?.org_id || (await getCurrentUserOrgId(user));
    const userRoles = (metadata?.roles ?? []) as SamveraRole[];

    // Fetch student data
    const studentData = await fetchStudentData(studentId, orgId, user.id, userRoles);

    if (!studentData) {
      notFound();
    }

    // Verify org access
    if (studentData.users?.org_id && studentData.users.org_id !== orgId) {
      redirect('/dashboard');
    }

    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="space-y-ds-md">
          <StudentHeader student={studentData} user={studentData.users || undefined} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-ds-md">
            <StudentInfoCard student={studentData} user={studentData.users || undefined} />
            <ClassCard classData={studentData.classes || null} />
          </div>
          <GuardianList guardians={studentData.guardians || []} />
          <MedicalInfo student={studentData} />
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading student detail:', error);
    notFound();
  }
}

