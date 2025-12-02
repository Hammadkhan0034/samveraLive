import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getUserDataCacheHeaders } from '@/lib/cacheConfig'
import { getAuthUserWithOrg, MissingOrgIdError, mapAuthErrorToResponse } from '@/lib/server-helpers'
import { z } from 'zod'
import { validateQuery, validateBody, userIdSchema, firstNameSchema, lastNameSchema, emailSchema, phoneSchema, addressSchema, ssnSchema } from '@/lib/validation'
import { type UserMetadata } from '@/lib/types/auth'

// Guardian role ID
const GUARDIAN_ROLE_ID = 10

export async function GET(request: Request) {
  try {
    // Get authenticated user and orgId from server-side auth (no query params needed)
    let user, orgId: string;
    try {
      const authContext = await getAuthUserWithOrg();
      user = authContext.user;
      orgId = authContext.orgId;
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return mapAuthErrorToResponse(err);
      }
      const message = err instanceof Error ? err.message : 'Authentication required';
      return NextResponse.json({ error: message }, { status: 401 });
    }
    
    // Check if user has principal, admin, or teacher role
    const userRoles = user.user_metadata?.roles || [];
    const hasAccess = userRoles.some((role: string) => ['principal', 'admin', 'teacher'].includes(role));
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied. Principal, admin, or teacher role required.' 
      }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }

    // Query guardians for this specific org only
    const { data: guardians, error } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at')
      .eq('role', 'guardian')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      guardians: guardians || [],
      total_guardians: guardians?.length || 0
    }, {
      status: 200,
      headers: getUserDataCacheHeaders()
    })

  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    // Handle authentication/org ID errors
    const authErrorResponse = mapAuthErrorToResponse(authError);
    if (authErrorResponse) {
      return authErrorResponse;
    }
    
    // Handle other errors
    const message = authError instanceof Error ? authError.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST body schema - org_id removed, now fetched server-side
const postGuardianBodySchema = z.object({
  first_name: firstNameSchema,
  last_name: lastNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  ssn: ssnSchema,
  address: addressSchema,
  student_id: userIdSchema.optional(),
});

export async function POST(request: Request) {
  try {
    // Get authenticated user and orgId from server-side auth
    let user, orgId: string;
    try {
      const authContext = await getAuthUserWithOrg();
      user = authContext.user;
      orgId = authContext.orgId;
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return mapAuthErrorToResponse(err);
      }
      const message = err instanceof Error ? err.message : 'Authentication required';
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const bodyValidation = validateBody(postGuardianBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { first_name, last_name, email, phone, ssn, address, student_id } = bodyValidation.data

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

    // Create auth user with default password
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingAuthUsers?.users.find(u => u.email === email)

    let authUser = existingAuthUser

    // Create auth user if it doesn't exist
    if (!existingAuthUser) {
      const defaultPassword = 'test123456'
      const userMetadata: UserMetadata = {
        roles: ['parent'],
        activeRole: 'parent',
        org_id: orgId,
      };
      
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: userMetadata,
      })

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      if (!newAuthUser?.user) {
        return NextResponse.json({ error: 'Auth user not created' }, { status: 500 })
      }

      authUser = newAuthUser.user
    }

    // Ensure authUser is defined before proceeding
    if (!authUser) {
      return NextResponse.json({ error: 'Auth user not found or created' }, { status: 500 })
    }

    const guardianId = authUser.id
    
    // Create simple guardian record in users table
    const userData = {
      id: guardianId,
      email: email,
      phone: phone || null,
      first_name: first_name,
      last_name: last_name || null,
      role: 'guardian' as any,
      org_id: orgId,
      is_active: true,
      ssn: ssn || null,
      address: address || null,
    };
    
    
    
    const { error: publicUserError } = await supabaseAdmin
      .from('users')
      .insert(userData)

    if (publicUserError) {
      return NextResponse.json({ error: `Failed to create guardian: ${publicUserError.message}` }, { status: 500 })
    }
    // Optionally link to a specific student
    let createdRelationship: any = null
    let studentClassId: string | null = null
    if (student_id) {
      const { data: relationship, error: linkError } = await supabaseAdmin
        .from('guardian_students')
        .insert({ guardian_id: guardianId, student_id, relation: 'parent', org_id: orgId })
        .select('id')
        .single()
      if (!linkError) createdRelationship = relationship

      const { data: studentRow } = await supabaseAdmin
        .from('students')
        .select('class_id')
        .eq('id', student_id)
        .maybeSingle()
      studentClassId = studentRow?.class_id ?? null
    }

    // Update auth user metadata with org
    try {
      const userMetadata: UserMetadata = {
        roles: ['parent'],
        activeRole: 'parent',
        org_id: orgId,
      };
      
      await supabaseAdmin.auth.admin.updateUserById(guardianId, {
        user_metadata: userMetadata,
      })
    } catch (e) {
      // Continue - metadata update is non-critical
    }

    // Let's verify the guardian was actually created by querying it back
    const { data: verifyGuardian, error: verifyError } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at,ssn,address')
      .eq('id', guardianId)
      .single();
    


    return NextResponse.json({ 
      guardian: {
        id: guardianId,
        email: email,
        first_name: first_name,
        last_name: last_name || null,
        org_id: orgId,
        role: 'guardian',
        ssn: ssn || null,
        address: address || null,
      },
      message: 'Guardian account created successfully with default password.',
      verification: verifyGuardian,
      relationship: createdRelationship
    }, { status: 201 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

// PUT body schema - org_id removed, now fetched server-side
const putGuardianBodySchema = z.object({
  id: userIdSchema,
  first_name: firstNameSchema,
  last_name: lastNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  ssn: ssnSchema,
  address: addressSchema,
  is_active: z.boolean().optional(),
});

export async function PUT(request: Request) {
  try {
    // Get authenticated user and orgId from server-side auth
    let orgId: string;
    try {
      const authContext = await getAuthUserWithOrg();
      orgId = authContext.orgId;
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return mapAuthErrorToResponse(err);
      }
      const message = err instanceof Error ? err.message : 'Authentication required';
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const bodyValidation = validateBody(putGuardianBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { id, first_name, last_name, email, phone, ssn, address, is_active } = bodyValidation.data
    
    // Update guardian record in users table
    const { data: updatedGuardian, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        email: email,
        phone: phone || null,
        first_name: first_name,
        last_name: last_name || null,
        org_id: orgId,
        is_active: is_active !== undefined ? is_active : true,
        role: 'guardian' as any,
        ssn: ssn || null,
        address: address || null,
      })
      .eq('id', id)
      .eq('role', 'guardian')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at,ssn,address')
      .single()

    if (updateError) {
      return NextResponse.json({ error: `Failed to update guardian: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ 
      guardian: updatedGuardian,
      message: 'Guardian updated successfully!'
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

// DELETE query parameter schema
const deleteGuardianQuerySchema = z.object({
  id: userIdSchema,
});

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(deleteGuardianQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { id } = queryValidation.data

    // Delete guardian from users table
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id)
      .eq('role', 'guardian')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}