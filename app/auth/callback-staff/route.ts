import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const token = requestUrl.searchParams.get('token')
  const org_id = requestUrl.searchParams.get('org_id')
  const user_id = requestUrl.searchParams.get('user_id')
  const code = requestUrl.searchParams.get('code')

  console.log('🔗 Magic link callback received:', { token, org_id, user_id, hasCode: !!code })

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Exchange code for session
    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code)
    console.log('✅ Session established from magic link')
    
    // Redirect to accept-staff page which will handle invitation acceptance with the authenticated session
    if (token && org_id) {
      return NextResponse.redirect(`${requestUrl.origin}/invite/accept-staff?token=${token}&org_id=${org_id}`)
    }
  }

  // Fallback: redirect to signin if no token
  console.log('🔄 Redirecting to signin...')
  return NextResponse.redirect(`${requestUrl.origin}/signin`)
}

