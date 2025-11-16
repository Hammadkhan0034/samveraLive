import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { createUserAuthEntry } from 'app/core/createAuthEntry'
import { getUserDataCacheHeaders } from '@/lib/cacheConfig'
import { z } from 'zod'
import { validateQuery, validateBody, orgIdSchema, uuidSchema, firstNameSchema, lastNameSchema, emailSchema, phoneSchema } from '@/lib/validation'

// Note: Some databases may not have a dedicated role_id column on public.users
// We'll avoid relying on role_id in this route
const PRINCIPAL_ROLE_ID = 30

// GET query parameter schema
const getPrincipalsQuerySchema = z.object({
  orgId: orgIdSchema.optional(),
});

// POST body schema
const postPrincipalBodySchema = z.object({
  id: uuidSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema,
  first_name: firstNameSchema,
  last_name: lastNameSchema.optional(),
  org_id: orgIdSchema,
  is_active: z.boolean().optional(),
  created_by: uuidSchema.optional(),
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

const usersColumnCache: Record<string, boolean> = {}
async function hasUsersColumn(columnName: string): Promise<boolean> {
  if (columnName in usersColumnCache) return usersColumnCache[columnName]
  try {
    if (!supabaseAdmin) {
      usersColumnCache[columnName] = false
      return false
    }
    const { data, error } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'users')
      .eq('column_name', columnName)
      .limit(1)
    if (error) {
      console.warn(`⚠️ Could not inspect columns for users.${columnName}:`, error)
      usersColumnCache[columnName] = false
      return false
    }
    usersColumnCache[columnName] = Array.isArray(data) && data.length > 0
    return usersColumnCache[columnName]
  } catch (e) {
    console.warn(`⚠️ Exception checking users.${columnName} column:`, e)
    usersColumnCache[columnName] = false
    return false
  }
}

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured');
      return NextResponse.json({ error: 'Admin client not configured. Please check SUPABASE_SERVICE_ROLE_KEY in .env.local' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(getPrincipalsQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { orgId } = queryValidation.data
    
    const roleExists = await hasUsersColumn('role')
    const roleIdExists = await hasUsersColumn('role_id')
    const metadataExists = await hasUsersColumn('metadata')
    
    // Try to detect role column by attempting a test query
    let roleColumnDetected = roleExists
    if (!roleExists) {
      try {
        // Test if role column exists by attempting a simple query
        const testQuery = supabaseAdmin.from('users').select('role').limit(1)
        const { data: testData, error: testError } = await testQuery
        if (!testError && testData !== null) {
          roleColumnDetected = true
          console.log('✅ Role column detected via test query')
        } else {
          console.log('⚠️ Role column test query failed:', testError?.message || 'unknown error')
        }
      } catch (e) {
        console.log('⚠️ Role column test query exception:', e)
      }
    }
    
    let q = supabaseAdmin
      .from('users')
      .select('*')
      .is('deleted_at', null) // Only get non-deleted principals
      .order('created_at', { ascending: false })

    // Always filter by role='principal' to ensure only principals are shown
    // Even if guardian/student is added by admin/principal, they should not appear in principals table
    // This is CRITICAL to prevent guardians/students from showing up when they're created
    let filterApplied = false
    if (roleColumnDetected) {
      // Strictly filter by role='principal' only
      q = q.eq('role', 'principal')
      filterApplied = true
      console.log('✅ Filtering principals by role="principal"')
    } else if (roleIdExists) {
      q = q.eq('role_id', PRINCIPAL_ROLE_ID)
      filterApplied = true
      console.log('✅ Filtering principals by role_id=', PRINCIPAL_ROLE_ID)
    } else if (metadataExists) {
      q = q.contains('metadata', { activeRole: 'principal' })
      filterApplied = true
      console.log('✅ Filtering principals by metadata.activeRole="principal"')
    }
      
    if (orgId) q = q.eq('org_id', orgId)
    
    const { data, error } = await q
    
    // If query failed and we didn't apply filter, try fallback: fetch all and filter in-memory
    if (error && !filterApplied) {
      console.warn('⚠️ Query failed without filter, trying fallback approach:', error.message)
      // Try fetching without role filter and filter in-memory
      let fallbackQuery = supabaseAdmin
        .from('users')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (orgId) fallbackQuery = fallbackQuery.eq('org_id', orgId)
      
      const { data: fallbackData, error: fallbackError } = await fallbackQuery
      if (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError)
        return NextResponse.json({ error: fallbackError.message }, { status: 500 })
      }
      
      // Filter in-memory: only include records with role='principal'
      const filtered = (fallbackData || []).filter((u: any) => {
        if (u.role === 'principal') return true
        if (u.role_id === PRINCIPAL_ROLE_ID) return true
        if (u.metadata?.activeRole === 'principal') return true
        return false
      })
      
      const principals = filtered.map((u: any) => ({
        id: u.id,
        org_id: u.org_id,
        email: u.email,
        phone: u.phone,
        first_name: u.first_name || null,
        last_name: u.last_name || null,
        full_name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || null,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || null,
        role: 'principal',
        ...(u.role ? { role: u.role } : {}),
        ...(u.role_id ? { role_id: u.role_id } : {}),
        is_active: u.is_active,
        created_at: u.created_at,
        updated_at: u.updated_at,
        deleted_at: u.deleted_at
      }))
      
      console.log('✅ Returning principals (fallback filtered):', principals.length, 'principals')
      return NextResponse.json({ principals }, { status: 200 })
    }
    
    if (error) {
      // Handle fetch errors (network issues, connection problems)
      const errorMessage = error.message || (typeof error === 'string' ? error : 'Unknown error');
      const isFetchError = errorMessage.includes('fetch failed') || errorMessage.includes('TypeError: fetch failed');
      
      console.error('❌ Error fetching principals:', {
        message: errorMessage,
        details: (error as any)?.details || '',
        hint: (error as any)?.hint || '',
        code: (error as any)?.code || '',
        isFetchError
      });
      
      // If it's a fetch error, provide more helpful message
      if (isFetchError) {
        return NextResponse.json({ 
          error: 'Database connection failed. Please check your Supabase configuration and network connection.',
          details: errorMessage
        }, { status: 503 }); // 503 Service Unavailable
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: (error as any)?.details || ''
      }, { status: 500 })
    }
    
    // Double-check: Filter out any records that don't have role='principal'
    // This is a safety measure in case the query filter didn't work properly
    let filteredData = data || []
    if (Array.isArray(filteredData)) {
      const beforeCount = filteredData.length
      filteredData = filteredData.filter((u: any) => {
        // Accept if role is 'principal' OR role_id matches OR metadata has principal
        return u.role === 'principal' || 
               u.role_id === PRINCIPAL_ROLE_ID || 
               u.metadata?.activeRole === 'principal'
      })
      if (beforeCount !== filteredData.length) {
        console.log(`✅ Filtered principals: ${beforeCount} -> ${filteredData.length} (removed non-principals)`)
      }
    }
    
    console.log('✅ Fetched principals:', filteredData?.length || 0)
    
    const principals = (filteredData || []).map((u: any) => ({
      id: u.id,
      org_id: u.org_id,
      email: u.email,
      phone: u.phone,
      first_name: u.first_name || null,
      last_name: u.last_name || null,
      full_name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || null,
      name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || null,
      role: 'principal',
      ...(roleExists ? { role: u.role } : {}),
      ...(roleIdExists ? { role_id: u.role_id } : {}),
      is_active: u.is_active,
      created_at: u.created_at,
      updated_at: u.updated_at,
      deleted_at: u.deleted_at
    }))
    
    console.log('✅ Returning principals:', principals.length, 'principals')
    return NextResponse.json({ principals }, { 
      status: 200,
      headers: getUserDataCacheHeaders()
    })
  } catch (err: any) {
    const errorMessage = err?.message || (typeof err === 'string' ? err : 'Unknown error');
    const isFetchError = errorMessage.includes('fetch failed') || errorMessage.includes('TypeError: fetch failed');
    
    console.error('💥 Error in principals GET:', {
      message: errorMessage,
      details: err?.details || '',
      stack: err?.stack || '',
      isFetchError
    });
    
    // If it's a fetch error, provide more helpful message
    if (isFetchError) {
      return NextResponse.json({ 
        error: 'Database connection failed. Please check your Supabase configuration and network connection.',
        details: errorMessage
      }, { status: 503 }); // 503 Service Unavailable
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: err?.details || ''
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const body = await request.json()
    const bodyValidation = validateBody(postPrincipalBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { 
      id, 
      email, 
      phone, 
      first_name,
      last_name,
      org_id, 
      is_active,
      created_by 
    } = bodyValidation.data

    // Create user auth entry
    const displayName = [first_name, last_name].filter(Boolean).join(' ').trim() || undefined
    const { data: authData, error: authError } = await createUserAuthEntry(email, "test123456", 'principal', displayName)
    if (authError) {
      const message = (authError as any)?.message || 'Error creating user auth entry'
      console.error('❌ Error creating user auth entry:', authError)
      return NextResponse.json({ error: message }, { status: 500 })
    }
    if (!authData || !(authData as any).user) {
      console.error('❌ No auth user returned from createUserAuthEntry')
      return NextResponse.json({ error: 'No auth user returned' }, { status: 500 })
    }
    
    // Generate UUID if not provided
    const principalId = (authData as any).user.id
    
    // Update auth user metadata to include displayName and profile fields
    try {
      await supabaseAdmin.auth.admin.updateUserById(principalId, {
        user_metadata: {
          full_name: displayName || '',
          name: displayName || '',
          displayName: displayName || '',
          first_name: first_name || '',
          last_name: last_name || '',
          org_id,
          phone: phone || null,
          roles: ['principal'],
          activeRole: 'principal',
        }
      })
    } catch (e) {
      console.warn('⚠️ Failed to update auth metadata for principal:', e)
    }

    // Prepare the principal data with all required fields
    const principalDataBase: any = {
      id: principalId,
      email: email || null,
      phone: phone || null,
      first_name: first_name,
      last_name: last_name || null,
      org_id,
      is_active: is_active !== undefined ? is_active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    }
    const principalDataNoRole = { ...principalDataBase }
    const principalDataWithRole = { ...principalDataBase, role: 'principal' as any }

    console.log('🔧 Creating principal (attempt with role) data:', principalDataWithRole)

    let data: any = null
    let error: any = null

    // Step 1: Try upsert with role column
    {
      const result = await supabaseAdmin
        .from('users')
        .upsert(principalDataWithRole, { onConflict: 'id' })
        .select('*')
        .single()
      data = result.data
      error = result.error
    }

    // If role column is missing or enum mismatch, retry without role and try role_id
    if (error && typeof error.message === 'string' && (error.message.includes('column') && error.message.includes('role'))) {
      console.warn('⚠️ users.role not found, retrying without role...')
      const retry = await supabaseAdmin
        .from('users')
        .upsert(principalDataNoRole, { onConflict: 'id' })
        .select('*')
        .single()
      data = retry.data
      error = retry.error

      // Attempt to set role_id if present
      if (!error) {
        const setRoleId = await supabaseAdmin
          .from('users')
          .update({ role_id: PRINCIPAL_ROLE_ID, updated_at: new Date().toISOString() })
          .eq('id', principalId)
          .select('*')
          .single()
        if (setRoleId.error) {
          console.warn('⚠️ Failed to set role_id on principal after fallback:', setRoleId.error)
        } else if (setRoleId.data) {
          data = setRoleId.data
        }
      }
    }
      
    if (error) {
      console.error('❌ Error creating principal:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log('✅ Principal created successfully:', data)
    
    const includeRole = data && Object.prototype.hasOwnProperty.call(data, 'role')
    const includeRoleId = data && Object.prototype.hasOwnProperty.call(data, 'role_id')
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
      deleted_at: data.deleted_at
    }
    
    return NextResponse.json({ 
      principal,
      message: 'Principal created successfully'
    }, { status: 201 })
  } catch (err: any) {
    console.error('💥 Error in principal creation:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const body = await request.json()
    const bodyValidation = validateBody(putPrincipalBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { id, first_name, last_name, org_id, is_active, email, phone } = bodyValidation.data
    const roleExists = await hasUsersColumn('role')
    const roleIdExists = await hasUsersColumn('role_id')
    
    const patch: any = {
      updated_at: new Date().toISOString()
    }
    
    // Update name fields if provided
    if (first_name !== undefined) patch.first_name = first_name
    if (last_name !== undefined) patch.last_name = last_name
    if (org_id !== undefined) patch.org_id = org_id
    if (is_active !== undefined) patch.is_active = is_active
    if (email !== undefined) patch.email = email
    if (phone !== undefined) patch.phone = phone
    
    
    console.log('🔧 Updating principal with data:', patch)
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
      
    if (error) {
      console.error('❌ Error updating principal:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log('✅ Principal updated successfully:', data)
    
    const principal = {
      id: data.id,
      org_id: data.org_id,
      email: data.email,
      phone: data.phone,
      role: 'principal',
      ...(roleExists && Object.prototype.hasOwnProperty.call(data, 'role') ? { role: (data as any).role } : {}),
      ...(roleIdExists ? { role_id: (data as any).role_id } : {}),
      is_active: data.is_active,
      created_at: data.created_at,
      updated_at: data.updated_at,
      deleted_at: data.deleted_at
    }
    
    return NextResponse.json({ 
      principal,
      message: 'Principal updated successfully'
    }, { status: 200 })
  } catch (err: any) {
    console.error('💥 Error in principal update:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(deletePrincipalQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { id } = queryValidation.data
    
    console.log('🗑️ Soft deleting principal:', id)
    
    // Soft delete - set deleted_at timestamp
    const roleExistsForDelete = await hasUsersColumn('role')
    const roleIdExistsForDelete = await hasUsersColumn('role_id')
    const deleteQuery = supabaseAdmin
      .from('users')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    const { error } = roleExistsForDelete
      ? await deleteQuery.eq('role', 'principal')
      : (roleIdExistsForDelete ? await deleteQuery.eq('role_id', PRINCIPAL_ROLE_ID) : await deleteQuery)
      
    if (error) {
      console.error('❌ Error deleting principal:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log('✅ Principal soft deleted successfully')
    
    return NextResponse.json({ 
      success: true,
      message: 'Principal deleted successfully'
    }, { status: 200 })
  } catch (err: any) {
    console.error('💥 Error in principal deletion:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}


