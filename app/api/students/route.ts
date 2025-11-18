import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getUserDataCacheHeaders } from '@/lib/cacheConfig'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { validateQuery, validateBody, orgIdSchema, classIdSchema, studentIdSchema, firstNameSchema, lastNameSchema, studentDobSchema, genderSchema, studentLanguageSchema, barngildiSchema, phoneSchema, addressSchema, ssnSchema, medicalNotesSchema, allergiesSchema, emergencyContactSchema, guardianIdsSchema, dateSchema } from '@/lib/validation'

// GET query parameter schema
const getStudentsQuerySchema = z.object({
  orgId: orgIdSchema,
  classId: classIdSchema.optional(),
});

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }

    // Authenticate and check role
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Ignore cookie setting errors in route handlers
            }
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user has principal, admin, or teacher role
    const userRoles = user.user_metadata?.roles || [];
    const hasAccess = userRoles.some((role: string) => ['principal', 'admin', 'teacher'].includes(role));
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied. Principal, admin, or teacher role required.' 
      }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(getStudentsQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { orgId, classId } = queryValidation.data

    // Build query based on filters
    let query = supabaseAdmin
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
      .order('created_at', { ascending: false })

    // Filter by class if provided
    if (classId) {
      query = query.eq('class_id', classId)
    }

    const { data: students, error } = await query

    if (error) {
      console.error('❌ Error fetching students:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch guardian relationships for each student
    const studentsWithGuardians = await Promise.all(
      (students || []).map(async (student) => {
        if (!supabaseAdmin) {
          return {
            ...student,
            guardians: []
          }
        }
        
        const { data: guardianRelations, error: guardianError } = await supabaseAdmin
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
          .eq('student_id', student.id)
        
        if (guardianError) {
          console.error(`❌ Error fetching guardians for student ${student.id}:`, guardianError);
        }
        
        // Log guardian data for debugging
        if (guardianRelations && guardianRelations.length > 0) {
          console.log(`✅ Found ${guardianRelations.length} guardian(s) for student ${student.id}:`, guardianRelations);
        }

        return {
          ...student,
          guardians: guardianRelations || []
        }
      })
    )
    
    return NextResponse.json({ 
      students: studentsWithGuardians || [],
      total_students: studentsWithGuardians?.length || 0
    }, {
      status: 200,
      headers: getUserDataCacheHeaders()
    })

  } catch (err: any) {
    console.error('❌ Error in students GET:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

// POST body schema
const postStudentBodySchema = z.object({
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
  org_id: orgIdSchema.optional(),
  phone: phoneSchema,
  address: addressSchema,
  social_security_number: ssnSchema,
  guardian_ids: guardianIdsSchema.optional().default([]),
}).transform((data) => {
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

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }

    // Validate Supabase URL is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not configured')
      return NextResponse.json({ 
        error: 'Supabase URL is not configured. Please check your environment variables.' 
      }, { status: 500 })
    }

    // Validate URL format
    try {
      new URL(supabaseUrl);
    } catch (urlError) {
      console.error('❌ Invalid Supabase URL format:', supabaseUrl)
      return NextResponse.json({ 
        error: `Invalid Supabase URL format: ${supabaseUrl}` 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const bodyValidation = validateBody(postStudentBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
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
      org_id,
      phone,
      address,
      social_security_number,
      guardian_ids
    } = bodyValidation.data
    
    if (!first_name) {
      return NextResponse.json({ 
        error: 'Missing required fields: first_name' 
      }, { status: 400 })
    }
    
    // Validate age if date of birth is provided
    if (validatedDob) {
      const birthDate = new Date(validatedDob);
      
      // Check if the date is valid
      if (isNaN(birthDate.getTime())) {
        return NextResponse.json({ 
          error: 'Invalid date format for date of birth' 
        }, { status: 400 })
      }
      
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      // Calculate actual age
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
        ? age - 1 
        : age;
      
      // Check if age is within valid range (0-18 years)
      if (actualAge < 0 || actualAge > 18) {
        return NextResponse.json({ 
          error: 'Student age must be between 0 and 18 years old' 
        }, { status: 400 })
      }
    }
    
    console.log('📋 Creating student:', { first_name, last_name, class_id, registration_time, student_language: normalizedLanguage, guardian_ids, barngildi: normalizedBarngildi });

    // First create a user record for the student
    let createdUser, userError;
    try {
      const result = await supabaseAdmin
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
          org_id: org_id || null,
          is_active: true,
        })
        .select('id')
        .single()
      
      createdUser = result.data;
      userError = result.error;
    } catch (networkError: any) {
      console.error('❌ Network error creating student user:', networkError);
      console.error('❌ Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.error('❌ Error details:', {
        message: networkError?.message,
        cause: networkError?.cause,
        stack: networkError?.stack
      });
      return NextResponse.json({ 
        error: `Network error: Failed to connect to Supabase. Please check your connection and Supabase configuration.`,
        details: networkError?.message || 'Unknown network error'
      }, { status: 500 })
    }

    if (userError) {
      console.error('❌ Failed to create student user:', userError)
      console.error('❌ Error details:', {
        message: userError.message,
        details: userError.details,
        hint: userError.hint,
        code: userError.code
      })
      return NextResponse.json({ 
        error: `Failed to create student user: ${userError.message}`,
        details: userError.details || '',
        hint: userError.hint || ''
      }, { status: 500 })
    }

    const userId = createdUser?.id

    // Create student record
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        user_id: userId,
        class_id: class_id || null,
        org_id: org_id || null,
        registration_time: registration_time || null,
        start_date: validatedStartDate,
        barngildi: normalizedBarngildi || 0.5,
        student_language: normalizedLanguage || 'english',
        medical_notes_encrypted: medical_notes || null,
        allergies_encrypted: allergies || null,
        emergency_contact_encrypted: emergency_contact || null,
      })
      .select('id,user_id,class_id,registration_time,start_date,barngildi,student_language,created_at')
      .single()

    if (studentError) {
      console.error('❌ Failed to create student:', studentError)
      return NextResponse.json({ error: `Failed to create student: ${studentError.message}` }, { status: 500 })
    }

    // Linking guardians to student via API has been deprecated; handled by /api/guardian-students
    // Intentionally no-op here

    // // Update student metadata with guardian information
    // if (linkedGuardians.length > 0) {
    //   const { error: metadataError } = await supabaseAdmin
    //     .from('students')
    //     .update({
    //       metadata: {
    //         guardian_ids: linkedGuardians,
    //         guardian_count: linkedGuardians.length,
    //         last_guardian_update: new Date().toISOString()
    //       }
    //     })
    //     .eq('id', student.id)

    //   if (metadataError) {
    //     console.error('❌ Failed to update student metadata:', metadataError)
    //   } else {
    //     console.log('✅ Updated student metadata with guardian info')
    //   }
    // }

    console.log('✅ Student created successfully:', student.id)

    return NextResponse.json({ 
      student,
      message: 'Student created successfully!'
    }, { status: 201 })

  } catch (err: any) {
    console.error('❌ Error in students POST:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

// PUT body schema
const putStudentBodySchema = z.object({
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
  org_id: orgIdSchema.optional(),
  phone: phoneSchema,
  address: addressSchema,
  social_security_number: ssnSchema,
  guardian_ids: guardianIdsSchema.optional().default([]),
}).transform((data) => {
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

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const bodyValidation = validateBody(putStudentBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
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
      org_id,
      phone,
      address,
      social_security_number,
      guardian_ids
    } = bodyValidation.data
    
    console.log('📋 Updating student:', { id, first_name, last_name, class_id, registration_time, student_language: normalizedLanguage, guardian_ids, barngildi: normalizedBarngildi });

    // Fetch student to get user_id for user updates
    const { data: existingStudent, error: fetchStudentErr } = await supabaseAdmin
      .from('students')
      .select('user_id')
      .eq('id', id)
      .single()

    if (fetchStudentErr) {
      console.error('❌ Failed to fetch student for update:', fetchStudentErr)
      return NextResponse.json({ error: 'Failed to load student for update' }, { status: 500 })
    }

    const userIdForUpdate = existingStudent?.user_id

    // Update user record if available
    if (userIdForUpdate) {
      const { error: userUpdErr } = await supabaseAdmin
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
        .eq('id', userIdForUpdate)

      if (userUpdErr) {
        console.error('❌ Failed to update student user:', userUpdErr)
      }
    }

    // Update student record (non-user fields)
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .update({
        class_id: class_id || null,
        org_id: org_id || null,
        registration_time: registration_time || null,
        start_date: validatedStartDate,
        barngildi: normalizedBarngildi || 0.5,
        student_language: normalizedLanguage || 'english',
        medical_notes_encrypted: medical_notes || null,
        allergies_encrypted: allergies || null,
        emergency_contact_encrypted: emergency_contact || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id,user_id,class_id,registration_time,start_date,barngildi,student_language,updated_at')
      .single()

    if (studentError) {
      console.error('❌ Failed to update student:', studentError)
      return NextResponse.json({ error: `Failed to update student: ${studentError.message}` }, { status: 500 })
    }

    // Guardian-student relationship updates are handled via /api/guardian-students; skipping here

    console.log('✅ Student updated successfully:', student.id)

    return NextResponse.json({ 
      student,
      message: 'Student updated successfully!'
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in students PUT:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

// DELETE query parameter schema
const deleteStudentQuerySchema = z.object({
  id: studentIdSchema,
});

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(deleteStudentQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { id } = queryValidation.data

    // Soft delete student
    const { error } = await supabaseAdmin
      .from('students')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('❌ Failed to delete student:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Student deleted successfully:', id)

    return NextResponse.json({ 
      message: 'Student deleted successfully!'
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in students DELETE:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
