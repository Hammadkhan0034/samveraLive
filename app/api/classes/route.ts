import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getStableDataCacheHeaders } from '@/lib/cacheConfig'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { validateQuery, validateBody, orgIdSchema, userIdSchema, nameSchema, codeSchema, classIdSchema } from '@/lib/validation'

// Teacher role ID
const TEACHER_ROLE_ID = 20

// GET query parameter schema
const getClassesQuerySchema = z.object({
  orgId: orgIdSchema.optional(),
  createdBy: userIdSchema.optional(),
});

// POST body schema
const postClassBodySchema = z.object({
  name: nameSchema,
  code: codeSchema.optional(),
  created_by: userIdSchema,
  teacher_id: userIdSchema.optional(),
  org_id: orgIdSchema.optional(),
});

// DELETE query parameter schema
const deleteClassQuerySchema = z.object({
  id: classIdSchema,
});

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Admin client not configured');
      return NextResponse.json({
        error: 'Admin client not configured'
      }, { status: 500 })
    }

    // Authenticate and check role
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Ignore cookie setting errors in route handlers
            }
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user has principal, admin, or teacher role
    const userRoles = user.user_metadata?.roles || [];
    const hasAccess = userRoles.some((role: string) => ['principal', 'admin', 'teacher'].includes(role));
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied. Principal, admin, or teacher role required.' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(getClassesQuerySchema, searchParams)
    if (!queryValidation.success) {
      console.error('❌ Query validation failed:', queryValidation.error);
      return queryValidation.error
    }
    const { orgId, createdBy } = queryValidation.data

    let query = supabaseAdmin
      .from('classes')
      .select(`
        id,
        name,
        code,
        org_id,
        created_by,
        created_at,
        updated_at,
        assigned_teachers:class_memberships!class_id(user_id, membership_role)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Filter by creator (principal) if provided
    if (createdBy) {
      query = query.eq('created_by', createdBy)
    }

    // Filter by organization if provided
    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: classes, error } = await query

    if (error) {
      console.error('❌ Error fetching classes:', error);
      const isNetworkError = error.message?.includes('fetch failed') || 
                            error.message?.includes('timeout') ||
                            error.name === 'AuthRetryableFetchError';
      
      if (isNetworkError) {
        return NextResponse.json({ 
          error: 'Database connection failed. Please check your connection and try again.',
          retryable: true
        }, { status: 503 });
      }
      
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get assigned teachers for each class using class_memberships and staff tables
    const classesWithTeachers = supabaseAdmin ? await Promise.all(
      (classes || []).map(async (cls) => {
        try {
          // Use cls.org_id if orgId is not provided
          const filterOrgId = orgId || cls.org_id;
          
          if (!filterOrgId) {
            console.warn('⚠️ No org_id available for class:', cls.id);
            return {
              ...cls,
              assigned_teachers: []
            };
          }

          const { data: memberships, error: membershipError } = await supabaseAdmin!
            .from('class_memberships')
            .select(`
              user_id,
              membership_role,
              users!inner(id, first_name, last_name, email)
            `)
            .eq('class_id', cls.id)
            .eq('membership_role', 'teacher')
            .eq('org_id', filterOrgId)

          if (membershipError) {
            console.error('❌ Error fetching memberships for class:', cls.id, membershipError);
            // Continue with empty teachers list
          }

          // Return ALL teachers from class_memberships, not just those in staff table
          // This is important for guardians/parents who need to see teachers assigned to their children's classes
          // even if the teacher is not in the staff table
          const teachers = memberships?.map((m: any) => {
            const firstName = m.users?.first_name || ''
            const lastName = m.users?.last_name || ''
            const fullName = `${firstName} ${lastName}`.trim() || 'Unknown'
            return {
              id: m.users?.id,
              full_name: fullName,
              first_name: m.users?.first_name,
              last_name: m.users?.last_name,
              email: m.users?.email
            }
          }) || []

          return {
            ...cls,
            assigned_teachers: teachers
          }
        } catch (classError: any) {
          console.error('❌ Error processing class:', cls.id, classError);
          // Return class without teachers if there's an error
          return {
            ...cls,
            assigned_teachers: []
          };
        }
      })
    ) : classes || []

    return NextResponse.json({
      classes: classesWithTeachers || []
    }, {
      status: 200,
      headers: getStableDataCacheHeaders()
    })

  } catch (err: any) {
    console.error('❌ Error in classes GET:', err);
    const errorMessage = err?.message || (typeof err === 'string' ? err : 'Unknown error');
    const isNetworkError = errorMessage.includes('fetch failed') || 
                          errorMessage.includes('timeout') ||
                          err?.name === 'AuthRetryableFetchError';
    
    if (isNetworkError) {
      return NextResponse.json({ 
        error: 'Database connection failed. Please check your connection and try again.',
        retryable: true
      }, { status: 503 });
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({
        error: 'Admin client not configured'
      }, { status: 500 })
    }

    const body = await request.json()
    const bodyValidation = validateBody(postClassBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { name, code, created_by, teacher_id, org_id } = bodyValidation.data

    // Get organization ID from user if not provided
    let organizationId = org_id;
    let actualCreatedBy = created_by;

    if (!organizationId) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('org_id')
        .eq('id', created_by)
        .single();

      organizationId = userData?.org_id;
    }

    // Try to find the user in the users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, org_id')
      .eq('id', created_by)
      .single();

    if (existingUser) {
      actualCreatedBy = existingUser.id;
      if (!organizationId) {
        organizationId = existingUser.org_id;
      }
    } else {
      // If user doesn't exist in users table, find any user from the organization
      if (organizationId) {
        const { data: orgUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('org_id', organizationId)
          .limit(1)
          .single();

        if (orgUser) {
          actualCreatedBy = orgUser.id;
        }
      }
    }

    if (!organizationId) {
      return NextResponse.json({
        error: 'Organization ID is required'
      }, { status: 400 })
    }

    // If we still don't have a valid created_by user, use null
    // Don't create system users automatically

    // Create class
    const { data: newClass, error: classError } = await supabaseAdmin
      .from('classes')
      .insert({
        name: name,
        code: code || null,
        created_by: actualCreatedBy || null,
        org_id: organizationId
      })
      .select()
      .single()

    if (classError) {
      return NextResponse.json({ error: `Failed to create class: ${classError.message}` }, { status: 500 })
    }

    // If teacher_id provided, assign teacher to class
    if (teacher_id) {
      // Get current teacher metadata
      const { data: teacher } = await supabaseAdmin
        .from('users')
        .select('metadata')
        .eq('id', teacher_id)
        .single()

      // Update teacher metadata with class_id
      const updatedMetadata = {
        ...(teacher?.metadata || {}),
        class_id: newClass.id
      }

      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ metadata: updatedMetadata })
        .eq('id', teacher_id)

      if (updateError) {
        // Continue - metadata update is non-critical
      }

      // Also update auth.users metadata
      await supabaseAdmin.auth.admin.updateUserById(teacher_id, {
        user_metadata: {
          ...updatedMetadata,
          class_id: newClass.id
        }
      })

      // Also create class_memberships row with org_id
      const { error: cmError } = await supabaseAdmin
        .from('class_memberships')
        .insert({
          org_id: organizationId,
          class_id: newClass.id,
          user_id: teacher_id,
          membership_role: 'teacher'
        })
      if (cmError) {
        // Continue - membership creation is non-critical
      }
    }

    return NextResponse.json({
      class: newClass,
      message: teacher_id ? 'Class created and teacher assigned' : 'Class created successfully'
    }, { status: 201 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

// PUT body schema
const putClassBodySchema = z.object({
  id: classIdSchema,
  name: nameSchema.optional(),
  code: codeSchema,
  teacher_id: userIdSchema.optional(),
});

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({
        error: 'Admin client not configured'
      }, { status: 500 })
    }

    const body = await request.json()
    const bodyValidation = validateBody(putClassBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { id, name, code, teacher_id } = bodyValidation.data

    // Update class
    const updateData: any = { updated_at: new Date().toISOString() }
    if (name) updateData.name = name
    if (code !== undefined) updateData.code = code

    const { data: updatedClass, error: classError } = await supabaseAdmin
      .from('classes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (classError) {
      return NextResponse.json({ error: classError.message }, { status: 500 })
    }

    // If teacher_id provided, update assignment
    if (teacher_id) {
      // Get current teacher metadata
      const { data: teacher } = await supabaseAdmin
        .from('users')
        .select('metadata')
        .eq('id', teacher_id)
        .single()

      // Update teacher metadata with class_id
      const updatedMetadata = {
        ...(teacher?.metadata || {}),
        class_id: id
      }

      await supabaseAdmin
        .from('users')
        .update({ metadata: updatedMetadata })
        .eq('id', teacher_id)

      // Also update auth.users metadata
      await supabaseAdmin.auth.admin.updateUserById(teacher_id, {
        user_metadata: {
          ...updatedMetadata,
          class_id: id
        }
      })

      // Create/ensure class_memberships with org_id
      // First fetch class org_id
      let classOrgId: string | null = null
      try {
        const { data: classRow } = await supabaseAdmin
          .from('classes')
          .select('org_id')
          .eq('id', id)
          .single()
        classOrgId = classRow?.org_id || null
      } catch {}

      if (classOrgId) {
        const { error: cmUpsertError } = await supabaseAdmin
          .from('class_memberships')
          .upsert({
            org_id: classOrgId,
            class_id: id,
            user_id: teacher_id,
            membership_role: 'teacher'
          }, { onConflict: 'class_id,user_id' })
        if (cmUpsertError) {
          // Continue - membership update is non-critical
        }
      }
    }

    return NextResponse.json({ class: updatedClass }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({
        error: 'Admin client not configured'
      }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(deleteClassQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { id } = queryValidation.data

    // Soft delete (set deleted_at)
    const { error } = await supabaseAdmin
      .from('classes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Remove class memberships when class is deleted
    const { error: membershipError } = await supabaseAdmin
      .from('class_memberships')
      .delete()
      .eq('class_id', id)

    if (membershipError) {
      // Continue - membership removal is non-critical
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

