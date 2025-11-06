import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { guardian_id, email } = body || {}

    if (!guardian_id || !email) {
      return NextResponse.json({ error: 'Missing guardian_id or email' }, { status: 400 })
    }

    // Get guardian's org_id
    const { data: guardianData, error: guardianErr } = await supabaseAdmin
      .from('users')
      .select('org_id')
      .eq('id', guardian_id)
      .eq('role', 'guardian')
      .maybeSingle()

    if (guardianErr || !guardianData?.org_id) {
      return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })
    }

    const org_id = guardianData.org_id
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const callbackUrl = `${siteUrl}/auth/callback-guardian?org_id=${org_id}&guardian_id=${guardian_id}`

    // Send magic link via OTP
    const { error: magicLinkError } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
        data: {
          role: 'parent',
          org_id,
          guardian_id,
          default_password: 'test123456',
        }
      }
    })

    if (magicLinkError) {
      console.error('❌ Failed to send magic link:', magicLinkError)
      return NextResponse.json({ error: `Failed to send magic link: ${magicLinkError.message}` }, { status: 500 })
    }

    console.log('✅ Magic link sent to parent:', email)

    return NextResponse.json({
      message: 'Magic link sent successfully to parent email',
      email,
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in send-parent-magic-link:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

