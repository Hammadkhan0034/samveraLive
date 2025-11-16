import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { z } from 'zod'
import { validateBody, userIdSchema } from '@/lib/validation'

// POST body schema
const acceptInvitationBodySchema = z.object({
  token: z.string().min(1, { message: 'Token is required' }),
  user_id: userIdSchema,
});

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    
    const body = await request.json()
    const bodyValidation = validateBody(acceptInvitationBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { token, user_id } = bodyValidation.data

    // Get invitation details
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('invitations')
      .select('id,email,phone,role_id,expires_at,accepted_at,deleted_at,created_by')
      .eq('token', token)
      .is('deleted_at', null)
      .single()

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 })
    }

    // Check if invitation is expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
    }

    // Check if invitation is already accepted
    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'Invitation has already been accepted' }, { status: 400 })
    }

    // Get user details from auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(user_id)
    if (authError || !authUser.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update invitation as accepted
    const { error: acceptError } = await supabaseAdmin
      .from('invitations')
      .update({
        accepted_by: user_id,
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitation.id)

    if (acceptError) {
      return NextResponse.json({ error: `Failed to accept invitation: ${acceptError.message}` }, { status: 500 })
    }

    // Create or update user in public.users table
    const { data: publicUser, error: publicUserError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: user_id,
        email: invitation.email,
        phone: invitation.phone,
        full_name: authUser.user.user_metadata?.full_name || '',
        role_id: invitation.role_id,
        is_active: true,
        metadata: {
          role: 'staff', // Default role
          email_verified: true,
          invited_by: invitation.created_by,
          accepted_at: new Date().toISOString()
        }
      }, { onConflict: 'id' })
      .select('id,email,phone,full_name,org_id,role_id,is_active,metadata')
      .single()

    if (publicUserError) {
      return NextResponse.json({ error: `Failed to create user: ${publicUserError.message}` }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      user: {
        id: publicUser.id,
        email: publicUser.email,
        phone: publicUser.phone,
        name: publicUser.full_name,
        role: publicUser.metadata?.role || 'staff',
        org_id: publicUser.org_id,
        is_active: publicUser.is_active
      }
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
