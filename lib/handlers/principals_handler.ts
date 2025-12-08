import { NextResponse } from 'next/server';
import { createUserAuthEntry } from 'app/core/createAuthEntry';
import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import { z } from 'zod';
import {
  validateQuery,
  validateBody,
  orgIdSchema,
  uuidSchema,
  firstNameSchema,
  lastNameSchema,
  emailSchema,
  phoneSchema,
} from '@/lib/validation';
import { getPrincipalsQuerySchema } from '@/lib/validation/principals';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentUserOrgId } from '@/lib/server-helpers';

// Note: Some databases may not have a dedicated role_id column on public.users
// We'll avoid relying on role_id in this route
const PRINCIPAL_ROLE_ID = 30;

// POST body schema
const postPrincipalBodySchema = z.object({
  id: uuidSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema,
  first_name: firstNameSchema,
  last_name: lastNameSchema.optional(),
  org_id: orgIdSchema.optional(), // Optional - will be extracted from authenticated user if not provided
  is_active: z.boolean().optional(),
  created_by: uuidSchema.optional(), // Optional - will use authenticated user.id if not provided
});

// PUT body schema
const putPrincipalBodySchema = z.object({
  id: uuidSchema,
  first_name: firstNameSchema.optional(),
  last_name: lastNameSchema.optional(),
  org_id: orgIdSchema.optional(),
  is_active: z.boolean().optional(),
  email: emailSchema.optional(),
  phone: phoneSchema,
});

// DELETE query parameter schema
const deletePrincipalQuerySchema = z.object({
  id: uuidSchema,
});

const usersColumnCache: Record<string, boolean> = {};

/**
 * Detects if an error is related to phone format constraint violation
 * and returns a human-readable error message
 */
function getPhoneFormatErrorMessage(error: any): string | null {
  if (!error) return null;

  const errorMessage = error.message || '';
  const errorDetails = error.details || '';
  const errorHint = error.hint || '';
  const combinedError = `${errorMessage} ${errorDetails} ${errorHint}`.toLowerCase();

  // Check for phone format constraint violation
  if (
    combinedError.includes('chk_users_phone_format') ||
    (combinedError.includes('check constraint') && combinedError.includes('phone')) ||
    (combinedError.includes('violates check constraint') && combinedError.includes('phone_format'))
  ) {
    return 'Phone number must be in international format: optional + sign followed by 7-15 digits (first digit cannot be 0). Examples: +1234567890 or 1234567890';
  }

  return null;
}

/**
 * Detects if an error is related to foreign key constraint violation
 * and returns a human-readable error message
 */
function getForeignKeyErrorMessage(error: any): string | null {
  if (!error) return null;

  const errorCode = error.code || '';
  const errorMessage = error.message || '';
  const errorDetails = error.details || '';
  const combinedError = `${errorMessage} ${errorDetails}`.toLowerCase();

  // Check for foreign key constraint violation (PostgreSQL error code 23503)
  if (errorCode === '23503' || combinedError.includes('foreign key constraint')) {
    // Check if it's an org_id foreign key violation
    if (combinedError.includes('org_id') || combinedError.includes('orgs')) {
      const orgIdMatch = errorDetails.match(/\(org_id\)=\(([^)]+)\)/);
      const orgId = orgIdMatch ? orgIdMatch[1] : 'unknown';
      return `Organization with ID ${orgId} does not exist. Please provide a valid organization ID.`;
    }
    return 'Foreign key constraint violation. Please ensure all referenced records exist.';
  }

  return null;
}

async function hasUsersColumn(
  columnName: string,
  adminClient: SupabaseClient,
): Promise<boolean> {
  if (columnName in usersColumnCache) return usersColumnCache[columnName];
  try {
    if (!adminClient) {
      usersColumnCache[columnName] = false;
      return false;
    }
    const { data, error } = await adminClient
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'users')
      .eq('column_name', columnName)
      .limit(1);
    if (error) {
      console.warn(
        `⚠️ Could not inspect columns for users.${columnName}:`,
        error,
      );
      usersColumnCache[columnName] = false;
      return false;
    }
    usersColumnCache[columnName] = Array.isArray(data) && data.length > 0;
    return usersColumnCache[columnName];
  } catch (e) {
    console.warn(`⚠️ Exception checking users.${columnName} column:`, e);
    usersColumnCache[columnName] = false;
    return false;
  }
}

/**
 * Handler for GET /api/principals
 * Fetches all principals, optionally filtered by orgId
 */
