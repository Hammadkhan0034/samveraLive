import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getUserDataCacheHeaders } from '@/lib/cacheConfig'
import { z } from 'zod'
import { validateQuery, orgIdSchema, uuidSchema } from '@/lib/validation'

// GET query parameter schema
const searchTeachersQuerySchema = z.object({
  q: z.string().optional().default(''),
  orgId: orgIdSchema,
  mode: z.enum(['email', 'name', 'any']).optional().default('any'),
  limit: z.string().transform((val) => Math.min(parseInt(val) || 10, 25)).optional().default('10'),
  excludeIds: z.string().transform((val) => val ? val.split(',').filter(Boolean) : []).optional().default(''),
}).refine((data) => {
  // Validate that excludeIds are valid UUIDs if provided
  if (data.excludeIds && data.excludeIds.length > 0) {
    return data.excludeIds.every(id => {
      try {
        uuidSchema.parse(id);
        return true;
      } catch {
        return false;
      }
    });
  }
  return true;
}, { message: 'excludeIds must contain valid UUIDs' });

// GET /api/search-teachers?q=...&orgId=...&mode=email|name|any&limit=10&excludeIds=...
export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(searchTeachersQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { q, orgId, mode, limit, excludeIds } = queryValidation.data

    if (!q) {
      return NextResponse.json({ results: [], count: 0 }, { status: 200 })
    }

    // Query teachers: users with role='teacher' joined with staff table
    // First get all staff user_ids for this org
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('user_id')
      .eq('org_id', orgId)
      .is('deleted_at', null)

    if (staffError) {
      console.error('❌ Error fetching staff:', staffError)
      return NextResponse.json({ error: staffError.message || 'Failed to fetch staff' }, { status: 500 })
    }

    let teacherUserIds = (staffData || []).map((s: any) => s.user_id).filter(Boolean)
    
    // Apply exclude IDs if provided (already validated as UUIDs)
    if (excludeIds && excludeIds.length > 0) {
      teacherUserIds = teacherUserIds.filter((id: string) => !excludeIds.includes(id))
    }
    
    if (teacherUserIds.length === 0) {
      return NextResponse.json({ results: [], count: 0 }, { status: 200 })
    }

    // Now query users who are in the teacher list and match search criteria
    let teachersQuery = supabaseAdmin
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('org_id', orgId)
      .eq('role', 'teacher')
      .in('id', teacherUserIds)
      .is('deleted_at', null)
      .limit(limit)

    // Apply search filters based on mode
    if (mode === 'email') {
      teachersQuery = teachersQuery.ilike('email', `%${q}%`)
    } else if (mode === 'name') {
      teachersQuery = teachersQuery.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    } else {
      teachersQuery = teachersQuery.or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    }

    const { data: teachersData, error } = await teachersQuery

    if (error) {
      console.error('❌ Error searching teachers:', error)
      return NextResponse.json({ error: error.message || 'Failed to search teachers' }, { status: 500 })
    }

    // Transform the data to match expected format
    const results = (teachersData || []).map((teacher: any) => ({
      id: teacher.id,
      email: teacher.email || '',
      first_name: teacher.first_name || '',
      last_name: teacher.last_name || '',
      full_name: `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email || 'Unknown',
    }))

    return NextResponse.json({ results, count: results.length }, { 
      status: 200,
      headers: getUserDataCacheHeaders()
    })
  } catch (err: any) {
    console.error('❌ Error in search-teachers API:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

