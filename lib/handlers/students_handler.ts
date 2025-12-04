import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import { validateBody, validateQuery } from '@/lib/validation';
import {
  getStudentsQuerySchema,
  postStudentBodySchema,
  putStudentBodySchema,
  deleteStudentQuerySchema,
} from '@/lib/validation/students';
import type { AuthUser, UserMetadata, SamveraRole } from '@/lib/types/auth';

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

    // Check if age is within valid range (3-18 years)
    if (actualAge < 3 || actualAge > 18) {
      return NextResponse.json(
        { error: 'Student age must be between 3 and 18 years old' },
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

  // Process guardian_ids to create relationships
  const createdRelationships: any[] = [];
  if (guardian_ids && guardian_ids.length > 0) {
    const studentId = student.id;
    
    // Remove duplicates from guardian_ids array
    const uniqueGuardianIds = Array.from(new Set(guardian_ids.filter(id => id && id.trim() !== '')));
    
    for (const guardianId of uniqueGuardianIds) {
      try {
        // Verify guardian exists and belongs to same org_id
        const { data: guardian, error: guardianErr } = await adminClient
          .from('users')
          .select('id, org_id, role')
          .eq('id', guardianId)
          .eq('org_id', orgId)
          .eq('role', 'guardian')
          .maybeSingle();

        if (guardianErr || !guardian) {
          console.error(`❌ Guardian ${guardianId} not found or doesn't belong to org ${orgId}:`, guardianErr);
          continue; // Skip invalid guardians but continue with student creation
        }

        // Check if relationship already exists
        const { data: existingRel } = await adminClient
          .from('guardian_students')
          .select('id')
          .eq('guardian_id', guardianId)
          .eq('student_id', studentId)
          .maybeSingle();

        if (existingRel) {
          console.log(`⚠️ Relationship already exists for guardian ${guardianId} and student ${studentId}`);
          continue; // Skip if already exists
        }

        // Create relationship in guardian_students table
        const { data: relationship, error: relError } = await adminClient
          .from('guardian_students')
          .insert({
            guardian_id: guardianId,
            student_id: studentId,
            relation: 'parent',
            org_id: orgId,
          })
          .select('id,guardian_id,student_id,relation,created_at')
          .single();

        if (relError) {
          // Check if it's a duplicate (unique constraint violation)
          if (relError.code === '23505') {
            console.log(`⚠️ Relationship already exists for guardian ${guardianId} and student ${studentId}`);
          } else {
            console.error(`❌ Failed to create relationship for guardian ${guardianId}:`, relError);
          }
        } else if (relationship) {
          createdRelationships.push(relationship);
        }
      } catch (err) {
        console.error(`❌ Error processing guardian ${guardianId}:`, err);
        // Continue with other guardians even if one fails
      }
    }
  }

  console.log('✅ Student created successfully:', student.id);
  if (createdRelationships.length > 0) {
    console.log(`✅ Created ${createdRelationships.length} parent-student relationship(s)`);
  }

  return NextResponse.json(
    {
      student,
      relationships: createdRelationships,
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

  // Sync guardian-student relationships
  const updatedRelationships: any[] = [];
  if (guardian_ids !== undefined) {
    const studentId = student.id;
    
    try {
      // Fetch existing relationships for this student
      const { data: existingRelationships, error: fetchErr } = await adminClient
        .from('guardian_students')
        .select('id,guardian_id,student_id')
        .eq('student_id', studentId);

      if (fetchErr) {
        console.error('❌ Failed to fetch existing relationships:', fetchErr);
      } else {
        const existingGuardianIds = (existingRelationships || []).map((r: any) => r.guardian_id);
        // Remove duplicates from guardian_ids array
        const uniqueGuardianIds = Array.from(new Set((guardian_ids || []).filter(id => id && id.trim() !== '')));
        
        // Find relationships to remove (in existing but not in new)
        const toRemove = existingGuardianIds.filter((id: string) => !uniqueGuardianIds.includes(id));
        for (const guardianId of toRemove) {
          const { error: deleteErr } = await adminClient
            .from('guardian_students')
            .delete()
            .eq('student_id', studentId)
            .eq('guardian_id', guardianId);

          if (deleteErr) {
            console.error(`❌ Failed to remove relationship for guardian ${guardianId}:`, deleteErr);
          }
        }

        // Find relationships to add (in new but not in existing)
        const toAdd = uniqueGuardianIds.filter((id: string) => !existingGuardianIds.includes(id));
        for (const guardianId of toAdd) {
          try {
            // Verify guardian exists and belongs to same org_id
            const { data: guardian, error: guardianErr } = await adminClient
              .from('users')
              .select('id, org_id, role')
              .eq('id', guardianId)
              .eq('org_id', orgId)
              .eq('role', 'guardian')
              .maybeSingle();

            if (guardianErr || !guardian) {
              console.error(`❌ Guardian ${guardianId} not found or doesn't belong to org ${orgId}:`, guardianErr);
              continue;
            }

            // Check if relationship already exists (shouldn't happen due to filtering, but double-check)
            const { data: existingRel } = await adminClient
              .from('guardian_students')
              .select('id')
              .eq('guardian_id', guardianId)
              .eq('student_id', studentId)
              .maybeSingle();

            if (existingRel) {
              console.log(`⚠️ Relationship already exists for guardian ${guardianId} and student ${studentId}`);
              continue; // Skip if already exists
            }

            // Create relationship
            const { data: relationship, error: relError } = await adminClient
              .from('guardian_students')
              .insert({
                guardian_id: guardianId,
                student_id: studentId,
                relation: 'parent',
                org_id: orgId,
              })
              .select('id,guardian_id,student_id,relation,created_at')
              .single();

            if (relError) {
              // Check if it's a duplicate
              if (relError.code === '23505') {
                console.log(`⚠️ Relationship already exists for guardian ${guardianId} and student ${studentId}`);
              } else {
                console.error(`❌ Failed to create relationship for guardian ${guardianId}:`, relError);
              }
            } else if (relationship) {
              updatedRelationships.push(relationship);
            }
          } catch (err) {
            console.error(`❌ Error processing guardian ${guardianId}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('❌ Error syncing guardian relationships:', err);
      // Don't fail the entire update if relationship sync fails
    }
  }

  console.log('✅ Student updated successfully:', student.id);
  if (updatedRelationships.length > 0) {
    console.log(`✅ Updated ${updatedRelationships.length} parent-student relationship(s)`);
  }

  return NextResponse.json(
    {
      student,
      relationships: updatedRelationships,
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