export async function handleGetPrincipals(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(
      getPrincipalsQuerySchema,
      searchParams,
    );
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { orgId, page = 1, pageSize = 20 } = queryValidation.data;

    const roleExists = await hasUsersColumn('role', adminClient);
    const roleIdExists = await hasUsersColumn('role_id', adminClient);
    const metadataExists = await hasUsersColumn('metadata', adminClient);

    // Try to detect role column by attempting a test query
    let roleColumnDetected = roleExists;
    if (!roleExists) {
      try {
        // Test if role column exists by attempting a simple query
        const testQuery = adminClient.from('users').select('role').limit(1);
        const { data: testData, error: testError } = await testQuery;
        if (!testError && testData !== null) {
          roleColumnDetected = true;
          console.log('✅ Role column detected via test query');
        } else {
          console.log(
            '⚠️ Role column test query failed:',
            testError?.message || 'unknown error',
          );
        }
      } catch (e) {
        console.log('⚠️ Role column test query exception:', e);
      }
    }

    // Build base query for count
    let countQuery = adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // Build base query for data
    let q = adminClient
      .from('users')
      .select('*')
      .is('deleted_at', null) // Only get non-deleted principals
      .order('created_at', { ascending: false });

    // Always filter by role='principal' to ensure only principals are shown
    // Even if guardian/student is added by admin/principal, they should not appear in principals table
    // This is CRITICAL to prevent guardians/students from showing up when they're created
    let filterApplied = false;
    if (roleColumnDetected) {
      // Strictly filter by role='principal' only
      q = q.eq('role', 'principal');
      countQuery = countQuery.eq('role', 'principal');
      filterApplied = true;
      console.log('✅ Filtering principals by role="principal"');
    } else if (roleIdExists) {
      q = q.eq('role_id', PRINCIPAL_ROLE_ID);
      countQuery = countQuery.eq('role_id', PRINCIPAL_ROLE_ID);
      filterApplied = true;
      console.log('✅ Filtering principals by role_id=', PRINCIPAL_ROLE_ID);
    } else if (metadataExists) {
      q = q.contains('metadata', { activeRole: 'principal' });
      countQuery = countQuery.contains('metadata', { activeRole: 'principal' });
      filterApplied = true;
      console.log(
        '✅ Filtering principals by metadata.activeRole="principal"',
      );
    }

    if (orgId) {
      q = q.eq('org_id', orgId);
      countQuery = countQuery.eq('org_id', orgId);
    }

    // Get total count
    const { count, error: countError } = await countQuery;
    if (countError) {
      console.error('❌ Error getting principals count:', countError);
      return NextResponse.json(
        { error: countError.message },
        { status: 500 },
      );
    }

    const totalCount = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const offset = (page - 1) * pageSize;

    // Apply pagination
    q = q.range(offset, offset + pageSize - 1);

    const { data, error } = await q;

    // If query failed and we didn't apply filter, try fallback: fetch all and filter in-memory
    if (error && !filterApplied) {
      console.warn(
        '⚠️ Query failed without filter, trying fallback approach:',
        error.message,
      );
      // Try fetching without role filter and filter in-memory
      let fallbackQuery = adminClient
        .from('users')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (orgId) fallbackQuery = fallbackQuery.eq('org_id', orgId);

      const { data: fallbackData, error: fallbackError } =
        await fallbackQuery;
      if (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError);
        return NextResponse.json(
          { error: fallbackError.message },
          { status: 500 },
        );
      }

      // Filter in-memory: only include records with role='principal'
      const filtered = (fallbackData || []).filter((u: any) => {
        if (u.role === 'principal') return true;
        if (u.role_id === PRINCIPAL_ROLE_ID) return true;
        if (u.metadata?.activeRole === 'principal') return true;
        return false;
      });

      const principals = filtered.map((u: any) => ({
        id: u.id,
        org_id: u.org_id,
        email: u.email,
        phone: u.phone,
        first_name: u.first_name || null,
        last_name: u.last_name || null,
        full_name: [u.first_name, u.last_name]
          .filter(Boolean)
          .join(' ')
          .trim() || null,
        name: [u.first_name, u.last_name]
          .filter(Boolean)
          .join(' ')
          .trim() || null,
        role: 'principal',
        ...(u.role ? { role: u.role } : {}),
        ...(u.role_id ? { role_id: u.role_id } : {}),
        is_active: u.is_active,
        created_at: u.created_at,
        updated_at: u.updated_at,
        deleted_at: u.deleted_at,
      }));

      // For fallback, we need to handle pagination manually
      const fallbackTotalCount = filtered.length;
      const fallbackTotalPages = Math.max(1, Math.ceil(fallbackTotalCount / pageSize));
      const fallbackOffset = (page - 1) * pageSize;
      const paginatedPrincipals = filtered.slice(fallbackOffset, fallbackOffset + pageSize);

      console.log(
        '✅ Returning principals (fallback filtered):',
        paginatedPrincipals.length,
        'principals',
      );
      return NextResponse.json(
        {
          principals: paginatedPrincipals,
          totalCount: fallbackTotalCount,
          totalPages: fallbackTotalPages,
          currentPage: page,
        },
        { status: 200 },
      );
    }

    if (error) {
      // Handle fetch errors (network issues, connection problems)
      const errorMessage =
        error.message || (typeof error === 'string' ? error : 'Unknown error');
      const isFetchError =
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('TypeError: fetch failed');

      console.error('❌ Error fetching principals:', {
        message: errorMessage,
        details: (error as any)?.details || '',
        hint: (error as any)?.hint || '',
        code: (error as any)?.code || '',
        isFetchError,
      });

      // If it's a fetch error, provide more helpful message
      if (isFetchError) {
        return NextResponse.json(
          {
            error:
              'Database connection failed. Please check your Supabase configuration and network connection.',
            details: errorMessage,
          },
          { status: 503 },
        ); // 503 Service Unavailable
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: (error as any)?.details || '',
        },
        { status: 500 },
      );
    }

    // Double-check: Filter out any records that don't have role='principal'
    // This is a safety measure in case the query filter didn't work properly
    let filteredData = data || [];
    if (Array.isArray(filteredData)) {
      const beforeCount = filteredData.length;
      filteredData = filteredData.filter((u: any) => {
        // Accept if role is 'principal' OR role_id matches OR metadata has principal
        return (
          u.role === 'principal' ||
          u.role_id === PRINCIPAL_ROLE_ID ||
          u.metadata?.activeRole === 'principal'
        );
      });
      if (beforeCount !== filteredData.length) {
        console.log(
          `✅ Filtered principals: ${beforeCount} -> ${filteredData.length} (removed non-principals)`,
        );
      }
    }

    console.log('✅ Fetched principals:', filteredData?.length || 0);

    const principals = (filteredData || []).map((u: any) => ({
      id: u.id,
      org_id: u.org_id,
      email: u.email,
      phone: u.phone,
      first_name: u.first_name || null,
      last_name: u.last_name || null,
      full_name: [u.first_name, u.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || null,
      name: [u.first_name, u.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || null,
      role: 'principal',
      ...(roleExists ? { role: u.role } : {}),
      ...(roleIdExists ? { role_id: u.role_id } : {}),
      is_active: u.is_active,
      created_at: u.created_at,
      updated_at: u.updated_at,
      deleted_at: u.deleted_at,
    }));

    console.log('✅ Returning principals:', principals.length, 'principals');
    return NextResponse.json(
      {
        principals,
        totalCount,
        totalPages,
        currentPage: page,
      },
      {
        status: 200,
        headers: getUserDataCacheHeaders(),
      },
    );
  } catch (err: any) {
    const errorMessage =
      err?.message || (typeof err === 'string' ? err : 'Unknown error');
    const isFetchError =
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('TypeError: fetch failed');

    console.error('💥 Error in principals GET:', {
      message: errorMessage,
      details: err?.details || '',
      stack: err?.stack || '',
      isFetchError,
    });

    // If it's a fetch error, provide more helpful message
    if (isFetchError) {
      return NextResponse.json(
        {
          error:
            'Database connection failed. Please check your Supabase configuration and network connection.',
          details: errorMessage,
        },
        { status: 503 },
      ); // 503 Service Unavailable
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: err?.details || '',
      },
      { status: 500 },
    );
  }
}

