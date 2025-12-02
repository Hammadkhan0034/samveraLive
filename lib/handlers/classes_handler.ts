import { NextResponse } from 'next/server';

import { getStableDataCacheHeaders } from '@/lib/cacheConfig';
import { validateBody, validateQuery } from '@/lib/validation';
import {
  getClassesQuerySchema,
  postClassBodySchema,
  putClassBodySchema,
  deleteClassQuerySchema,
} from '@/lib/validation/classes';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Handler for GET /api/classes
 * Fetches classes filtered by optional creator, with assigned teachers.
 */
export async function handleGetClasses(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const metadata = user.user_metadata as UserMetadata | undefined;
    const orgId = metadata?.org_id;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization not found for user' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(getClassesQuerySchema, searchParams);
    if (!queryValidation.success) {
      console.error('❌ Query validation failed:', queryValidation.error);
      return queryValidation.error;
    }
    const { createdBy } = queryValidation.data;

    let query = adminClient
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
      .order('created_at', { ascending: false });

    // Filter by creator (principal) if provided
    if (createdBy) {
      query = query.eq('created_by', createdBy);
    }

    // Always filter by organization (from server-side auth)
    query = query.eq('org_id', orgId);

    const { data: classes, error } = await query;

    if (error) {
      console.error('❌ Error fetching classes:', error);
      const isNetworkError =
        error.message?.includes('fetch failed') ||
        error.message?.includes('timeout') ||
        error.name === 'AuthRetryableFetchError';

      if (isNetworkError) {
        return NextResponse.json(
          {
            error:
              'Database connection failed. Please check your connection and try again.',
            retryable: true,
          },
          { status: 503 },
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get assigned teachers for each class using class_memberships and staff tables
    const classesWithTeachers = await Promise.all(
      (classes || []).map(async (cls) => {
        try {
          const { data: memberships, error: membershipError } =
            await adminClient
              .from('class_memberships')
              .select(`
              user_id,
              membership_role,
              users!inner(id, first_name, last_name, email)
            `)
              .eq('class_id', cls.id)
              .eq('membership_role', 'teacher')
              .eq('org_id', orgId);

          if (membershipError) {
            console.error(
              '❌ Error fetching memberships for class:',
              cls.id,
              membershipError,
            );
            // Continue with empty teachers list
          }

          // Return ALL teachers from class_memberships, not just those in staff table
          // This is important for guardians/parents who need to see teachers assigned to their children's classes
          // even if the teacher is not in the staff table
          const teachers =
            memberships?.map((m: any) => {
              const firstName = m.users?.first_name || '';
              const lastName = m.users?.last_name || '';
              const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
              return {
                id: m.users?.id,
                full_name: fullName,
                first_name: m.users?.first_name,
                last_name: m.users?.last_name,
                email: m.users?.email,
              };
            }) || [];

          return {
            ...cls,
            assigned_teachers: teachers,
          };
        } catch (classError: any) {
          console.error('❌ Error processing class:', cls.id, classError);
          // Return class without teachers if there's an error
          return {
            ...cls,
            assigned_teachers: [],
          };
        }
      }),
    );

    return NextResponse.json(
      {
        classes: classesWithTeachers || [],
      },
      {
        status: 200,
        headers: getStableDataCacheHeaders(),
      },
    );
  } catch (err: any) {
    console.error('❌ Error in classes GET:', err);
    const errorMessage =
      err?.message || (typeof err === 'string' ? err : 'Unknown error');
    const isNetworkError =
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('timeout') ||
      err?.name === 'AuthRetryableFetchError';

    if (isNetworkError) {
      return NextResponse.json(
        {
          error:
            'Database connection failed. Please check your connection and try again.',
          retryable: true,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * Handler for POST /api/classes
 * Creates a new class and optionally assigns a teacher.
 */
export async function handlePostClass(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const metadata = user.user_metadata as UserMetadata | undefined;
    const orgId = metadata?.org_id;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization not found for user' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const bodyValidation = validateBody(postClassBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { name, code, created_by, teacher_id } = bodyValidation.data;

    // Use authenticated user's ID as created_by if not provided, or verify provided user is in same org
    let actualCreatedBy = created_by || user.id;

    // Verify the provided created_by user is in the same org (if different from authenticated user)
    if (created_by && created_by !== user.id) {
      const { data: existingUser } = await adminClient
        .from('users')
        .select('id, org_id')
        .eq('id', created_by)
        .single();

      if (!existingUser || existingUser.org_id !== orgId) {
        return NextResponse.json(
          {
            error:
              'Invalid created_by user or user not in same organization',
          },
          { status: 403 },
        );
      }
      actualCreatedBy = existingUser.id;
    }

    // If we still don't have a valid created_by user, use null
    // Don't create system users automatically

    // Create class
    const { data: newClass, error: classError } = await adminClient
      .from('classes')
      .insert({
        name: name,
        code: code || null,
        created_by: actualCreatedBy || null,
        org_id: orgId,
      })
      .select()
      .single();

    if (classError) {
      return NextResponse.json(
        { error: `Failed to create class: ${classError.message}` },
        { status: 500 },
      );
    }

    // If teacher_id provided, assign teacher to class
    if (teacher_id) {
      // Create class_memberships row with org_id
      const { error: cmError } = await adminClient
        .from('class_memberships')
        .insert({
          org_id: orgId,
          class_id: newClass.id,
          user_id: teacher_id,
          membership_role: 'teacher',
        });
      if (cmError) {
        // Continue - membership creation is non-critical
      }
    }

    return NextResponse.json(
      {
        class: newClass,
        message: teacher_id
          ? 'Class created and teacher assigned'
          : 'Class created successfully',
      },
      { status: 201 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * Handler for PUT /api/classes
 * Updates a class and optionally updates teacher assignment.
 */
export async function handlePutClass(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const body = await request.json();
    const bodyValidation = validateBody(putClassBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { id, name, code, teacher_id } = bodyValidation.data;

    // Update class
    const updateData: any = { updated_at: new Date().toISOString() };
    if (name) updateData.name = name;
    if (code !== undefined) updateData.code = code;

    const { data: updatedClass, error: classError } = await adminClient
      .from('classes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (classError) {
      return NextResponse.json(
        { error: classError.message },
        { status: 500 },
      );
    }

    // If teacher_id provided, update assignment
    if (teacher_id) {
      // Create/ensure class_memberships with org_id
      // First fetch class org_id
      let classOrgId: string | null = null;
      try {
        const { data: classRow } = await adminClient
          .from('classes')
          .select('org_id')
          .eq('id', id)
          .single();
        classOrgId = classRow?.org_id || null;
      } catch {}

      if (classOrgId) {
        const { error: cmUpsertError } = await adminClient
          .from('class_memberships')
          .upsert(
            {
              org_id: classOrgId,
              class_id: id,
              user_id: teacher_id,
              membership_role: 'teacher',
            },
            { onConflict: 'class_id,user_id' },
          );
        if (cmUpsertError) {
          // Continue - membership update is non-critical
        }
      }
    }

    return NextResponse.json({ class: updatedClass }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * Handler for DELETE /api/classes
 * Soft deletes a class and removes its memberships.
 */
export async function handleDeleteClass(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(deleteClassQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { id } = queryValidation.data;

    // Soft delete (set deleted_at)
    const { error } = await adminClient
      .from('classes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Remove class memberships when class is deleted
    const { error: membershipError } = await adminClient
      .from('class_memberships')
      .delete()
      .eq('class_id', id);

    if (membershipError) {
      // Continue - membership removal is non-critical
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}

