import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { requireServerRoles, requireServerOrgAccess, requireServerAuth } from '@/lib/supabaseServer'
import { getCurrentUserOrgId, MissingOrgIdError } from '@/lib/server-helpers'
import { getUserDataCacheHeaders } from '@/lib/cacheConfig'
import { z } from 'zod'
import { validateBody, validateQuery, firstNameSchema, lastNameSchema, emailSchema, roleSchema, phoneSchema, addressSchema, ssnSchema, classIdSchema, userIdSchema, uuidSchema } from '@/lib/validation'
import { type UserMetadata, type SamveraRole } from '@/lib/types/auth'
// Invitation email handled via Supabase Admin API (inviteUserByEmail)

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

    // Allow principals, admins, and teachers to read staff data (for messaging purposes)
    // Teachers can read to see other teachers for messaging, but cannot modify staff
    const { user } = await requireServerAuth()
    const userRoles = user.user_metadata?.roles || []
    const isTeacher = userRoles.includes('teacher') && !userRoles.includes('principal') && !userRoles.includes('admin')
    
    // Check role permission
    if (!userRoles.some((role: string) => ['principal', 'admin', 'teacher', 'guardian', 'parent'].includes(role))) {
      throw new Error(`One of roles [principal, admin, teacher, guardian, 'parent'] required. User has roles: ${userRoles.join(', ')}`)
    }
    
    let orgId: string;
    try {
      orgId = await getCurrentUserOrgId();
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return NextResponse.json({ 
          error: 'Organization ID not found',
          code: 'MISSING_ORG_ID'
        }, { status: 401 });
      }
      throw err;
    }

    // Get all staff members from staff table, joining with users table
    const { data: staffData, error: staffErr } = await supabaseAdmin
      .from('staff')
      .select(`
  id,
  user_id,
  org_id,
  created_at,
  users!inner(id,email,first_name,last_name,phone,address,ssn,org_id,is_active,created_at,role,deleted_at)
`)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    // Transform the data to match expected format
    // For teachers, exclude sensitive data (SSN, phone, address) for security
    // Filter out deleted and inactive staff
    let staff = staffData?.map((s: any) => {
      const baseData: any = {
        id: s.users.id,
        email: s.users.email,
        first_name: s.users.first_name,
        last_name: s.users.last_name,
        org_id: s.users.org_id,
        is_active: s.users.is_active,
        created_at: s.users.created_at,
        role: s.users.role || 'teacher',
        deleted_at: s.users.deleted_at || null
      }
      
      // Only include sensitive fields for principals and admins
      if (!isTeacher) {
        baseData.phone = s.users.phone
        baseData.address = s.users.address
        baseData.ssn = s.users.ssn
      }
      
      return baseData
    }).filter((s: any) => s.is_active === true && !s.deleted_at) || []

    const error = staffErr

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also get teachers directly from users table (not just from staff table)
    // This ensures all teachers are included, even if they're not in the staff table
    try {
      let usersWithTeacherRole: any[] = []
      let usersError: any = null
      
      // Try to query with role filter first
      const roleQuery = supabaseAdmin
        .from('users')
        .select('id,email,first_name,last_name,phone,address,ssn,org_id,is_active,created_at,role')
        .eq('org_id', orgId)
        .eq('role', 'teacher')
        .is('deleted_at', null)
      
      const roleResult = await roleQuery
      usersWithTeacherRole = roleResult.data || []
      usersError = roleResult.error

      
      if (usersError && usersError.code === '42703') { // column does not exist
        console.log('⚠️ Role column may not exist, trying alternative query...')
        const allUsersQuery = supabaseAdmin
          .from('users')
          .select('id,email,first_name,last_name,phone,address,ssn,org_id,is_active,created_at,role')
          .eq('org_id', orgId)
          .is('deleted_at', null)
        
        const allUsersResult = await allUsersQuery
        if (!allUsersResult.error && allUsersResult.data) {
          // Filter to only include users who are not principals (assume they're teachers if not in staff table as principal)
          const existingStaffIds = new Set(staff.map((s: any) => s.id))
          usersWithTeacherRole = allUsersResult.data.filter((u: any) => {
            // Exclude if already in staff array, or if role is 'principal' or 'guardian' or 'student'
            const userRole = (u.role || '').toLowerCase()
            return !existingStaffIds.has(u.id) && 
                   userRole !== 'principal' && 
                   userRole !== 'guardian' && 
                   userRole !== 'student' &&
                   userRole !== 'admin'
          })
          usersError = null
        }
      }

      if (!usersError && usersWithTeacherRole && usersWithTeacherRole.length > 0) {
        // Merge teachers from users table with staff from staff table
        // Avoid duplicates by checking if user already exists in staff array
        const existingStaffIds = new Set(staff.map((s: any) => s.id))
        
        usersWithTeacherRole.forEach((user: any) => {
          if (!existingStaffIds.has(user.id)) {
            const baseData: any = {
              id: user.id,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              org_id: user.org_id,
              is_active: user.is_active,
              created_at: user.created_at,
              role: user.role || 'teacher'
            }
            
            // Only include sensitive fields for principals and admins
            if (!isTeacher) {
              baseData.phone = user.phone
              baseData.address = user.address
              baseData.ssn = user.ssn
            }
            
            staff.push(baseData)
            existingStaffIds.add(user.id)
          }
        })
        
        console.log(`✅ Added ${usersWithTeacherRole.length} teachers from users table (total staff: ${staff.length})`)
      } else if (usersError) {
        console.warn('⚠️ Error loading teachers from users table:', usersError)
      }
    } catch (e) {
      console.warn('⚠️ Exception loading teachers from users table:', e)
    }

    // Also get teachers from class_memberships (ALWAYS run, not just as fallback)
    // This ensures we catch teachers who are assigned to classes but might not be in staff table or have role='teacher' set
    // This is CRITICAL for guardians/parents who need to see teachers assigned to their children's classes
    try {
      const existingStaffIds = new Set(staff.map((s: any) => s.id))
      const { data: membershipUsers } = await supabaseAdmin
        .from('class_memberships')
        .select(`
          user_id,
          membership_role,
          users!inner(id,email,first_name,last_name,phone,address,ssn,org_id,is_active,created_at,role)
        `)
        .eq('membership_role', 'teacher')
        .eq('org_id', orgId)

      if (membershipUsers && membershipUsers.length > 0) {
        const derived = membershipUsers
          .filter((m: any) => m.users?.org_id === orgId && !existingStaffIds.has(m.users.id))
          .map((m: any) => {
            const baseData: any = {
              id: m.users.id,
              email: m.users.email,
              first_name: m.users.first_name,
              last_name: m.users.last_name,
              org_id: m.users.org_id,
              is_active: m.users.is_active,
              created_at: m.users.created_at,
              role: m.users.role || 'teacher'
            }
            
            // Only include sensitive fields for principals and admins
            if (!isTeacher) {
              baseData.phone = m.users.phone
              baseData.address = m.users.address
              baseData.ssn = m.users.ssn
            }
            
            return baseData
          })

        if (derived.length > 0) {
          staff.push(...derived)
          console.log(`✅ Added ${derived.length} teachers from class_memberships (total staff: ${staff.length})`)
        }
      }
    } catch (e) {
      // ignore errors; just log them
      console.warn('⚠️ Error loading teachers from class_memberships:', e)
    }

    // Fallback: derive staff from class_memberships if we still don't have any staff
    // This ensures we return something even if staff table and users table queries fail
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
              const baseData: any = {
                id: m.users.id,
                email: m.users.email,
                first_name: m.users.first_name,
                last_name: m.users.last_name,
                org_id: m.users.org_id,
                is_active: m.users.is_active,
                created_at: m.users.created_at,
                role: 'teacher'
              }
              
              // Only include sensitive fields for principals and admins
              if (!isTeacher) {
                baseData.phone = m.users.phone
                baseData.address = m.users.address
                baseData.ssn = m.users.ssn
              }
              
              acc.push(baseData)
            }
            return acc
          }, [])

        if (derived.length > 0) {
          staff = derived
        }
      } catch (e) {
        // ignore fallback errors; just return empty if both sources fail
        console.warn('⚠️ Error loading teachers from class_memberships (fallback):', e)
      }
    }

    // Log summary for debugging
    console.log(`✅ [Staff Management API] Returning ${staff?.length || 0} staff members for orgId: ${orgId}`)
    if (staff && staff.length > 0) {
      const teacherCount = staff.filter((s: any) => (s.role || 'teacher').toLowerCase() === 'teacher').length
      console.log(`📊 [Staff Management API] Breakdown: ${teacherCount} teachers, ${staff.length - teacherCount} other staff`)
      if (teacherCount > 0) {
        const teacherIds = staff
          .filter((s: any) => (s.role || 'teacher').toLowerCase() === 'teacher')
          .map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name || ''}`.trim() || s.email }))
        console.log(`👥 [Staff Management API] Teachers:`, teacherIds)
      }
    }

    return NextResponse.json({
      staff: staff || [],
      total_staff: staff?.length || 0
    }, {
      status: 200,
      headers: getUserDataCacheHeaders()
    })

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
    let org_id: string;
    try {
      org_id = await getCurrentUserOrgId();
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return NextResponse.json({ 
          error: 'Organization ID not found',
          code: 'MISSING_ORG_ID'
        }, { status: 401 });
      }
      throw err;
    }
    const created_by = user.id

    const body = await request.json()
    // POST body schema
    const postStaffBodySchema = z.object({
      first_name: firstNameSchema,
      last_name: lastNameSchema,
      email: emailSchema,
      role: roleSchema,
      phone: phoneSchema,
      class_id: classIdSchema.optional(),
      address: addressSchema,
      ssn: ssnSchema,
      education_level: z.string().max(100).nullable().optional(),
      union_membership: z.union([
        z.boolean().transform((val) => val ? 'Yes' : null),
        z.string().max(100),
        z.null()
      ]).optional(),
    });
    
    const bodyValidation = validateBody(postStaffBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { first_name, last_name, email, role, phone, class_id, address, ssn, education_level, union_membership } = bodyValidation.data
    const normalizedClassId = class_id && String(class_id).trim() !== '' ? class_id : null

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
      const userMetadata: UserMetadata = {
        roles: [role as SamveraRole],
        activeRole: role as SamveraRole,
        org_id: org_id,
      };
      
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: userMetadata,
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
    // PUT body schema
    const putStaffBodySchema = z.object({
      id: userIdSchema,
      first_name: firstNameSchema.optional(),
      last_name: lastNameSchema,
      email: emailSchema.optional(),
      role: roleSchema.optional(),
      phone: phoneSchema,
      address: addressSchema,
      ssn: ssnSchema,
      is_active: z.boolean().optional(),
      class_id: classIdSchema.optional(),
      education_level: z.string().max(100).nullable().optional(),
      union_membership: z.union([
        z.boolean().transform((val) => val ? 'Yes' : null),
        z.string().max(100),
        z.null()
      ]).optional(),
    });
    
    const bodyValidation = validateBody(putStaffBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { id, first_name, last_name, email, role, phone, address, ssn, is_active, class_id, education_level, union_membership } = bodyValidation.data

    console.log('🔧 Updating staff member:', { id, first_name, last_name, email, phone, address, ssn, role, education_level, union_membership })

    // Enforce role and verify org access
    await requireServerRoles(['principal', 'admin'] as any)
    let requesterOrgId: string;
    try {
      requesterOrgId = await getCurrentUserOrgId();
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return NextResponse.json({ 
          error: 'Organization ID not found',
          code: 'MISSING_ORG_ID'
        }, { status: 401 });
      }
      throw err;
    }
    
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
    // DELETE query parameter schema
    const deleteStaffQuerySchema = z.object({
      id: userIdSchema,
    });
    
    const queryValidation = validateQuery(deleteStaffQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { id } = queryValidation.data

    // Enforce role and verify org access
    await requireServerRoles(['principal', 'admin'] as any)
    let requesterOrgId: string;
    try {
      requesterOrgId = await getCurrentUserOrgId();
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return NextResponse.json({ 
          error: 'Organization ID not found',
          code: 'MISSING_ORG_ID'
        }, { status: 401 });
      }
      throw err;
    }
    
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
