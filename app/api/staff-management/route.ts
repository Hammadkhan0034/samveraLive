import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { requireServerRoles, requireServerOrgAccess, requireServerAuth } from '@/lib/supabaseServer'
// Invitation email handled via Supabase Admin API (inviteUserByEmail)

// Staff/Teacher role ID
const STAFF_ROLE_ID = 20

// Helper to derive org_id from authenticated user
async function getRequesterOrgIdOrThrow(): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured')
  }
  const { user } = await requireServerAuth()
  const metaOrg = user.user_metadata?.org_id || user.user_metadata?.organization_id || user.user_metadata?.orgId
  if (metaOrg) return metaOrg
  const { data, error } = await supabaseAdmin.from('users').select('org_id').eq('id', user.id).single()
  if (error || !data?.org_id) {
    throw new Error('Organization not found')
  }
  return data.org_id
}

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local'
      }, { status: 500 })
    }

    // Enforce role and derive org_id from authenticated user
    await requireServerRoles(['principal', 'admin'] as any)
    const orgId = await getRequesterOrgIdOrThrow()

    // Get all staff members from staff table, joining with users table
    const { data: staffData, error: staffErr } = await supabaseAdmin
      .from('staff')
      .select(`
  id,
  user_id,
  org_id,
  created_at,
  users!inner(id,email,first_name,last_name,phone,address,ssn,org_id,is_active,created_at,role)
`)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    // Transform the data to match expected format
    let staff = staffData?.map((s: any) => ({
      id: s.users.id,
      email: s.users.email,
      first_name: s.users.first_name,
      last_name: s.users.last_name,
      phone: s.users.phone,
      address: s.users.address,
      ssn: s.users.ssn,
      org_id: s.users.org_id,
      is_active: s.users.is_active,
      created_at: s.users.created_at,
      role: s.users.role || 'teacher'
    })) || []

    const error = staffErr

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // derive staff from class_memberships with membership_role='teacher' joined to users (fallback)
    if (staff.length === 0) {
      try {
        const { data: membershipUsers } = await supabaseAdmin
          .from('class_memberships')
          .select(`
        user_id,
        membership_role,
        users!inner(id,email,first_name,last_name,phone,address,ssn,org_id,is_active,created_at)
      `)
          .eq('membership_role', 'teacher')

        const derived = (membershipUsers || [])
          .filter((m: any) => m.users?.org_id === orgId)
          .reduce((acc: any[], m: any) => {
            if (!acc.find((u) => u.id === m.users.id)) {
              acc.push({
                id: m.users.id,
                email: m.users.email,
                first_name: m.users.first_name,
                last_name: m.users.last_name,
                phone: m.users.phone,
                address: m.users.address,
                ssn: m.users.ssn,
                org_id: m.users.org_id,
                is_active: m.users.is_active,
                created_at: m.users.created_at,
                role: 'teacher'
              })
            }
            return acc
          }, [])

        if (derived.length > 0) {
          staff = derived
        }
      } catch (e) {
        // ignore fallback errors; just return empty if both sources fail
      }
    }

    return NextResponse.json({
      staff: staff || [],
      total_staff: staff?.length || 0
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

    // Enforce role and derive org_id and created_by from authenticated user
    await requireServerRoles(['principal', 'admin'] as any)
    const { user } = await requireServerAuth()
    const org_id = await getRequesterOrgIdOrThrow()
    const created_by = user.id

    const body = await request.json()
    const { first_name, last_name, email, role, phone, class_id, address, ssn, education_level, union_membership } = body || {}

    // Normalize class_id to a valid UUID or null
    const normalizeToUuidOrNull = (v: any) => (typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim?.() || v) ? v : null)
    const normalizedClassId = normalizeToUuidOrNull(class_id)

    if (!email) {
      return NextResponse.json({
        error: 'Missing required field: email'
      }, { status: 400 })
    }

    if (!first_name || !first_name.trim()) {
      return NextResponse.json({
        error: 'Missing required field: first_name'
      }, { status: 400 })
    }

    // Check if user already exists in public.users table
    const { data: existingPublicUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (existingPublicUser) {
      return NextResponse.json({
        error: 'This email is already being used by another user'
      }, { status: 400 })
    }

    console.log('📋 Creating staff with class assignment:', { email, org_id, class_id });

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
          first_name: 'Principal',
          last_name: null,
          is_active: true,
          org_id: org_id
        }, { onConflict: 'id' })

      if (createCreatorError) {
        return NextResponse.json({ error: `Failed to create creator user: ${createCreatorError.message}` }, { status: 500 })
      }
    }

    console.log('👤 Checking if auth user exists...')
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingAuthUsers?.users.find(u => u.email === email)

    let authUser = existingAuthUser

    // Create auth user if it doesn't exist
    if (!existingAuthUser) {
      console.log('📝 Creating new auth user with default password...')
      const defaultPassword = 'test123456'
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          roles: [role],
          activeRole: role,
          role: role ,
          org_id: org_id,
          first_name: (first_name || '').trim(),
          last_name: (last_name || '').trim() || null
        }
      })

      if (createError) {
        console.error('❌ Failed to create auth user:', createError)
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      if (!newAuthUser?.user) {
        return NextResponse.json({ error: 'Auth user not created' }, { status: 500 })
      }

      authUser = newAuthUser.user
      console.log('✅ Auth user created successfully')
    } else {
      console.log('ℹ️ Auth user already exists, using existing user')
    }

    // Ensure authUser is defined before proceeding
    if (!authUser) {
      return NextResponse.json({ error: 'Auth user not found or created' }, { status: 500 })
    }

    // Create or update user in public.users table
    const userUpsertData: any = {
      id: authUser.id,
      email: email,
      first_name: (first_name || '').trim(),
      last_name: (last_name || '').trim() || null,
      phone: phone || null,
      address: address || null,
      ssn: ssn || null,
      org_id: org_id,
      is_active: true
    }
    
    // Validate role against DB enum values actually used in schema
    // Fallback to 'teacher' when invalid/missing
    const userRole = (role && ['teacher', 'principal', 'guardian', 'student'].includes(role)) ? role : 'teacher'
    userUpsertData.role = userRole as any
    
    const { error: publicUserError } = await supabaseAdmin
      .from('users')
      .upsert(userUpsertData, {
        onConflict: 'id',
        ignoreDuplicates: false // Update if exists
      })

    if (publicUserError) {
      console.error('❌ Failed to create/update public user:', publicUserError)
      return NextResponse.json({ error: `Failed to create user profile: ${publicUserError.message}` }, { status: 500 })
    }

    // Create staff record
    const { error: staffError } = await supabaseAdmin
      .from('staff')
      .insert({
        org_id: org_id,
        user_id: authUser.id,
        education_level: education_level || null,
        union_name: union_membership ? 'Yes' : null
      })

    if (staffError) {
      console.error('❌ Failed to create staff record:', staffError)
      // Don't fail the whole request, just log the error
      console.log('⚠️ User created but staff record failed. You can add manually later.');
    } else {
      console.log('✅ Staff record created successfully');
    }

    // Create class membership only if class_id is a valid UUID
    const isValidUuid = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    if (isValidUuid(normalizedClassId)) {
      console.log('🔗 Creating class membership for teacher:', { user_id: authUser.id, class_id });

      const { error: membershipError } = await supabaseAdmin
        .from('class_memberships')
        .insert({
          org_id: org_id,
          user_id: authUser.id,
          class_id: normalizedClassId,
          membership_role: 'teacher'
        });

      if (membershipError) {
        console.error('❌ Failed to create class membership:', membershipError);
        // Don't fail the whole request, just log the error
        console.log('⚠️ User created but class assignment failed. You can assign manually later.');
      } else {
        console.log('✅ Class membership created successfully');
      }
    } else {
      console.log('ℹ️ No valid class selected; skipping class membership creation');
    }

    return NextResponse.json({
      user: {
        id: authUser.id,
        email,
        org_id,
      },
      message: 'Staff account created successfully with default password.'
    }, { status: 201 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local'
      }, { status: 500 })
    }

    const body = await request.json()
    const { 
      id,
      first_name,
      last_name,
      email,
      phone,
      address,
      ssn,
      education_level,
      union_membership,
      role,
      is_active
    } = body || {}

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    console.log('🔧 Updating staff member:', { id, first_name, last_name, email, phone, address, ssn, role, education_level, union_membership })

    // Enforce role and verify org access
    await requireServerRoles(['principal', 'admin'] as any)
    const requesterOrgId = await getRequesterOrgIdOrThrow()
    
    const { data: targetUser, error: targetErr } = await supabaseAdmin
      .from('users')
      .select('id, org_id')
      .eq('id', id)
      .single()
    if (targetErr || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Verify requester and target user are in the same org
    if (targetUser.org_id !== requesterOrgId) {
      return NextResponse.json({ error: 'Cross-organization access is not allowed' }, { status: 403 })
    }

    // Update user record
    const userUpdateData: any = {
      updated_at: new Date().toISOString()
    }

    if (first_name !== undefined) userUpdateData.first_name = first_name
    if (last_name !== undefined) userUpdateData.last_name = last_name
    if (email !== undefined) userUpdateData.email = email
    if (phone !== undefined) userUpdateData.phone = phone || null
    if (address !== undefined) userUpdateData.address = address || null
    if (ssn !== undefined) userUpdateData.ssn = ssn || null
    if (is_active !== undefined) userUpdateData.is_active = is_active

    // Validate and set role if provided
    if (role !== undefined) {
      const userRole = (role && ['teacher', 'principal', 'guardian', 'student'].includes(role)) ? role : 'teacher'
      userUpdateData.role = userRole as any
    }

    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update(userUpdateData)
      .eq('id', id)

    if (userUpdateError) {
      console.error('❌ Failed to update user:', userUpdateError)
      return NextResponse.json({ error: `Failed to update user: ${userUpdateError.message}` }, { status: 500 })
    }

    // Update staff record
    const { data: staffData } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('user_id', id)
      .single()

    if (staffData) {
      const staffUpdateData: any = {
        updated_at: new Date().toISOString()
      }

      if (education_level !== undefined) staffUpdateData.education_level = education_level || null
      if (union_membership !== undefined) staffUpdateData.union_name = union_membership ? 'Yes' : null

      const { error: staffUpdateError } = await supabaseAdmin
        .from('staff')
        .update(staffUpdateData)
        .eq('id', staffData.id)

      if (staffUpdateError) {
        console.error('❌ Failed to update staff record:', staffUpdateError)
        // Don't fail the whole request, just log the error
      } else {
        console.log('✅ Staff record updated successfully')
      }
    }

    // Fetch updated user data
    const { data: updatedUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id,email,first_name,last_name,phone,address,ssn,org_id,is_active,created_at,role')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('❌ Failed to fetch updated user:', fetchError)
      return NextResponse.json({ error: `Failed to fetch updated user: ${fetchError.message}` }, { status: 500 })
    }

    // Fetch staff additional data if available
    const { data: staffRecord } = await supabaseAdmin
      .from('staff')
      .select('education_level,union_name')
      .eq('user_id', id)
      .single()

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      phone: updatedUser.phone,
      address: updatedUser.address,
      ssn: updatedUser.ssn,
      org_id: updatedUser.org_id,
      is_active: updatedUser.is_active,
      created_at: updatedUser.created_at,
      role: (updatedUser as any).role || 'teacher'
    }, { status: 200 })

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

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Enforce role and verify org access
    await requireServerRoles(['principal', 'admin'] as any)
    const requesterOrgId = await getRequesterOrgIdOrThrow()
    
    const { data: targetUser, error: targetErr } = await supabaseAdmin
      .from('users')
      .select('id, org_id')
      .eq('id', id)
      .single()
    if (targetErr || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Verify requester and target user are in the same org
    if (targetUser.org_id !== requesterOrgId) {
      return NextResponse.json({ error: 'Cross-organization access is not allowed' }, { status: 403 })
    }

    // Soft delete: mark user inactive (and set deleted_at if column exists)
    const updates: any = { is_active: false }
    // try setting deleted_at if column exists (ignore error)
    try {
      updates.deleted_at = new Date().toISOString()
    } catch {}

    const { error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
