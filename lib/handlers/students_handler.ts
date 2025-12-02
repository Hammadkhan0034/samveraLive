import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import {
  validateBody,
  validateQuery,
  classIdSchema,
  studentIdSchema,
  firstNameSchema,
  lastNameSchema,
  studentDobSchema,
  genderSchema,
  studentLanguageSchema,
  barngildiSchema,
  phoneSchema,
  addressSchema,
  ssnSchema,
  medicalNotesSchema,
  allergiesSchema,
  emergencyContactSchema,
  guardianIdsSchema,
  dateSchema,
} from '@/lib/validation';
import type { AuthUser, UserMetadata, SamveraRole } from '@/lib/types/auth';

// GET query parameter schema
const getStudentsQuerySchema = z.object({
  classId: classIdSchema.optional(),
});

// POST body schema with date transformations
const postStudentBodySchema = z
  .object({
    first_name: firstNameSchema,
    last_name: lastNameSchema,
    dob: studentDobSchema.nullable().optional(),
    gender: genderSchema.optional(),
    class_id: classIdSchema.optional(),
    registration_time: z.string().nullable().optional(),
    start_date: dateSchema.nullable().optional(),
    barngildi: barngildiSchema.optional(),
    student_language: studentLanguageSchema.optional(),
    medical_notes: medicalNotesSchema,
    allergies: allergiesSchema,
    emergency_contact: emergencyContactSchema,
    phone: phoneSchema,
    address: addressSchema,
    social_security_number: ssnSchema,
    guardian_ids: guardianIdsSchema.optional().default([]),
  })
  .transform((data) => {
    // Transform dates to ISO format strings
    let validatedDob = null;
    if (data.dob) {
      const birthDate = new Date(data.dob);
      validatedDob = birthDate.toISOString().split('T')[0];
    }

    let validatedStartDate = null;
    if (data.start_date) {
      const startDate = new Date(data.start_date);
      validatedStartDate = startDate.toISOString().split('T')[0];
    }

    return {
      ...data,
      dob: validatedDob,
      start_date: validatedStartDate,
    };
  });

// PUT body schema with date transformations
const putStudentBodySchema = z
  .object({
    id: studentIdSchema,
    first_name: firstNameSchema,
    last_name: lastNameSchema,
    dob: studentDobSchema.nullable().optional(),
    gender: genderSchema.optional(),
    class_id: classIdSchema.optional(),
    registration_time: z.string().nullable().optional(),
    start_date: dateSchema.nullable().optional(),
    barngildi: barngildiSchema.optional(),
    student_language: studentLanguageSchema.optional(),
    medical_notes: medicalNotesSchema,
    allergies: allergiesSchema,
    emergency_contact: emergencyContactSchema,
    phone: phoneSchema,
    address: addressSchema,
    social_security_number: ssnSchema,
    guardian_ids: guardianIdsSchema.optional().default([]),
  })
  .transform((data) => {
    // Transform dates to ISO format strings
    let validatedDob = null;
    if (data.dob) {
      const birthDate = new Date(data.dob);
      validatedDob = birthDate.toISOString().split('T')[0];
    }

    let validatedStartDate = null;
    if (data.start_date) {
      const startDate = new Date(data.start_date);
      validatedStartDate = startDate.toISOString().split('T')[0];
    }

    return {
      ...data,
      dob: validatedDob,
      start_date: validatedStartDate,
    };
  });

// DELETE query parameter schema
const deleteStudentQuerySchema = z.object({
  id: studentIdSchema,
});