/**
 * Handler for POST /api/principals
 * Creates a new principal account with auth user and public user record
 */
export async function handlePostPrincipal(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const body = await request.json();
    const bodyValidation = validateBody(postPrincipalBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const {
      id,
      email,
      phone,
      first_name,
      last_name,
      org_id: clientOrgId,
      is_active,
      created_by: clientCreatedBy,
    } = bodyValidation.data;

    // Extract org_id from authenticated user
    // For admin users, they can specify org_id in the request (clientOrgId)
    // Otherwise, extract from user metadata or getCurrentUserOrgId
    const metadata = user.user_metadata as UserMetadata | undefined;
    let orgId = clientOrgId || metadata?.org_id;
    if (!orgId) {
      orgId = await getCurrentUserOrgId(user);
    }

    // Validate that org_id exists in orgs table
    if (orgId) {
      const { data: org, error: orgError } = await adminClient
        .from('orgs')
        .select('id')
        .eq('id', orgId)
        .maybeSingle();

      if (orgError) {
        console.error('❌ Error checking org existence:', orgError);
        return NextResponse.json(
          { error: 'Failed to validate organization' },
          { status: 500 },
        );
      }

      if (!org) {
        console.error('❌ Organization not found:', orgId);
        return NextResponse.json(
          { 
            error: `Organization with ID ${orgId} does not exist. Please provide a valid organization ID.`,
            details: 'The specified organization ID is not present in the orgs table.'
          },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Organization ID is required. Unable to determine organization from user context.' },
        { status: 400 },
      );
    }

    // Use authenticated user.id for created_by (ignore client-provided created_by)
    const createdBy = user.id;

    // Email is required for principals (non-student users can login)
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required for principals' },
        { status: 400 },
      );
    }

    // Create user auth entry
    // TypeScript now knows email is string after the check above
    const displayName = [first_name, last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    const { data: authData, error: authError } = await createUserAuthEntry(
      email as string,
      'test123456',
      'principal',
      displayName || undefined,
    );
    if (authError) {
      const message =
        (authError as any)?.message || 'Error creating user auth entry';
      console.error('❌ Error creating user auth entry:', authError);
      return NextResponse.json({ error: message }, { status: 500 });
    }
    if (!authData || !(authData as any).user) {
      console.error('❌ No auth user returned from createUserAuthEntry');
      return NextResponse.json(
        { error: 'No auth user returned' },
        { status: 500 },
      );
    }

    // Generate UUID if not provided
    const principalId = (authData as any).user.id;

    // Update auth user metadata
    try {
      const userMetadata: UserMetadata = {
        roles: ['principal'],
        activeRole: 'principal',
        org_id: orgId,
      };

      await adminClient.auth.admin.updateUserById(principalId, {
        user_metadata: userMetadata,
      });
    } catch (e) {
      console.warn('⚠️ Failed to update auth metadata for principal:', e);
    }

    // Prepare the principal data with all required fields
    const principalDataBase: any = {
      id: principalId,
      email: email || null,
      phone: phone || null,
      first_name: first_name,
      last_name: last_name || null,
      org_id: orgId,
      is_active: is_active !== undefined ? is_active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    const principalDataNoRole = { ...principalDataBase };
    const principalDataWithRole = {
      ...principalDataBase,
      role: 'principal' as any,
    };

    console.log('🔧 Creating principal (attempt with role) data:', principalDataWithRole);

    let data: any = null;
    let error: any = null;

    // Step 1: Try upsert with role column
    {
      const result = await adminClient
        .from('users')
        .upsert(principalDataWithRole, { onConflict: 'id' })
        .select('*')
        .single();
      data = result.data;
      error = result.error;
    }

    // If role column is missing or enum mismatch, retry without role and try role_id
    if (
      error &&
      typeof error.message === 'string' &&
      error.message.includes('column') &&
      error.message.includes('role')
    ) {
      console.warn('⚠️ users.role not found, retrying without role...');
      const retry = await adminClient
        .from('users')
        .upsert(principalDataNoRole, { onConflict: 'id' })
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;

      // Attempt to set role_id if present
      if (!error) {
        const setRoleId = await adminClient
          .from('users')
          .update({
            role_id: PRINCIPAL_ROLE_ID,
            updated_at: new Date().toISOString(),
          })
          .eq('id', principalId)
          .select('*')
          .single();
        if (setRoleId.error) {
          console.warn(
            '⚠️ Failed to set role_id on principal after fallback:',
            setRoleId.error,
          );
        } else if (setRoleId.data) {
          data = setRoleId.data;
        }
      }
    }

    if (error) {
      console.error('❌ Error creating principal:', error);
      
      // Check for phone format constraint violation
      const phoneFormatError = getPhoneFormatErrorMessage(error);
      if (phoneFormatError) {
        return NextResponse.json(
          { error: phoneFormatError },
          { status: 400 },
        );
      }
      
      // Check for foreign key constraint violation
      const foreignKeyError = getForeignKeyErrorMessage(error);
      if (foreignKeyError) {
        return NextResponse.json(
          { 
            error: foreignKeyError,
            details: error.details || '',
          },
          { status: 400 },
        );
      }
      
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Principal created successfully:', data);

    const includeRole =
      data && Object.prototype.hasOwnProperty.call(data, 'role');
    const includeRoleId =
      data && Object.prototype.hasOwnProperty.call(data, 'role_id');
    const principal = {
      id: data.id,
      org_id: data.org_id,
      email: data.email,
      phone: data.phone,
      role: 'principal',
      ...(includeRole ? { role: (data as any).role } : {}),
      ...(includeRoleId ? { role_id: (data as any).role_id } : {}),
      is_active: data.is_active,
      created_at: data.created_at,
      updated_at: data.updated_at,
      deleted_at: data.deleted_at,
    };

    return NextResponse.json(
      {
        principal,
        message: 'Principal created successfully',
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('💥 Error in principal creation:', err);
    
    // Check for phone format constraint violation
    const phoneFormatError = getPhoneFormatErrorMessage(err);
    if (phoneFormatError) {
      return NextResponse.json(
        { error: phoneFormatError },
        { status: 400 },
      );
    }
    
    // Check for foreign key constraint violation
    const foreignKeyError = getForeignKeyErrorMessage(err);
    if (foreignKeyError) {
      return NextResponse.json(
        { 
          error: foreignKeyError,
          details: err.details || '',
        },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * Handler for PUT /api/principals
 * Updates an existing principal
 */
export async function handlePutPrincipal(
  request: Request,
  _user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const body = await request.json();
    const bodyValidation = validateBody(putPrincipalBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { id, first_name, last_name, org_id, is_active, email, phone } =
      bodyValidation.data;
    const roleExists = await hasUsersColumn('role', adminClient);
    const roleIdExists = await hasUsersColumn('role_id', adminClient);

    const patch: any = {
      updated_at: new Date().toISOString(),
    };

    // Update name fields if provided
    if (first_name !== undefined) patch.first_name = first_name;
    if (last_name !== undefined) patch.last_name = last_name;
    if (org_id !== undefined) patch.org_id = org_id;
    if (is_active !== undefined) patch.is_active = is_active;
    if (email !== undefined) patch.email = email;
    if (phone !== undefined) patch.phone = phone;

    console.log('🔧 Updating principal with data:', patch);

    const { data, error } = await adminClient
      .from('users')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error updating principal:', error);
      
      // Check for phone format constraint violation
      const phoneFormatError = getPhoneFormatErrorMessage(error);
      if (phoneFormatError) {
        return NextResponse.json(
          { error: phoneFormatError },
          { status: 400 },
        );
      }
      
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Principal updated successfully:', data);

    const principal = {
      id: data.id,
      org_id: data.org_id,
      email: data.email,
      phone: data.phone,
      role: 'principal',
      ...(roleExists &&
      Object.prototype.hasOwnProperty.call(data, 'role')
        ? { role: (data as any).role }
        : {}),
      ...(roleIdExists ? { role_id: (data as any).role_id } : {}),
      is_active: data.is_active,
      created_at: data.created_at,
      updated_at: data.updated_at,
      deleted_at: data.deleted_at,
    };

    return NextResponse.json(
      {
        principal,
        message: 'Principal updated successfully',
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('💥 Error in principal update:', err);
    
    // Check for phone format constraint violation
    const phoneFormatError = getPhoneFormatErrorMessage(err);
    if (phoneFormatError) {
      return NextResponse.json(
        { error: phoneFormatError },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * Handler for DELETE /api/principals
 * Soft deletes a principal by setting deleted_at timestamp
 */
export async function handleDeletePrincipal(
  request: Request,
  _user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(
      deletePrincipalQuerySchema,
      searchParams,
    );
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { id } = queryValidation.data;

    console.log('🗑️ Soft deleting principal:', id);

    // Soft delete - set deleted_at timestamp
    const roleExistsForDelete = await hasUsersColumn('role', adminClient);
    const roleIdExistsForDelete = await hasUsersColumn(
      'role_id',
      adminClient,
    );
    const deleteQuery = adminClient
      .from('users')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    const { error } = roleExistsForDelete
      ? await deleteQuery.eq('role', 'principal')
      : roleIdExistsForDelete
        ? await deleteQuery.eq('role_id', PRINCIPAL_ROLE_ID)
        : await deleteQuery;

    if (error) {
      console.error('❌ Error deleting principal:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Principal soft deleted successfully');

    return NextResponse.json(
      {
        success: true,
        message: 'Principal deleted successfully',
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('💥 Error in principal deletion:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}

