import { NextResponse } from 'next/server';

import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import { validateBody, validateQuery, userIdSchema, firstNameSchema, lastNameSchema, emailSchema, phoneSchema, addressSchema, ssnSchema } from '@/lib/validation';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getCurrentUserOrgId } from '@/lib/server-helpers';

/**
 * Handler for GET /api/guardians
 * Fetches all guardians for the authenticated user's organization
 */
export async function handleGetGuardians(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 }
    );
  }

  // Query guardians for this specific org only
  const { data: guardians, error } = await adminClient
    .from('users')
    .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at')
    .eq('role', 'guardian')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    guardians: guardians || [],
    total_guardians: guardians?.length || 0
  }, {
    status: 200,
    headers: getUserDataCacheHeaders()
  });
}

// POST body schema
const postGuardianBodySchema = z.object({
  first_name: firstNameSchema,
  last_name: lastNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  ssn: ssnSchema,
  address: addressSchema,
  student_id: userIdSchema.optional(),
});

/**
 * Handler for POST /api/guardians
 * Creates a new guardian account with auth user and public user record
 */
export async function handlePostGuardian(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  // Extract org_id from authenticated user (prefer metadata, fallback to getCurrentUserOrgId)
  const metadata = user.user_metadata as UserMetadata 
  const orgId = metadata.org_id;
 

  const body = await request.json();
  const bodyValidation = validateBody(postGuardianBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }
  
  const { first_name, last_name, email, phone, ssn, address, student_id } = bodyValidation.data;

  // Check if user already exists in public.users table
  const { data: existingPublicUser } = await adminClient
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (existingPublicUser) {
    return NextResponse.json({
      error: 'This email is already being used by another user'
    }, { status: 400 });
  }

  // Create auth user with default password
  const { data: existingAuthUsers } = await adminClient.auth.admin.listUsers();
  const existingAuthUser = existingAuthUsers?.users.find(u => u.email === email);

  let authUser = existingAuthUser;

  // Create auth user if it doesn't exist
  if (!existingAuthUser) {
    const defaultPassword = 'test123456';
    const userMetadata: UserMetadata = {
      roles: ['guardian'],
      activeRole: 'guardian',
      org_id: orgId,
    };
    
    const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: userMetadata,
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    if (!newAuthUser?.user) {
      return NextResponse.json({ error: 'Auth user not created' }, { status: 500 });
    }

    authUser = newAuthUser.user;
  }

  // Ensure authUser is defined before proceeding
  if (!authUser) {
    return NextResponse.json({ error: 'Auth user not found or created' }, { status: 500 });
  }

  const guardianId = authUser.id;
  
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
  
  const { error: publicUserError } = await adminClient
    .from('users')
    .insert(userData);

  if (publicUserError) {
    return NextResponse.json({ error: `Failed to create guardian: ${publicUserError.message}` }, { status: 500 });
  }
  
  // Optionally link to a specific student
  let createdRelationship: any = null;
  let studentClassId: string | null = null;
  if (student_id) {
    const { data: relationship, error: linkError } = await adminClient
      .from('guardian_students')
      .insert({ guardian_id: guardianId, student_id, relation: 'parent', org_id: orgId })
      .select('id')
      .single();
    if (!linkError) createdRelationship = relationship;

    const { data: studentRow } = await adminClient
      .from('students')
      .select('class_id')
      .eq('id', student_id)
      .maybeSingle();
    studentClassId = studentRow?.class_id ?? null;
  }

  // Update auth user metadata with org
  try {
    const userMetadata: UserMetadata = {
      roles: ['guardian'],
      activeRole: 'guardian',
      org_id: orgId,
    };
    
    await adminClient.auth.admin.updateUserById(guardianId, {
      user_metadata: userMetadata,
    });
  } catch (e) {
    // Continue - metadata update is non-critical
  }

  // Let's verify the guardian was actually created by querying it back
  const { data: verifyGuardian, error: verifyError } = await adminClient
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
  }, { status: 201 });
}

// PUT body schema
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

/**
 * Handler for PUT /api/guardians
 * Updates an existing guardian record
 */
export async function handlePutGuardian(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const bodyValidation = validateBody(putGuardianBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }
  
  const { id, first_name, last_name, email, phone, ssn, address, is_active } = bodyValidation.data;
  
  // Update guardian record in users table
  const { data: updatedGuardian, error: updateError } = await adminClient
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
    .single();

  if (updateError) {
    return NextResponse.json({ error: `Failed to update guardian: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ 
    guardian: updatedGuardian,
    message: 'Guardian updated successfully!'
  }, { status: 200 });
}

// DELETE query parameter schema
const deleteGuardianQuerySchema = z.object({
  id: userIdSchema,
});

/**
 * Handler for DELETE /api/guardians
 * Deletes a guardian record by id
 */
export async function handleDeleteGuardian(
  request: Request,
  _user: AuthUser,
  adminClient: SupabaseClient,
) {
  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(deleteGuardianQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  
  const { id } = queryValidation.data;

  // Delete guardian from users table
  const { error } = await adminClient
    .from('users')
    .delete()
    .eq('id', id)
    .eq('role', 'guardian');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

