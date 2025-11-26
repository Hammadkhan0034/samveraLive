import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getNoCacheHeaders } from '@/lib/cacheConfig'
import { z } from 'zod'
import {
  validateQuery,
  validateBody,
  classIdSchema,
  studentIdSchema,
  dateSchema,
  attendanceStatusSchema,
  notesSchema,
  uuidSchema,
} from '@/lib/validation'
import { getAuthUserWithOrg, mapAuthErrorToResponse } from '@/lib/server-helpers'

// GET query parameter schema
const getAttendanceQuerySchema = z.object({
  classId: classIdSchema.optional(),
  studentId: studentIdSchema.optional(),
  date: dateSchema.optional(),
});

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    // Authenticate user and derive orgId from server-side context
    let orgId: string
    try {
      const { orgId: resolvedOrgId } = await getAuthUserWithOrg()
      orgId = resolvedOrgId
    } catch (err) {
      return mapAuthErrorToResponse(err)
    }

    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(getAttendanceQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { classId, studentId, date } = queryValidation.data

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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      attendance: attendance || [],
      total: attendance?.length || 0
    }, {
      status: 200,
      headers: getNoCacheHeaders()
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }

    // Authenticate user and derive orgId from server-side context
    let orgId: string
    let userId: string
    try {
      const { user, orgId: resolvedOrgId } = await getAuthUserWithOrg()
      userId = user.id
      orgId = resolvedOrgId
    } catch (err) {
      return mapAuthErrorToResponse(err)
    }

    const body = await request.json()
    // POST body schema
    const postAttendanceBodySchema = z.object({
      class_id: classIdSchema.optional(),
      student_id: studentIdSchema,
      date: dateSchema,
      status: attendanceStatusSchema.default('present'),
      notes: notesSchema,
    });
    
    const bodyValidation = validateBody(postAttendanceBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { class_id, student_id, date, status, notes } = bodyValidation.data


    // Use upsert to handle UNIQUE constraint (student_id, date)
    // If record exists for this student and date, update it; otherwise create new
    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .upsert(
        {
          org_id: orgId,
          class_id: class_id || null,
          student_id,
          date,
          status,
          notes: notes || null,
          recorded_by: userId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'student_id,date',
          ignoreDuplicates: false,
        }
      )
      .select(
        'id,org_id,class_id,student_id,date,status,notes,recorded_by,created_at,updated_at'
      )
      .single()

    if (attendanceError) {
      return NextResponse.json({ 
        error: `Failed to save attendance: ${attendanceError.message}` 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      attendance,
      message: 'Attendance saved successfully!'
    }, { status: 201 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }

    // Authenticate user (used to ensure only authenticated users can update attendance)
    let userId: string
    try {
      const { user } = await getAuthUserWithOrg()
      userId = user.id
    } catch (err) {
      return mapAuthErrorToResponse(err)
    }

    const body = await request.json()
    // PUT body schema
    const putAttendanceBodySchema = z.object({
      id: uuidSchema,
      status: attendanceStatusSchema.optional(),
      notes: notesSchema,
    });
    
    const bodyValidation = validateBody(putAttendanceBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { id, status, notes } = bodyValidation.data


    const updateData: any = {
      updated_at: new Date().toISOString(),
      recorded_by: userId,
    }

    if (status !== undefined) {
      updateData.status = status
    }
    if (notes !== undefined) {
      updateData.notes = notes
    }

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .update(updateData)
      .eq('id', id)
      .select('id,org_id,class_id,student_id,date,status,notes,recorded_by,created_at,updated_at')
      .single()

    if (attendanceError) {
      return NextResponse.json({ 
        error: `Failed to update attendance: ${attendanceError.message}` 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      attendance,
      message: 'Attendance updated successfully!'
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }

    // Authenticate user and derive orgId to scope deletion
    let orgId: string
    try {
      const { orgId: resolvedOrgId } = await getAuthUserWithOrg()
      orgId = resolvedOrgId
    } catch (err) {
      return mapAuthErrorToResponse(err)
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
      .eq('org_id', orgId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Attendance deleted successfully!'
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

