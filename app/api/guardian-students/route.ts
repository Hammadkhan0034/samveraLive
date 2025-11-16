import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getUserDataCacheHeaders } from '@/lib/cacheConfig'
import { z } from 'zod'
import { validateQuery, validateBody, studentIdSchema, userIdSchema, uuidSchema } from '@/lib/validation'

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    // GET query parameter schema
    const getGuardianStudentsQuerySchema = z.object({
      studentId: studentIdSchema.optional(),
      guardianId: userIdSchema.optional(),
    });
    
    const queryValidation = validateQuery(getGuardianStudentsQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { studentId, guardianId } = queryValidation.data
    
    // Simplified query - just get the relationships without user join
    // The join can fail if the foreign key doesn't exist or if full_name column doesn't exist
    let query = supabaseAdmin
      .from('guardian_students')
      .select(`
        id,
        guardian_id,
        student_id,
        relation,
        created_at
      `)

    if (studentId) {
      query = query.eq('student_id', studentId)
    }
    
    if (guardianId) {
      query = query.eq('guardian_id', guardianId)
    }

    const { data: relationships, error } = await query

    if (error) {
      console.error('❌ Error fetching guardian-student relationships:', error)
      console.error('❌ Query details:', { studentId, guardianId })
      console.error('❌ Full error:', JSON.stringify(error, null, 2))
      return NextResponse.json({ 
        error: error.message || 'Failed to fetch guardian-student relationships',
        details: error.details || null
      }, { status: 500 })
    }

    return NextResponse.json({ 
      relationships: relationships || [],
      total_relationships: relationships?.length || 0
    }, { 
      status: 200,
      headers: getUserDataCacheHeaders()
    })

  } catch (err: any) {
    console.error('❌ Error in guardian-students GET:', err)
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
    // POST body schema
    const postGuardianStudentBodySchema = z.object({
      guardian_id: userIdSchema,
      student_id: studentIdSchema,
      relation: z.enum(['parent', 'guardian', 'other']).default('parent'),
    });
    
    const bodyValidation = validateBody(postGuardianStudentBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { guardian_id, student_id, relation } = bodyValidation.data
    
    // Fetch org_id from student row
    const { data: studentRow, error: studentErr } = await supabaseAdmin
      .from('students')
      .select('org_id')
      .eq('id', student_id)
      .maybeSingle()

    if (studentErr || !studentRow?.org_id) {
      console.error('❌ Could not resolve org_id for student', studentErr)
      return NextResponse.json({ error: 'Could not resolve org for student' }, { status: 400 })
    }

    // Insert relationship with org_id, ignore duplicates
    const { data: upserted, error } = await supabaseAdmin
      .from('guardian_students')
      .insert({
        guardian_id,
        student_id,
        relation,
        org_id: studentRow.org_id,
      })
      .select('id,guardian_id,student_id,relation,created_at')
      .single()

    if (error) {
      console.error('❌ Failed to create guardian-student relationship:', error)
      return NextResponse.json({ error: `Failed to create relationship: ${error.message}` }, { status: 500 })
    }

    const relationship = upserted

    return NextResponse.json({ 
      relationship,
      message: 'Guardian-student relationship created successfully!'
    }, { status: 201 })

  } catch (err: any) {
    console.error('❌ Error in guardian-students POST:', err)
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
    // DELETE query parameter schema
    const deleteGuardianStudentQuerySchema = z.object({
      id: uuidSchema.optional(),
      guardianId: userIdSchema.optional(),
      studentId: studentIdSchema.optional(),
    }).refine((data) => data.id || (data.guardianId && data.studentId), {
      message: 'id or (guardianId and studentId) is required',
    });
    
    const queryValidation = validateQuery(deleteGuardianStudentQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { id, guardianId, studentId } = queryValidation.data

    let deleteQuery = supabaseAdmin
      .from('guardian_students')
      .delete()

    if (id) {
      deleteQuery = deleteQuery.eq('id', id)
    } else {
      deleteQuery = deleteQuery.eq('guardian_id', guardianId).eq('student_id', studentId)
    }

    const { error } = await deleteQuery

    if (error) {
      console.error('❌ Failed to delete guardian-student relationship:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Guardian-student relationship deleted successfully!'
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in guardian-students DELETE:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
