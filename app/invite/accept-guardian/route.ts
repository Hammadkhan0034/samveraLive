import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { type UserMetadata } from '@/lib/types/auth'

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const org_id = searchParams.get('org_id')
    const student_id = searchParams.get('student_id')

    if (!token || !org_id) {
      return NextResponse.json({ error: 'token and org_id are required' }, { status: 400 })
    }

    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Validate invitation
    const { data: invitation, error: invError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .is('deleted_at', null)
      .single()

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 })
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
    }

    if (user.email?.toLowerCase() !== invitation.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Your email does not match the invitation email' }, { status: 403 })
    }

    // Get existing user data from database if available
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('first_name,last_name')
      .eq('id', user.id)
      .maybeSingle()

    // Upsert users row as guardian
    const { error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        first_name: existingUser?.first_name || null,
        last_name: existingUser?.last_name || null,
        role: 'guardian' as any,
        org_id,
        is_active: true,
      }, { onConflict: 'id' })

    if (upsertError) {
      return NextResponse.json({ error: `Failed to create guardian user: ${upsertError.message}` }, { status: 500 })
    }

    // Link guardian to student if provided
    if (student_id) {
      await supabaseAdmin
        .from('guardian_students')
        .insert({ guardian_id: user.id, student_id, relation: 'parent', org_id })
        .select('id')
        .maybeSingle()
    }

    // Mark invitation accepted
    await supabaseAdmin
      .from('invitations')
      .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    // Update auth metadata
    try {
      const userMetadata: UserMetadata = {
        roles: ['parent'],
        activeRole: 'parent',
        org_id: org_id!, // Already validated above
      };
      
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: userMetadata,
      })
    } catch {}

    // Redirect to signin with message
    const origin = new URL(request.url).origin
    return NextResponse.redirect(`${origin}/signin?message=invitation_accepted&role=parent`)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}


