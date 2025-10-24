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
        first_name,
        last_name,
        dob,
        gender,
        medical_notes_encrypted,
        allergies_encrypted,
        emergency_contact_encrypted,
        metadata,
        created_at,
        updated_at,
        classes!students_class_id_fkey (
          id,
          name
        )
      `)
      .is('deleted_at', null)
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
        
        const { data: guardianRelations } = await supabaseAdmin
          .from('guardian_students')
          .select(`
            id,
            relation,
            users!guardian_students_guardian_id_fkey (
              id,
              full_name,
              email
            )
          `)
          .eq('student_id', student.id)

        return {
          ...student,
          guardians: guardianRelations || []
        }
      })
    )

    console.log(`📊 Students for org ${orgId}:`, {
      total_students: studentsWithGuardians?.length || 0,
      class_filter: classId || 'all'
    });

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
      medical_notes, 
      allergies, 
      emergency_contact,
      org_id,
      guardian_ids = [] // Array of guardian IDs to link
    } = body || {}
    
    if (!first_name) {
      return NextResponse.json({ 
        error: 'Missing required fields: first_name' 
      }, { status: 400 })
    }
    
    console.log('📋 Creating student:', { first_name, last_name, class_id, guardian_ids });


    

    // Validate date of birth if provided
    let validatedDob = null;
    if (dob) {
      const birthDate = new Date(dob);
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
      
      validatedDob = dob;
    }

    // Create student record
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        first_name,
        last_name,
        dob: validatedDob,
        gender: gender || 'unknown',
        class_id: class_id || null,
        org_id: org_id || null,
        medical_notes_encrypted: medical_notes || null,
        allergies_encrypted: allergies || null,
        emergency_contact_encrypted: emergency_contact || null,
        metadata: {}
      })
      .select('id,first_name,last_name,dob,gender,class_id,created_at')
      .single()

    if (studentError) {
      console.error('❌ Failed to create student:', studentError)
      return NextResponse.json({ error: `Failed to create student: ${studentError.message}` }, { status: 500 })
    }

    // Link guardians to student if provided
    let linkedGuardians = [];
    if (guardian_ids.length > 0) {
      const guardianStudentLinks = guardian_ids.map((guardian_id: string) => ({
        guardian_id,
        student_id: student.id,
        relation: 'parent' // Default relation
      }))

      const { error: linkError } = await supabaseAdmin
        .from('guardian_students')
        .insert(guardianStudentLinks)

      if (linkError) {
        console.error('❌ Failed to link guardians to student:', linkError)
        // Don't fail the whole request, just log the error
      } else {
        console.log('✅ Linked guardians to student:', guardian_ids)
        linkedGuardians = guardian_ids;
      }
    }

    // Update student metadata with guardian information
    if (linkedGuardians.length > 0) {
      const { error: metadataError } = await supabaseAdmin
        .from('students')
        .update({
          metadata: {
            guardian_ids: linkedGuardians,
            guardian_count: linkedGuardians.length,
            last_guardian_update: new Date().toISOString()
          }
        })
        .eq('id', student.id)

      if (metadataError) {
        console.error('❌ Failed to update student metadata:', metadataError)
      } else {
        console.log('✅ Updated student metadata with guardian info')
      }
    }

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
      medical_notes, 
      allergies, 
      emergency_contact,
      org_id,
      guardian_ids = []
    } = body || {}
    
    if (!id || !first_name) {
      return NextResponse.json({ 
        error: 'Missing required fields: id, first_name' 
      }, { status: 400 })
    }
    
    console.log('📋 Updating student:', { id, first_name, last_name, class_id, guardian_ids });

    // Validate date of birth if provided
    let validatedDob = null;
    if (dob) {
      const birthDate = new Date(dob);
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
      
      validatedDob = dob;
    }

    // Update student record
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .update({
        first_name,
        last_name,
        dob: validatedDob,
        gender: gender || 'unknown',
        class_id: class_id || null,
        org_id: org_id || null,
        medical_notes_encrypted: medical_notes || null,
        allergies_encrypted: allergies || null,
        emergency_contact_encrypted: emergency_contact || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id,first_name,last_name,dob,gender,class_id,updated_at')
      .single()

    if (studentError) {
      console.error('❌ Failed to update student:', studentError)
      return NextResponse.json({ error: `Failed to update student: ${studentError.message}` }, { status: 500 })
    }

    // Update guardian-student relationships if provided
    let linkedGuardians = [];
    if (guardian_ids.length >= 0) {
      // First, remove existing relationships
      const { error: deleteError } = await supabaseAdmin
        .from('guardian_students')
        .delete()
        .eq('student_id', id)

      if (deleteError) {
        console.error('❌ Failed to remove existing guardian relationships:', deleteError)
      }

      // Then, add new relationships if any
      if (guardian_ids.length > 0) {
        const guardianStudentLinks = guardian_ids.map((guardian_id: string) => ({
          guardian_id,
          student_id: id,
          relation: 'parent'
        }))

        const { error: linkError } = await supabaseAdmin
          .from('guardian_students')
          .insert(guardianStudentLinks)

        if (linkError) {
          console.error('❌ Failed to link guardians to student:', linkError)
        } else {
          console.log('✅ Updated guardian relationships for student:', guardian_ids)
          linkedGuardians = guardian_ids;
        }
      }

      // Update student metadata with guardian information
      const { error: metadataError } = await supabaseAdmin
        .from('students')
        .update({
          metadata: {
            guardian_ids: linkedGuardians,
            guardian_count: linkedGuardians.length,
            last_guardian_update: new Date().toISOString()
          }
        })
        .eq('id', id)

      if (metadataError) {
        console.error('❌ Failed to update student metadata:', metadataError)
      } else {
        console.log('✅ Updated student metadata with guardian info')
      }
    }

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
