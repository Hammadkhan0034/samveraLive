import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getStableDataCacheHeaders } from '@/lib/cacheConfig'
import { requireServerAuth } from '@/lib/supabaseServer'
import { getAuthUserWithOrg, MissingOrgIdError, mapAuthErrorToResponse } from '@/lib/server-helpers'
import { z } from 'zod'
import { validateQuery, validateBody, classIdSchema, userIdSchema, dateSchema, notesSchema, uuidSchema } from '@/lib/validation'

export async function GET(request: Request) {
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
  
  // Check if user has a valid role (principal, admin, teacher, or parent)
  const userRoles = user.user_metadata?.roles || [];
  const hasAccess = userRoles.some((role: string) => ['principal', 'admin', 'teacher', 'parent'].includes(role));
  
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Access denied. Valid role required.' 
    }, { status: 403 });
  }

  // Check if user is a teacher - teachers should only see menus they created
  const isTeacher = userRoles.some((role: string) => role === 'teacher');

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    // GET query parameter schema - orgId and createdBy removed, now fetched server-side
    const getMenusQuerySchema = z.object({
      classId: classIdSchema.optional(),
      day: dateSchema.optional(),
    });
    
    const queryValidation = validateQuery(getMenusQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { classId, day } = queryValidation.data

    let query = supabaseAdmin
      .from('menus')
      .select('id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_by,created_at,updated_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('day', { ascending: false })

    
    if (classId) {
      query = query.eq('class_id', classId)
    }
    // If no classId, don't filter - show all menus for the org

    // For teachers, automatically filter by created_by to show only their menus
    if (isTeacher) {
      query = query.eq('created_by', user.id)
    }

    if (day) {
      query = query.eq('day', day)
    }

    const { data: menus, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      menus: menus || [],
      total_menus: menus?.length || 0
    }, {
      status: 200,
      headers: getStableDataCacheHeaders()
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
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

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    // POST body schema - org_id removed, now fetched server-side
    const postMenuBodySchema = z.object({
      class_id: classIdSchema.optional(),
      day: dateSchema,
      breakfast: z.string().max(1000).nullable().optional(),
      lunch: z.string().max(1000).nullable().optional(),
      snack: z.string().max(1000).nullable().optional(),
      notes: notesSchema,
      is_public: z.boolean().default(true),
      created_by: userIdSchema.optional(),
    });
    
    const bodyValidation = validateBody(postMenuBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { class_id, day, breakfast, lunch, snack, notes, is_public, created_by } = bodyValidation.data
    
    // Ensure class_id is null if not provided or empty string
    const finalClassId = class_id && class_id.trim() !== '' ? class_id : null
    
    // Check if menu already exists for this org_id, class_id, and day
    let query = supabaseAdmin
      .from('menus')
      .select('id')
      .eq('org_id', orgId)
      .eq('day', day)
      .is('deleted_at', null)
    
    if (finalClassId) {
      query = query.eq('class_id', finalClassId)
    } else {
      query = query.is('class_id', null)
    }
    
    const { data: existing, error: checkError } = await query.maybeSingle()
    
    // If there's an error (other than "no rows found"), handle it
    if (checkError) {
      // Only return error if it's not the "no rows" error
      if (checkError.code !== 'PGRST116') {
        // Check if it's a network error
        const isNetworkError = checkError.message?.includes('fetch failed') || 
                              checkError.message?.includes('timeout') ||
                              checkError.message?.includes('Connect Timeout');
        if (isNetworkError) {
          return NextResponse.json({ 
            error: 'Network error. Please check your connection and try again.',
            retryable: true
          }, { status: 503 })
        }
        return NextResponse.json({ error: `Failed to check for existing menu: ${checkError.message}` }, { status: 500 })
      }
    }
    
    let result;
    if (existing?.id) {
      // Update existing menu - only update provided fields
      const updatePayload: any = { deleted_at: null };
      if (breakfast !== undefined) updatePayload.breakfast = breakfast || null;
      if (lunch !== undefined) updatePayload.lunch = lunch || null;
      if (snack !== undefined) updatePayload.snack = snack || null;
      if (notes !== undefined) updatePayload.notes = notes || null;
      if (is_public !== undefined) updatePayload.is_public = is_public;

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('menus')
        .update(updatePayload)
        .eq('id', existing.id)
        .select('id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_at,updated_at')
        .single()
      
      if (updateError) {
        // Check if it's a network error
        const isNetworkError = updateError.message?.includes('fetch failed') || 
                              updateError.message?.includes('timeout') ||
                              updateError.message?.includes('Connect Timeout');
        if (isNetworkError) {
          return NextResponse.json({ 
            error: 'Network error. Please check your connection and try again.',
            retryable: true
          }, { status: 503 })
        }
        return NextResponse.json({ error: `Failed to update menu: ${updateError.message}` }, { status: 500 })
      }
      
      result = updated
    } else {
      // Insert new menu
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('menus')
        .insert({
          org_id: orgId,
          class_id: finalClassId,
          day,
          breakfast: breakfast || null,
          lunch: lunch || null,
          snack: snack || null,
          notes: notes || null,
          is_public: is_public !== undefined ? is_public : true,
          created_by: created_by || user.id,
          deleted_at: null,
        })
        .select('id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_by,created_at,updated_at')
        .single()
      
      if (insertError) {
        // Check if it's a network error
        const isNetworkError = insertError.message?.includes('fetch failed') || 
                              insertError.message?.includes('timeout') ||
                              insertError.message?.includes('Connect Timeout');
        if (isNetworkError) {
          return NextResponse.json({ 
            error: 'Network error. Please check your connection and try again.',
            retryable: true
          }, { status: 503 })
        }
        return NextResponse.json({ error: `Failed to create menu: ${insertError.message}` }, { status: 500 })
      }
      
      result = inserted
    }

    return NextResponse.json({ 
      menu: result,
      message: 'Menu created/updated successfully!'
    }, { status: 201 })

  } catch (err: any) {
    // Check if it's a network/fetch error
    const isNetworkError = err?.message?.includes('fetch failed') || 
                          err?.message?.includes('timeout') ||
                          err?.message?.includes('Connect Timeout') ||
                          err?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                          err?.name === 'AuthRetryableFetchError';
    
    if (isNetworkError) {
      // Return a retryable error message
      return NextResponse.json({ 
        error: 'Network error. Please check your connection and try again.',
        retryable: true
      }, { status: 503 }) // 503 Service Unavailable for retryable errors
    }
    
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await requireServerAuth()
  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (authError.message === 'Network error - please retry') {
      // For network errors, allow request to continue - client will retry
      // Return empty data instead of error
      return NextResponse.json({ menus: [], total_menus: 0 }, {
        status: 200,
        headers: getStableDataCacheHeaders()
      })
    }
    throw authError
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    // PUT body schema
    const putMenuBodySchema = z.object({
      id: uuidSchema,
      breakfast: z.string().max(1000).nullable().optional(),
      lunch: z.string().max(1000).nullable().optional(),
      snack: z.string().max(1000).nullable().optional(),
      notes: notesSchema,
      is_public: z.boolean().optional(),
    });
    
    const bodyValidation = validateBody(putMenuBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { id, breakfast, lunch, snack, notes, is_public } = bodyValidation.data


    const { data: updated, error } = await supabaseAdmin
      .from('menus')
      .update({
        breakfast: breakfast !== undefined ? breakfast : null,
        lunch: lunch !== undefined ? lunch : null,
        snack: snack !== undefined ? snack : null,
        notes: notes !== undefined ? notes : null,
        is_public: is_public !== undefined ? is_public : true,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_at,updated_at')
      .single()

    if (error) {
      return NextResponse.json({ error: `Failed to update menu: ${error.message}` }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      menu: updated,
      message: 'Menu updated successfully!'
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requireServerAuth()
  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (authError.message === 'Network error - please retry') {
      // For network errors, allow request to continue - client will retry
      // Return empty data instead of error
      return NextResponse.json({ menus: [], total_menus: 0 }, {
        status: 200,
        headers: getStableDataCacheHeaders()
      })
    }
    throw authError
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    // DELETE query parameter schema
    const deleteMenuQuerySchema = z.object({
      id: uuidSchema,
    });
    
    const queryValidation = validateQuery(deleteMenuQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { id } = queryValidation.data


    // Soft delete by setting deleted_at
    const { error } = await supabaseAdmin
      .from('menus')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Menu deleted successfully!'
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

