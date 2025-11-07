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
    const studentId = searchParams.get('studentId')
    const date = searchParams.get('date') // Format: YYYY-MM-DD
    
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    // Build query based on filters
    let query = supabaseAdmin
      .from('attendance')
      .select(`
        id,
        org_id,
        class_id,
        student_id,
        date,
        status,
        notes,
        recorded_by,
        created_at,
        updated_at,
        students!attendance_student_id_fkey (
          id,
          user_id,
          users!students_user_id_fkey (
            id,
            first_name,
            last_name
          ),
          classes!students_class_id_fkey (
            id,
            name
          )
        )
      `)
      .eq('org_id', orgId)
      .order('date', { ascending: false })

    // Filter by class if provided
    if (classId) {
      query = query.eq('class_id', classId)
    }

    // Filter by student if provided
    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    // Filter by date if provided
    if (date) {
      query = query.eq('date', date)
    }

    const { data: attendance, error } = await query

    if (error) {
      console.error('❌ Error fetching attendance:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      attendance: attendance || [],
      total: attendance?.length || 0
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in attendance GET:', err)
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
      org_id,
      class_id,
      student_id,
      date,
      status = 'present',
      notes,
      recorded_by
    } = body || {}
    
    // Validate required fields
    if (!org_id || !student_id || !date) {
      return NextResponse.json({ 
        error: 'Missing required fields: org_id, student_id, date' 
      }, { status: 400 })
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json({ 
        error: 'Invalid date format. Expected YYYY-MM-DD' 
      }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['present', 'absent', 'late', 'excused']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      }, { status: 400 })
    }

    console.log('📋 Creating attendance record:', { org_id, class_id, student_id, date, status, recorded_by })

    // Use upsert to handle UNIQUE constraint (student_id, date)
    // If record exists for this student and date, update it; otherwise create new
    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .upsert({
        org_id,
        class_id: class_id || null,
        student_id,
        date,
        status,
        notes: notes || null,
        recorded_by: recorded_by || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'student_id,date',
        ignoreDuplicates: false
      })
      .select('id,org_id,class_id,student_id,date,status,notes,recorded_by,created_at,updated_at')
      .single()

    if (attendanceError) {
      console.error('❌ Failed to create/update attendance:', attendanceError)
      return NextResponse.json({ 
        error: `Failed to save attendance: ${attendanceError.message}` 
      }, { status: 500 })
    }

    console.log('✅ Attendance record saved successfully:', attendance.id)

    return NextResponse.json({ 
      attendance,
      message: 'Attendance saved successfully!'
    }, { status: 201 })

  } catch (err: any) {
    console.error('❌ Error in attendance POST:', err)
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
      status,
      notes,
      recorded_by
    } = body || {}
    
    if (!id) {
      return NextResponse.json({ 
        error: 'Missing required field: id' 
      }, { status: 400 })
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['present', 'absent', 'late', 'excused']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ 
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        }, { status: 400 })
      }
    }

    console.log('📋 Updating attendance record:', { id, status, notes })

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (status !== undefined) {
      updateData.status = status
    }
    if (notes !== undefined) {
      updateData.notes = notes
    }
    if (recorded_by !== undefined) {
      updateData.recorded_by = recorded_by
    }

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .update(updateData)
      .eq('id', id)
      .select('id,org_id,class_id,student_id,date,status,notes,recorded_by,created_at,updated_at')
      .single()

    if (attendanceError) {
      console.error('❌ Failed to update attendance:', attendanceError)
      return NextResponse.json({ 
        error: `Failed to update attendance: ${attendanceError.message}` 
      }, { status: 500 })
    }

    console.log('✅ Attendance record updated successfully:', attendance.id)

    return NextResponse.json({ 
      attendance,
      message: 'Attendance updated successfully!'
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in attendance PUT:', err)
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

    const { error } = await supabaseAdmin
      .from('attendance')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ Failed to delete attendance:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Attendance record deleted successfully:', id)

    return NextResponse.json({ 
      message: 'Attendance deleted successfully!'
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in attendance DELETE:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

