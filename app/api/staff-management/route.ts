import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { sendStaffInvitationEmail } from '@/lib/send-invitation-email'
import { createUserAuthEntry } from '@/app/core/createAuthEntry'

// Staff/Teacher role ID
const STAFF_ROLE_ID = 20

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    // Get all staff members (users table) for the organization
    const { data: staff, error } = await supabaseAdmin
      .from('users')
      .select('id,email,full_name,org_id,role_id,is_active,created_at')
      .eq('org_id', orgId)
      .eq('role_id', STAFF_ROLE_ID)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also get pending invitations for this org (filter by created_by users who belong to this org)
    // First get all user IDs from this org who can create invitations (principals)
    const { data: orgUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('org_id', orgId)
      .in('role_id', [30, 40]) // Principal or Admin
    
    const orgUserIds = orgUsers?.map(u => u.id) || []

    const { data: invitations, error: invError } = await supabaseAdmin
      .from('invitations')
      .select('id,email,role_id,created_at,expires_at,accepted_at,created_by')
      .eq('role_id', STAFF_ROLE_ID)
      .is('deleted_at', null)
      .is('accepted_at', null)
      .in('created_by', orgUserIds)

    console.log(`📊 Staff for org ${orgId}:`, {
      active_staff: staff?.length || 0,
      pending_invitations: invitations?.length || 0
    });

    return NextResponse.json({ 
      staff: staff || [],
      pending_invitations: invitations || [],
      total_staff: staff?.length || 0,
      total_pending: invitations?.length || 0
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { name, email, role, phone, org_id, created_by, class_id } = body || {}
    
    if (!email || !org_id || !created_by) {
      return NextResponse.json({ 
        error: `Missing required fields: ${!email ? 'email' : ''} ${!org_id ? 'org_id' : ''} ${!created_by ? 'created_by' : ''}`.trim()
      }, { status: 400 })
    }
    
    console.log('📋 Creating staff with class assignment:', { email, org_id, class_id });

    // Check if there's already a pending invitation for this email
    const { data: existingInvitation, error: checkError } = await supabaseAdmin
      .from('invitations')
      .select('id,email,token,expires_at,accepted_at,deleted_at')
      .eq('email', email)
      .is('deleted_at', null)
      .is('accepted_at', null)
      .single()

    // If there's a pending invitation, resend the email
    if (existingInvitation && !checkError) {
      console.log('📧 Existing Staff Invitation Found - Resending email with password')

      // Get the user_id from auth.users
      const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingAuthUser = existingAuthUsers?.users.find(u => u.email === email)
      
      if (!existingAuthUser) {
        // If user doesn't exist, continue with normal flow
        console.log('⚠️ User not found for existing invitation, will create new user')
        // Create user auth entry
        const { data: authData, error: authError } = await createUserAuthEntry(email, "test123456", 'teacher', name || email.split('@')[0])
        if (authError) {
          console.error('❌ Error creating user auth entry:', authError)
          const errorMessage = (authError as any)?.message || 'Failed to create user auth entry'
          return NextResponse.json({ error: errorMessage }, { status: 500 })
        }

        if (!authData?.user?.id) {
          return NextResponse.json({ error: 'Failed to create user - no user data returned' }, { status: 500 })
        }

        const teacherData = {
          id: authData.user.id,
          email: email || null,
          phone: phone || null,
          full_name: name || email.split('@')[0],
          org_id,
          role_id: STAFF_ROLE_ID,
          is_active:false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null
        }
        
        console.log('🔧 Creating principal with data:', teacherData)
        
        const { data, error } = await supabaseAdmin
          .from('users')
          .upsert(teacherData, { onConflict: 'id' })
          .select('id,email,phone,full_name,org_id,role_id,is_active,metadata,created_at,updated_at,deleted_at')
          .single()
          
        if (error) {
          console.error('❌ Error creating teacher:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log('✅ Teacher created successfully:', data)

      } else {
        // Get organization name for email
        const { data: orgData } = await supabaseAdmin
          .from('orgs')
          .select('name')
          .eq('id', org_id)
          .single()
        
        const organizationName = orgData?.name || 'Your Organization'

        // Resend invitation email with password
        const emailResult = await sendStaffInvitationEmail({
          email: email,
          staffName: name || email.split('@')[0],
          organizationName: organizationName,
          password: 'ahmad123456', // Default password
          invitationToken: existingInvitation.token,
          orgId: org_id,
          userId: existingAuthUser.id,
          expiresAt: existingInvitation.expires_at
        })

        if (!emailResult.success) {
          console.error('❌ Failed to resend invitation email:', emailResult.error)
        } else {
          console.log('✅ Invitation email resent to:', email)
        }

        return NextResponse.json({ 
          invitation: {
            id: existingInvitation.id,
            email: existingInvitation.email,
            token: existingInvitation.token,
            expires_at: existingInvitation.expires_at
          },
          user: {
            id: existingAuthUser.id,
            email: email,
            password: 'ahmad123456',
            org_id: org_id,
            isExisting: true
          },
          message: 'This email already has a pending invitation. Email resent with password.'
        }, { status: 200 })
      }
    }

    // Ensure the creator exists in public.users table
    const { data: creatorUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', created_by)
      .single()

    if (!creatorUser) {


      
      const { error: createCreatorError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: created_by,
          full_name: 'Principal',
          is_active: true,
          org_id: org_id
        }, { onConflict: 'id' })

      if (createCreatorError) {
        return NextResponse.json({ error: `Failed to create creator user: ${createCreatorError.message}` }, { status: 500 })
      }
    }

    // Generate invitation token
    const invitationToken = crypto.randomUUID()
    
    // Set expiration date (7 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    
    // Create invitation record with org_id in metadata
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('invitations')
      .insert({
        email: email,
        role_id: STAFF_ROLE_ID,
        token: invitationToken,
        created_by: created_by,
        expires_at: expiresAt.toISOString()
      })
      .select('id,email,token,expires_at,created_at')
      .single()

    if (invitationError) {
      return NextResponse.json({ error: `Failed to create invitation: ${invitationError.message}` }, { status: 500 })
    }

    // Check if user already exists
    const defaultPassword = 'ahmad123456';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    
    console.log('👤 Checking if user exists...');
    
    // Try to get existing user by email
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingAuthUsers?.users.find(u => u.email === email)
    
    let authUser: any
    
    if (existingAuthUser) {
      console.log('✅ User already exists, using existing account:', existingAuthUser.id)
      
      // Update user metadata
      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingAuthUser.id,
        {
          password: defaultPassword, // Reset to default password
          email_confirm: true,
          user_metadata: {
            invitation_token: invitationToken,
            org_id: org_id,
            role: 'teacher',
            roles: ['teacher'],
            activeRole: 'teacher',
            invited_by: created_by,
            full_name: name || existingAuthUser.user_metadata?.full_name || email.split('@')[0]
          }
        }
      )
      
      if (updateError) {
        console.error('❌ Failed to update user:', updateError)
      }
      
      authUser = { user: existingAuthUser }
    } else {
      console.log('👤 Creating new user account with default password...');
      
      // Create new auth user with default password
      const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: defaultPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          invitation_token: invitationToken,
          org_id: org_id,
          role: 'teacher',
          roles: ['teacher'],
          activeRole: 'teacher',
          invited_by: created_by,
          full_name: name || email.split('@')[0],
          class_id: class_id || null
        }
      })

      if (authError) {
        console.error('❌ Failed to create user:', authError)
        const errorMessage = (authError as any)?.message || 'Failed to create user'
        return NextResponse.json({ error: `Failed to create user: ${errorMessage}` }, { status: 500 })
      }

      authUser = newAuthUser
      console.log('✅ User created successfully:', authUser.user?.id)
    }

    // Create or update user in public.users table
    const { error: publicUserError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: authUser.user!.id,
        email: email,
        full_name: name || email.split('@')[0],
        role_id: STAFF_ROLE_ID,
        org_id: org_id,
        is_active: true,
        metadata: {
          role: 'teacher',
          org_id: org_id
        }
      }, {
        onConflict: 'id',
        ignoreDuplicates: false // Update if exists
      })

    if (publicUserError) {
      console.error('❌ Failed to create/update public user:', publicUserError)
      return NextResponse.json({ error: `Failed to create user profile: ${publicUserError.message}` }, { status: 500 })
    }

    // Create class membership if class_id is provided
    if (class_id) {
      console.log('🔗 Creating class membership for teacher:', { user_id: authUser.user!.id, class_id });
      
      const { error: membershipError } = await supabaseAdmin
        .from('class_memberships')
        .insert({
          user_id: authUser.user!.id,
          class_id: class_id,
          membership_role: 'teacher'
        });

      if (membershipError) {
        console.error('❌ Failed to create class membership:', membershipError);
        // Don't fail the whole request, just log the error
        console.log('⚠️ User created but class assignment failed. You can assign manually later.');
      } else {
        console.log('✅ Class membership created successfully');
      }
    }

    // DON'T mark invitation as accepted yet - wait for user to click magic link
    console.log('✅ Account created, sending invitation email with password...')

    // Get organization name for email
    const { data: orgData } = await supabaseAdmin
      .from('orgs')
      .select('name')
      .eq('id', org_id)
      .single()
    
    const organizationName = orgData?.name || 'Your Organization'

    // Send invitation email with password
    const emailResult = await sendStaffInvitationEmail({
      email: email,
      staffName: name || email.split('@')[0],
      organizationName: organizationName,
      password: defaultPassword,
      invitationToken: invitationToken,
      orgId: org_id,
      userId: authUser.user!.id,
      expiresAt: invitation.expires_at
    })

    if (!emailResult.success) {
      console.error('❌ Failed to send invitation email:', emailResult.error)
      // Don't fail the whole request, just log the error
    } else {
      console.log('✅ Invitation email sent to:', email)
      console.log('📧 Email includes password:', defaultPassword)
    }

    return NextResponse.json({ 
      invitation: {
        id: invitation.id,
        email: invitation.email,
        token: invitation.token,
        expires_at: invitation.expires_at,
        created_at: invitation.created_at
      },
      user: {
        id: authUser.user!.id,
        email: email,
        password: defaultPassword,
        org_id: org_id,
        isExisting: !!existingAuthUser
      },
      message: existingAuthUser 
        ? 'Existing user re-invited. Magic link sent to email. Password: ahmad123456' 
        : 'User account created. Magic link sent to email. Password: ahmad123456'
    }, { status: 201 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type') || 'staff' // 'staff' or 'invitation'
    
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    if (type === 'invitation') {
      // Cancel/delete pending invitation
      const { error } = await supabaseAdmin
        .from('invitations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      // Delete staff user
      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', id)
        .eq('role_id', STAFF_ROLE_ID)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
