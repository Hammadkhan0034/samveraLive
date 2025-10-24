import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId') || undefined
    const limit = Number(searchParams.get('limit') || '10')

    let query = supabaseAdmin
      .from('announcements')
      .select('id,title,body,created_at,author_id,class_id')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (classId) {
      query = query.or(`class_id.is.null,class_id.eq.${classId}`)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ announcements: data || [] }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}


