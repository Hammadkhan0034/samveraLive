import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { z } from 'zod'
import { validateBody, userIdSchema, orgIdSchema } from '@/lib/validation'
import { type UserMetadata } from '@/lib/types/auth'

const STAFF_ROLE_ID = 20

// POST body schema
const acceptStaffInvitationBodySchema = z.object({
  token: z.string().min(1, { message: 'Token is required' }),
  user_id: userIdSchema,
  org_id: orgIdSchema,
  role: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const body = await request.json()
    const bodyValidation = validateBody(acceptStaffInvitationBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { token, user_id, org_id, role } = bodyValidation.data

    // Get the current authenticated user
    const supabase = await createSupabaseServer()
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

    // Get user from users table to get first_name/last_name if exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('first_name,last_name')
      .eq('id', user.id)
      .single()

    // Role is 'teacher' for staff members
    const userRole = 'teacher'

    // Create/update user in public.users table with org_id
    const userUpsertData: any = {
      id: user.id,
      email: user.email,
      first_name: existingUser?.first_name || user.email?.split('@')[0] || 'Teacher',
      last_name: existingUser?.last_name || null,
      org_id: org_id,
      is_active: true,
      role: userRole
    }
    
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .upsert(userUpsertData, { 
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
    const userMetadata: UserMetadata = {
      roles: ['teacher'],
      activeRole: 'teacher',
      org_id: org_id,
    };
    
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: userMetadata,
      }
    )

    if (metadataError) {
      console.error('Failed to update user metadata:', metadataError)
    }

    // Create staff record if it doesn't exist
    const { data: existingStaff } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .single()

    if (!existingStaff) {
      const { error: staffError } = await supabaseAdmin
        .from('staff')
        .insert({
          org_id: org_id,
          user_id: user.id,
          education_level: null,
          union_name: null
        })

      if (staffError) {
        console.error('❌ Failed to create staff record:', staffError)
      } else {
        console.log('✅ Staff record created successfully')
      }
    }

    // Mark invitation as accepted
    console.log('📝 Marking invitation as accepted:', invitation.id, 'by user:', user.id);
    
    const updateData: any = {
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
      role: 'teacher' // invitations.role should be 'teacher'
    }
    
    const { data: updatedInvitation, error: acceptError } = await supabaseAdmin
      .from('invitations')
      .update(updateData)
      .eq('id', invitation.id)
      .select('id,accepted_by,accepted_at')
      .single()

    if (acceptError) {
      console.error('❌ Failed to mark invitation as accepted:', acceptError)
      console.error('❌ Error details:', JSON.stringify(acceptError, null, 2))
    } else {
      console.log('✅ Invitation marked as accepted successfully');
      console.log('✅ Updated invitation:', updatedInvitation)
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
