import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { createSupabaseServer } from '@/lib/supabaseServer'

const STAFF_ROLE_ID = 20

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { token, user_id, org_id } = body

    if (!token || !user_id || !org_id) {
      return NextResponse.json(
        { error: 'token, user_id, and org_id are required' },
        { status: 400 }
      )
    }

    // Get the current authenticated user
    const supabase = createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Find the invitation
    const { data: invitation, error: invError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .is('deleted_at', null)
      .single()

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Check if already accepted
    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 })
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
    }

    // Check if the logged-in user email matches the invitation email
    if (user.email?.toLowerCase() !== invitation.email?.toLowerCase()) {
      return NextResponse.json({ 
        error: 'Your email does not match the invitation email' 
      }, { status: 403 })
    }

    // Create/update user in public.users table with org_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Teacher',
        role_id: STAFF_ROLE_ID,
        org_id: org_id, // Inherit org_id from principal
        is_active: true
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (userError) {
      console.error('Failed to create/update user:', userError)
      return NextResponse.json(
        { error: `Failed to create user account: ${userError.message}` },
        { status: 500 }
      )
    }

    // Update auth user metadata with role and org_id
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          roles: ['teacher'],
          activeRole: 'teacher',
          role: 'teacher',
          role_id: STAFF_ROLE_ID,
          org_id: org_id
        }
      }
    )

    if (metadataError) {
      console.error('Failed to update user metadata:', metadataError)
    }

    // Mark invitation as accepted
    console.log('📝 Marking invitation as accepted:', invitation.id, 'by user:', user.id);
    
    const { error: acceptError } = await supabaseAdmin
      .from('invitations')
      .update({
        accepted_by: user.id,
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitation.id)

    if (acceptError) {
      console.error('❌ Failed to mark invitation as accepted:', acceptError)
    } else {
      console.log('✅ Invitation marked as accepted successfully');
    }

    console.log('🎉 Staff invitation accepted:', {
      user_id: user.id,
      email: user.email,
      org_id: org_id,
      role: 'teacher'
    });

    return NextResponse.json({
      success: true,
      user: userData,
      message: 'Invitation accepted successfully'
    })

  } catch (err: any) {
    console.error('Error accepting staff invitation:', err)
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
