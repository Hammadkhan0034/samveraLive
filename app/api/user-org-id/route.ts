import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getUserDataCacheHeaders } from '@/lib/cacheConfig'
import { requireServerAuth } from '@/lib/supabaseServer'
import { getCurrentUserOrgId, MissingOrgIdError } from '@/lib/server-helpers'

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    // Use the universal helper which checks metadata first, then database
    const orgId = await getCurrentUserOrgId();

    return NextResponse.json({ 
      org_id: orgId
    }, { 
      status: 200,
      headers: getUserDataCacheHeaders()
    })

  } catch (err: any) {
    // Handle MissingOrgIdError specifically
    if (err instanceof MissingOrgIdError) {
      return NextResponse.json({ 
        error: 'Organization ID not found',
        code: 'MISSING_ORG_ID'
      }, { status: 401 })
    }
    
    console.error('❌ Error in user-org-id GET:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
