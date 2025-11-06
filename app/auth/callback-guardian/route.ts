import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const token = requestUrl.searchParams.get('token')
  const org_id = requestUrl.searchParams.get('org_id')
  const student_id = requestUrl.searchParams.get('student_id')
  const guardian_id = requestUrl.searchParams.get('guardian_id')
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (sessionError) {
      console.error('❌ Error exchanging code for session:', sessionError)
      return NextResponse.redirect(`${requestUrl.origin}/signin?error=session_error`)
    }

    // If guardian_id is provided, set default password and redirect to signin
    if (guardian_id && sessionData?.user) {
      try {
        if (!supabaseAdmin) {
          console.error('❌ supabaseAdmin is not available')
          return NextResponse.redirect(`${requestUrl.origin}/signin?error=admin_unavailable`)
        }
        // Set default password for the guardian
        const defaultPassword = 'test123456'
        await supabaseAdmin.auth.admin.updateUserById(sessionData.user.id, {
          password: defaultPassword,
          user_metadata: {
            roles: ['parent'],
            activeRole: 'parent',
            org_id: org_id || undefined,
            default_password_set: true,
          }
        })
        console.log('✅ Default password set for guardian:', guardian_id)
      } catch (updateError) {
        console.error('❌ Error setting default password:', updateError)
      }
      
      // Redirect to signin page with email pre-filled
      const email = sessionData.user.email
      return NextResponse.redirect(`${requestUrl.origin}/signin?email=${encodeURIComponent(email || '')}&password=test123456&role=parent`)
    }

    // Legacy invitation flow
    if (token && org_id) {
      const acceptUrl = `${requestUrl.origin}/invite/accept-guardian?token=${token}&org_id=${org_id}${student_id ? `&student_id=${student_id}` : ''}`
      return NextResponse.redirect(acceptUrl)
    }
  }
  
  return NextResponse.redirect(`${requestUrl.origin}/signin`)
}


