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
    await supabase.auth.exchangeCodeForSession(code)
    console.log('✅ Session established from magic link')
  }

  // Mark invitation as accepted
  if (token && org_id && user_id && supabaseAdmin) {
    console.log('📝 Marking invitation as accepted...')
    
    const { error: acceptError } = await supabaseAdmin
      .from('invitations')
      .update({
        accepted_by: user_id,
        accepted_at: new Date().toISOString()
      })
      .eq('token', token)

    if (acceptError) {
      console.error('❌ Failed to mark invitation as accepted:', acceptError)
    } else {
      console.log('✅ Invitation marked as accepted:', { user_id, token })
    }
  }

  // Redirect to signin page
  console.log('🔄 Redirecting to signin page...')
  return NextResponse.redirect(`${requestUrl.origin}/signin?message=invitation_accepted`)
}

