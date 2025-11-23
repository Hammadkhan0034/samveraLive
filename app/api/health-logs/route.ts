import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getStableDataCacheHeaders } from '@/lib/cacheConfig';
import { requireServerAuth } from '@/lib/supabaseServer';
import { getCurrentUserOrgId } from '@/lib/server-helpers';
import { z } from 'zod';
import {
  validateQuery,
  validateBody,
  orgIdSchema,
  classIdSchema,
  studentIdSchema,
  userIdSchema,
  uuidSchema,
  createHealthLogSchema,
  updateHealthLogSchema,
} from '@/lib/validation';

// GET query parameter schema
const getHealthLogsQuerySchema = z.object({
  orgId: orgIdSchema.optional(),
  recordedBy: userIdSchema.optional(),
  studentId: studentIdSchema.optional(),
  type: z.enum([
    'diaper_wet',
    'diaper_dirty',
    'diaper_mixed',
    'temperature',
    'medication',
    'nap',
    'symptom',
    'injury',
    'meal',
    'other',
  ]).optional(),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireServerAuth();

    // Check if user has a valid role (principal, admin, teacher, or parent)
    const userRoles = user.user_metadata?.roles || [];
    const hasAccess = userRoles.some((role: string) =>
      ['principal', 'admin', 'teacher', 'parent'].includes(role)
    );

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Access denied. Valid role required.',
        },
        { status: 403 }
      );
    }
  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (authError.message === 'Network error - please retry') {
      return NextResponse.json({ healthLogs: [], total_logs: 0 }, {
        status: 200,
        headers: getStableDataCacheHeaders(),
      });
    }
    throw authError;
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local',
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(getHealthLogsQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { orgId, recordedBy, studentId, type } = queryValidation.data;

    // Get user's org_id if not provided
    let finalOrgId = orgId;
    if (!finalOrgId) {
      try {
        finalOrgId = await getCurrentUserOrgId();
      } catch (err) {
        // If org_id cannot be determined, return empty results
        return NextResponse.json(
          { healthLogs: [], total_logs: 0 },
          {
            status: 200,
            headers: getStableDataCacheHeaders(),
          }
        );
      }
    }

    // Build query with joins
    let query = supabaseAdmin
      .from('health_logs')
      .select(
        `
        id,
        org_id,
        class_id,
        student_id,
        type,
        recorded_at,
        temperature_celsius,
        data,
        notes,
        severity,
        recorded_by,
        created_at,
        updated_at,
        deleted_at,
        students!health_logs_student_id_fkey (
          id,
          user_id,
          class_id,
          users!students_user_id_fkey (
            id,
            first_name,
            last_name
          ),
          classes!students_class_id_fkey (
            id,
            name
          )
        ),
        classes!health_logs_class_id_fkey (
          id,
          name
        )
      `
      )
      .eq('org_id', finalOrgId)
      .is('deleted_at', null)
      .order('recorded_at', { ascending: false });

    // Filter by recorded_by (teacher's user ID)
    if (recordedBy) {
      query = query.eq('recorded_by', recordedBy);
    }

    // Filter by student_id if provided
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    // Filter by type if provided
    if (type) {
      query = query.eq('type', type);
    }

    const { data: healthLogs, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        healthLogs: healthLogs || [],
        total_logs: healthLogs?.length || 0,
      },
      {
        status: 200,
        headers: getStableDataCacheHeaders(),
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let user: any;
  try {
    const authResult = await requireServerAuth();
    user = authResult.user;
    const userRoles = user.user_metadata?.roles || [];
    const hasAccess = userRoles.some((role: string) =>
      ['principal', 'admin', 'teacher'].includes(role)
    );

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Access denied. Only principals, admins, and teachers can create health logs.',
        },
        { status: 403 }
      );
    }
  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    throw authError;
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local',
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const bodyValidation = validateBody(createHealthLogSchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const {
      org_id,
      class_id,
      student_id,
      type,
      recorded_at,
      temperature_celsius,
      data,
      notes,
      severity,
      recorded_by,
    } = bodyValidation.data;

    // Ensure class_id is null if not provided or empty string
    const finalClassId = class_id && class_id.trim() !== '' ? class_id : null;

    // Get student's class_id if not provided
    let finalClassIdToUse = finalClassId;
    if (!finalClassIdToUse) {
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('class_id')
        .eq('id', student_id)
        .maybeSingle();

      if (student?.class_id) {
        finalClassIdToUse = student.class_id;
      }
    }

    // Insert new health log
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('health_logs')
      .insert({
        org_id,
        class_id: finalClassIdToUse,
        student_id,
        type,
        recorded_at,
        temperature_celsius: temperature_celsius || null,
        data: data || {},
        notes: notes || null,
        severity: severity || null,
        recorded_by: recorded_by || user.id,
        deleted_at: null,
      })
      .select(
        `
        id,
        org_id,
        class_id,
        student_id,
        type,
        recorded_at,
        temperature_celsius,
        data,
        notes,
        severity,
        recorded_by,
        created_at,
        updated_at
      `
      )
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create health log: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        healthLog: inserted,
        message: 'Health log created successfully!',
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let user: any;
  try {
    const authResult = await requireServerAuth();
    user = authResult.user;
    const userRoles = user.user_metadata?.roles || [];
    const hasAccess = userRoles.some((role: string) =>
      ['principal', 'admin', 'teacher'].includes(role)
    );

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Access denied. Only principals, admins, and teachers can update health logs.',
        },
        { status: 403 }
      );
    }
  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    throw authError;
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local',
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const bodyValidation = validateBody(updateHealthLogSchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { id, student_id, type, recorded_at, temperature_celsius, data, notes, severity } =
      bodyValidation.data;

    // Verify ownership (recorded_by matches user)
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('health_logs')
      .select('recorded_by, org_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Health log not found' }, { status: 404 });
    }

    // Check if user is the creator or has admin/principal role
    const userRoles = user.user_metadata?.roles || [];
    const isAdminOrPrincipal = userRoles.some((role: string) =>
      ['admin', 'principal'].includes(role)
    );

    if (existing.recorded_by !== user.id && !isAdminOrPrincipal) {
      return NextResponse.json(
        { error: 'Access denied. You can only update your own health logs.' },
        { status: 403 }
      );
    }

    // Build update payload (only include fields that are provided)
    const updatePayload: any = {};
    if (student_id !== undefined) updatePayload.student_id = student_id;
    if (type !== undefined) updatePayload.type = type;
    if (recorded_at !== undefined) updatePayload.recorded_at = recorded_at;
    if (temperature_celsius !== undefined) updatePayload.temperature_celsius = temperature_celsius || null;
    if (data !== undefined) updatePayload.data = data || {};
    if (notes !== undefined) updatePayload.notes = notes || null;
    if (severity !== undefined) updatePayload.severity = severity || null;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('health_logs')
      .update(updatePayload)
      .eq('id', id)
      .is('deleted_at', null)
      .select(
        `
        id,
        org_id,
        class_id,
        student_id,
        type,
        recorded_at,
        temperature_celsius,
        data,
        notes,
        severity,
        recorded_by,
        created_at,
        updated_at
      `
      )
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update health log: ${updateError.message}` },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json({ error: 'Health log not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        healthLog: updated,
        message: 'Health log updated successfully!',
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let user: any;
  try {
    const authResult = await requireServerAuth();
    user = authResult.user;
    const userRoles = user.user_metadata?.roles || [];
    const hasAccess = userRoles.some((role: string) =>
      ['principal', 'admin', 'teacher'].includes(role)
    );

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Access denied. Only principals, admins, and teachers can delete health logs.',
        },
        { status: 403 }
      );
    }
  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    throw authError;
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local',
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const deleteHealthLogQuerySchema = z.object({
      id: uuidSchema,
    });

    const queryValidation = validateQuery(deleteHealthLogQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { id } = queryValidation.data;

    // Verify ownership (recorded_by matches user)
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('health_logs')
      .select('recorded_by')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Health log not found' }, { status: 404 });
    }

    // Check if user is the creator or has admin/principal role
    const userRoles = user.user_metadata?.roles || [];
    const isAdminOrPrincipal = userRoles.some((role: string) =>
      ['admin', 'principal'].includes(role)
    );

    if (existing.recorded_by !== user.id && !isAdminOrPrincipal) {
      return NextResponse.json(
        { error: 'Access denied. You can only delete your own health logs.' },
        { status: 403 }
      );
    }

    // Soft delete by setting deleted_at
    const { error } = await supabaseAdmin
      .from('health_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Health log deleted successfully!',
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

