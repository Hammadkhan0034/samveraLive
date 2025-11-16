import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getUserDataCacheHeaders } from '@/lib/cacheConfig'
import { z } from 'zod'
import { validateQuery, userIdSchema } from '@/lib/validation'

// GET query parameter schema
const getUserOrgIdQuerySchema = z.object({
  user_id: userIdSchema,
});

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(getUserOrgIdQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { user_id: userId } = queryValidation.data

    // Get user's org_id from the database
    const { data: userData, error } = await supabaseAdmin
      .from('users')
      .select('org_id')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('❌ Error fetching user org_id:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      org_id: userData.org_id
    }, { 
      status: 200,
      headers: getUserDataCacheHeaders()
    })

  } catch (err: any) {
    console.error('❌ Error in user-org-id GET:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
