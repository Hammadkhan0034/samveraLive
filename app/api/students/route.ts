import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const classId = searchParams.get('classId')
    
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

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
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in students GET:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()



    const { 
      first_name, 
      last_name, 
      dob, 
      gender, 
      class_id, 
      registration_time,
      start_date,
      barngildi,
      student_language,
      medical_notes, 
      allergies, 
      emergency_contact,
      org_id,
      phone,
      address,
      social_security_number,
      guardian_ids = [] // Array of guardian IDs to link
    } = body || {}
    const normalizedLanguage =
    student_language === 'english' ? 'english' :
    student_language === 'icelandic' ? 'icelandic' :
    student_language === 'en' ? 'english' :
    student_language === 'is' ? 'icelandic' :
      'english'
    
    if (!first_name) {
      return NextResponse.json({ 
        error: 'Missing required fields: first_name' 
      }, { status: 400 })
    }
    
    console.log('📋 Creating student:', { first_name, last_name, class_id, registration_time, student_language:normalizedLanguage, guardian_ids,barngildi });


    

    // Validate date of birth if provided
    let validatedDob = null;
    if (dob) {
      // Ensure the date is in ISO format (YYYY-MM-DD)
      const birthDate = new Date(dob);
      
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
      
      // Convert to ISO format for database storage
      validatedDob = birthDate.toISOString().split('T')[0];
    }

    // Validate start_date if provided
    let validatedStartDate = null;
    if (start_date) {
      const startDate = new Date(start_date);
      
      // Check if the date is valid
      if (isNaN(startDate.getTime())) {
        return NextResponse.json({ 
          error: 'Invalid date format for start date' 
        }, { status: 400 })
      }
      
      // Convert to ISO format for database storage
      validatedStartDate = startDate.toISOString().split('T')[0];
    }

    // Normalize gender and barngildi
    const normalizedGender = (gender || 'unknown').toString().toLowerCase();
    const normalizedBarngildi = (() => {
      const n = Number(barngildi);
      if (isNaN(n)) return 0;
      return Math.min(1.9, Math.max(0.5, Number(n.toFixed(1))));
    })();

    // First create a user record for the student
    const { data: createdUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        first_name,
        last_name: last_name || null,
        dob: validatedDob,
        gender: normalizedGender,
        phone: phone || null,
        address: address || null,
        ssn: social_security_number || null,
        role: 'student' as any,
        org_id: org_id || null,
        is_active: true,
      })
      .select('id')
      .single()

    if (userError) {
      console.error('❌ Failed to create student user:', userError)
      return NextResponse.json({ error: `Failed to create student user: ${userError.message}` }, { status: 500 })
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
        barngildi: normalizedBarngildi,
        student_language: normalizedLanguage,
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

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { 
      id,
      first_name, 
      last_name, 
      dob, 
      gender, 
      class_id, 
      registration_time,
      start_date,
      barngildi,
      student_language,
      medical_notes, 
      allergies, 
      emergency_contact,
      org_id,
      phone,
      address,
      social_security_number,
      guardian_ids = []
    } = body || {}
    const normalizedLanguage =
    student_language === 'english' ? 'english' :
    student_language === 'icelandic' ? 'icelandic' :
    student_language === 'en' ? 'english' :
    student_language === 'is' ? 'icelandic' :
      'english'
    
    if (!id || !first_name) {
      return NextResponse.json({ 
        error: 'Missing required fields: id, first_name' 
      }, { status: 400 })
    }
    
    console.log('📋 Updating student:', { id, first_name, last_name, class_id, registration_time, student_language: normalizedLanguage, guardian_ids,barngildi });

    // Validate date of birth if provided
    let validatedDob = null;
    if (dob) {
      // Ensure the date is in ISO format (YYYY-MM-DD)
      const birthDate = new Date(dob);
      
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
      
      // Convert to ISO format for database storage
      validatedDob = birthDate.toISOString().split('T')[0];
    }

    // Validate start_date if provided
    let validatedStartDate = null;
    if (start_date) {
      const startDate = new Date(start_date);
      
      // Check if the date is valid
      if (isNaN(startDate.getTime())) {
        return NextResponse.json({ 
          error: 'Invalid date format for start date' 
        }, { status: 400 })
      }
      
      // Convert to ISO format for database storage
      validatedStartDate = startDate.toISOString().split('T')[0];
    }

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

    // Normalize gender and barngildi
    const normalizedGender = (gender || 'unknown').toString().toLowerCase();
    const normalizedBarngildi = (() => {
      const n = Number(barngildi);
      if (isNaN(n)) return 0;
      return Math.min(1.9, Math.max(0.5, Number(n.toFixed(1))));
    })();

    // Update user record if available
    if (userIdForUpdate) {
      const { error: userUpdErr } = await supabaseAdmin
        .from('users')
        .update({
          first_name,
          last_name: last_name || null,
          dob: validatedDob,
          gender: normalizedGender,
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
        barngildi: normalizedBarngildi,
        student_language: normalizedLanguage,
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

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

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