export async function handleGetStudents(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
): Promise<NextResponse> {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const roles = (metadata?.roles ?? []) as SamveraRole[];
  const activeRole = metadata?.activeRole;
  const orgId = metadata?.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  // Check if user has principal, admin, teacher, or parent/guardian role
  const isPrincipalAdminTeacher = roles.some((role) =>
    ['principal', 'admin', 'teacher'].includes(role),
  );
  const isParentGuardian =
    activeRole === 'guardian' ||
    roles.includes('guardian');

  if (!isPrincipalAdminTeacher && !isParentGuardian) {
    return NextResponse.json(
      { error: 'Access denied. Valid role required.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(getStudentsQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  const { classId } = queryValidation.data;

  // For parents/guardians, only allow access to their linked students
  let allowedStudentIds: string[] | null = null;
  if (isParentGuardian && !isPrincipalAdminTeacher) {
    // Fetch guardian-student relationships
    const { data: relationships, error: relError } = await adminClient
      .from('guardian_students')
      .select('student_id')
      .eq('guardian_id', user.id);

    if (relError) {
      console.error('❌ Error fetching guardian-student relationships:', relError);
      return NextResponse.json(
        { error: 'Failed to fetch linked students' },
        { status: 500 },
      );
    }

    allowedStudentIds = (relationships || [])
      .map((r: any) => r.student_id)
      .filter(Boolean);

    // If no linked students, return empty array
    if (allowedStudentIds.length === 0) {
      return NextResponse.json(
        {
          students: [],
          total_students: 0,
        },
        {
          status: 200,
          headers: getUserDataCacheHeaders(),
        },
      );
    }
  }

  // Build query based on filters
  let query = adminClient
    .from('students')
    .select(`
        id,
        user_id,
        class_id,
        users!students_user_id_fkey (
          id,
          first_name,
          last_name,
          dob,
          gender,
          phone,
          address,
          ssn
        ),
        registration_time,
        start_date,
        barngildi,
        student_language,
        medical_notes_encrypted,
        allergies_encrypted,
        emergency_contact_encrypted,
        created_at,
        updated_at,
        classes!students_class_id_fkey (
          id,
          name
        )
      `)
    .is('deleted_at', null)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  // Filter by class if provided
  if (classId) {
    query = query.eq('class_id', classId);
  }

  // For parents/guardians, filter to only their linked students
  if (allowedStudentIds && allowedStudentIds.length > 0) {
    query = query.in('id', allowedStudentIds);
  }

  const { data: students, error } = await query;

  if (error) {
    console.error('❌ Error fetching students:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch guardian relationships for each student
  const studentsWithGuardians = await Promise.all(
    (students || []).map(async (student) => {
      const { data: guardianRelations, error: guardianError } = await adminClient
        .from('guardian_students')
        .select(`
            id,
            relation,
            guardian_id,
            student_id,
            users!guardian_students_guardian_id_fkey (
              id,
              first_name,
              last_name,
              email
            )
          `)
        .eq('student_id', student.id);

      if (guardianError) {
        console.error(
          `❌ Error fetching guardians for student ${student.id}:`,
          guardianError,
        );
      }

      // Log guardian data for debugging
      if (guardianRelations && guardianRelations.length > 0) {
        console.log(
          `✅ Found ${guardianRelations.length} guardian(s) for student ${student.id}:`,
          guardianRelations,
        );
      }

      return {
        ...student,
        guardians: guardianRelations || [],
      };
    }),
  );

  return NextResponse.json(
    {
      students: studentsWithGuardians || [],
      total_students: studentsWithGuardians?.length || 0,
    },
    {
      status: 200,
      headers: getUserDataCacheHeaders(),
    },
  );
}

export async function handlePostStudent(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
): Promise<NextResponse> {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  // Validate Supabase URL is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not configured');
    return NextResponse.json(
      {
        error:
          'Supabase URL is not configured. Please check your environment variables.',
      },
      { status: 500 },
    );
  }

  // Validate URL format
  try {
    new URL(supabaseUrl);
  } catch (urlError) {
    console.error('❌ Invalid Supabase URL format:', supabaseUrl);
    return NextResponse.json(
      { error: `Invalid Supabase URL format: ${supabaseUrl}` },
      { status: 500 },
    );
  }

  const body = await request.json();
  const bodyValidation = validateBody(postStudentBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }
  const {
    first_name,
    last_name,
    dob: validatedDob,
    gender: normalizedGender,
    class_id,
    registration_time,
    start_date: validatedStartDate,
    barngildi: normalizedBarngildi,
    student_language: normalizedLanguage,
    medical_notes,
    allergies,
    emergency_contact,
    phone,
    address,
    social_security_number,
    guardian_ids,
  } = bodyValidation.data;

  if (!first_name) {
    return NextResponse.json(
      { error: 'Missing required fields: first_name' },
      { status: 400 },
    );
  }

  // Validate age if date of birth is provided
  if (validatedDob) {
    const birthDate = new Date(validatedDob);

    // Check if the date is valid
    if (isNaN(birthDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for date of birth' },
        { status: 400 },
      );
    }

    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Calculate actual age
    const actualAge =
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ? age - 1
        : age;

    // Check if age is within valid range (0-18 years)
    if (actualAge < 0 || actualAge > 18) {
      return NextResponse.json(
        { error: 'Student age must be between 0 and 18 years old' },
        { status: 400 },
      );
    }
  }

  console.log('📋 Creating student:', {
    first_name,
    last_name,
    class_id,
    registration_time,
    student_language: normalizedLanguage,
    guardian_ids,
    barngildi: normalizedBarngildi,
  });

  // First create a user record for the student
  let createdUser, userError;
  try {
    const result = await adminClient
      .from('users')
      .insert({
        first_name,
        last_name: last_name || null,
        dob: validatedDob,
        gender: normalizedGender || 'unknown',
        phone: phone || null,
        address: address || null,
        ssn: social_security_number || null,
        role: 'student' as any,
        org_id: orgId,
        is_active: true,
      })
      .select('id')
      .single();

    createdUser = result.data;
    userError = result.error;
  } catch (networkError: any) {
    console.error('❌ Network error creating student user:', networkError);
    console.error('❌ Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.error('❌ Error details:', {
      message: networkError?.message,
      cause: networkError?.cause,
      stack: networkError?.stack,
    });
    return NextResponse.json(
      {
        error: `Network error: Failed to connect to Supabase. Please check your connection and Supabase configuration.`,
        details: networkError?.message || 'Unknown network error',
      },
      { status: 500 },
    );
  }

  if (userError) {
    console.error('❌ Failed to create student user:', userError);
    console.error('❌ Error details:', {
      message: userError.message,
      details: userError.details,
      hint: userError.hint,
      code: userError.code,
    });
    return NextResponse.json(
      {
        error: `Failed to create student user: ${userError.message}`,
        details: userError.details || '',
        hint: userError.hint || '',
      },
      { status: 500 },
    );
  }

  const userId = createdUser?.id;

  // Create student record
  const { data: student, error: studentError } = await adminClient
    .from('students')
    .insert({
      user_id: userId,
      class_id: class_id || null,
      org_id: orgId,
      registration_time: registration_time || null,
      start_date: validatedStartDate,
      barngildi: normalizedBarngildi || 0.5,
      student_language: normalizedLanguage || 'english',
      medical_notes_encrypted: medical_notes || null,
      allergies_encrypted: allergies || null,
      emergency_contact_encrypted: emergency_contact || null,
    })
    .select(
      'id,user_id,class_id,registration_time,start_date,barngildi,student_language,created_at',
    )
    .single();

  if (studentError) {
    console.error('❌ Failed to create student:', studentError);
    return NextResponse.json(
      { error: `Failed to create student: ${studentError.message}` },
      { status: 500 },
    );
  }

  // Linking guardians to student via API has been deprecated; handled by /api/guardian-students
  // Intentionally no-op here

  console.log('✅ Student created successfully:', student.id);

  return NextResponse.json(
    {
      student,
      message: 'Student created successfully!',
    },
    { status: 201 },
  );
}

export async function handlePutStudent(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
): Promise<NextResponse> {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  const body = await request.json();
  const bodyValidation = validateBody(putStudentBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }
  const {
    id,
    first_name,
    last_name,
    dob: validatedDob,
    gender: normalizedGender,
    class_id,
    registration_time,
    start_date: validatedStartDate,
    barngildi: normalizedBarngildi,
    student_language: normalizedLanguage,
    medical_notes,
    allergies,
    emergency_contact,
    phone,
    address,
    social_security_number,
    guardian_ids,
  } = bodyValidation.data;

  console.log('📋 Updating student:', {
    id,
    first_name,
    last_name,
    class_id,
    registration_time,
    student_language: normalizedLanguage,
    guardian_ids,
    barngildi: normalizedBarngildi,
  });

  // Fetch student to get user_id for user updates
  const { data: existingStudent, error: fetchStudentErr } = await adminClient
    .from('students')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchStudentErr) {
    console.error('❌ Failed to fetch student for update:', fetchStudentErr);
    return NextResponse.json(
      { error: 'Failed to load student for update' },
      { status: 500 },
    );
  }

  const userIdForUpdate = existingStudent?.user_id;

  // Update user record if available
  if (userIdForUpdate) {
    const { error: userUpdErr } = await adminClient
      .from('users')
      .update({
        first_name,
        last_name: last_name || null,
        dob: validatedDob,
        gender: normalizedGender || 'unknown',
        phone: phone || null,
        address: address || null,
        ssn: social_security_number || null,
      })
      .eq('id', userIdForUpdate);

    if (userUpdErr) {
      console.error('❌ Failed to update student user:', userUpdErr);
    }
  }

  // Update student record (non-user fields)
  const { data: student, error: studentError } = await adminClient
    .from('students')
    .update({
      class_id: class_id || null,
      org_id: orgId,
      registration_time: registration_time || null,
      start_date: validatedStartDate,
      barngildi: normalizedBarngildi || 0.5,
      student_language: normalizedLanguage || 'english',
      medical_notes_encrypted: medical_notes || null,
      allergies_encrypted: allergies || null,
      emergency_contact_encrypted: emergency_contact || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(
      'id,user_id,class_id,registration_time,start_date,barngildi,student_language,updated_at',
    )
    .single();

  if (studentError) {
    console.error('❌ Failed to update student:', studentError);
    return NextResponse.json(
      { error: `Failed to update student: ${studentError.message}` },
      { status: 500 },
    );
  }

  // Guardian-student relationship updates are handled via /api/guardian-students; skipping here

  console.log('✅ Student updated successfully:', student.id);

  return NextResponse.json(
    {
      student,
      message: 'Student updated successfully!',
    },
    { status: 200 },
  );
}

export async function handleDeleteStudent(
  request: Request,
  _user: AuthUser,
  adminClient: SupabaseClient,
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(deleteStudentQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  const { id } = queryValidation.data;

  // Soft delete student
  const { error } = await adminClient
    .from('students')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('❌ Failed to delete student:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('✅ Student deleted successfully:', id);

  return NextResponse.json(
    {
      message: 'Student deleted successfully!',
    },
    { status: 200 },
  );
}

