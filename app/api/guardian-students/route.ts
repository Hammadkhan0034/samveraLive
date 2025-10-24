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
    const studentId = searchParams.get('studentId')
    const guardianId = searchParams.get('guardianId')
    
    let query = supabaseAdmin
      .from('guardian_students')
      .select(`
        id,
        guardian_id,
        student_id,
        relation,
        created_at,
        users!guardian_students_guardian_id_fkey (
          id,
          full_name,
          email
        ),
        students!guardian_students_student_id_fkey (
          id,
          first_name,
          last_name
        )
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      relationships: relationships || [],
      total_relationships: relationships?.length || 0
    }, { status: 200 })

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
    const { guardian_id, student_id, relation = 'parent' } = body || {}
    
    if (!guardian_id || !student_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: guardian_id, student_id' 
      }, { status: 400 })
    }
    
    console.log('📋 Creating guardian-student relationship:', { guardian_id, student_id, relation });

    const { data: relationship, error } = await supabaseAdmin
      .from('guardian_students')
      .insert({
        guardian_id,
        student_id,
        relation
      })
      .select('id,guardian_id,student_id,relation,created_at')
      .single()

    if (error) {
      console.error('❌ Failed to create guardian-student relationship:', error)
      return NextResponse.json({ error: `Failed to create relationship: ${error.message}` }, { status: 500 })
    }

    console.log('✅ Guardian-student relationship created successfully:', relationship.id)

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
    const id = searchParams.get('id')
    const guardianId = searchParams.get('guardianId')
    const studentId = searchParams.get('studentId')
    
    if (!id && !(guardianId && studentId)) {
      return NextResponse.json({ error: 'id or (guardianId and studentId) is required' }, { status: 400 })
    }

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

    console.log('✅ Guardian-student relationship deleted successfully')

    return NextResponse.json({ 
      message: 'Guardian-student relationship deleted successfully!'
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in guardian-students DELETE:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
