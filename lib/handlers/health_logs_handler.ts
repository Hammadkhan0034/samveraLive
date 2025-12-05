import { NextResponse } from 'next/server';

import { getStableDataCacheHeaders } from '@/lib/cacheConfig';
import { validateBody, validateQuery, uuidSchema, studentIdSchema } from '@/lib/validation';
import {
  createHealthLogSchema,
  updateHealthLogSchema,
} from '@/lib/validation';
import type { AuthUser, SamveraRole, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// GET query parameter schema - only optional filters, no orgId or recordedBy
const getHealthLogsQuerySchema = z.object({
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

// DELETE query parameter schema
const deleteHealthLogQuerySchema = z.object({
  id: uuidSchema,
});

class HealthLogsServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly body: unknown = { error: message },
  ) {
    super(message);
    this.name = 'HealthLogsServiceError';
  }
}

/**
 * Handler for GET /api/health-logs
 * Fetches health logs with role-based filtering
 */
export async function handleGetHealthLogs(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;
  const roles = (metadata?.roles ?? []) as SamveraRole[];

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(getHealthLogsQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  const { studentId, type } = queryValidation.data;

  try {
    // Build query with joins
    let query = adminClient
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
      `,
      )
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('recorded_at', { ascending: false });

    // Role-based filtering:
    // - Teachers: only their own logs (recorded_by)
    // - Guardians: all logs for their linked students (not just ones they recorded)
    // - Admins/Principals: all logs in their org
    const isAdminOrPrincipal = roles.some((role) =>
      ['admin', 'principal'].includes(role),
    );
    const isGuardian = roles.some((role) => role === 'guardian');
    const isTeacher = roles.some((role) => role === 'teacher');

    if (isGuardian) {
      // For guardians, fetch linked students and filter by student_id
      const { data: relationships, error: relError } = await adminClient
        .from('guardian_students')
        .select('student_id')
        .eq('guardian_id', userId);

      if (relError) {
        console.error('❌ Error fetching guardian-student relationships:', relError);
        return NextResponse.json(
          { healthLogs: [], total_logs: 0 },
          {
            status: 200,
            headers: getStableDataCacheHeaders(),
          },
        );
      }

      const linkedStudentIds = (relationships || [])
        .map((r: any) => r.student_id)
        .filter(Boolean);

      // If no linked students, return empty results
      if (linkedStudentIds.length === 0) {
        return NextResponse.json(
          { healthLogs: [], total_logs: 0 },
          {
            status: 200,
            headers: getStableDataCacheHeaders(),
          },
        );
      }

      // Filter by linked student IDs
      query = query.in('student_id', linkedStudentIds);
    } else if (isTeacher && !isAdminOrPrincipal) {
      // Teachers only see their own logs
      query = query.eq('recorded_by', userId);
    }
    // Admins/Principals see all logs in the org (no additional filter)

    // Optional filters
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data: healthLogs, error } = await query;

    if (error) {
      throw new HealthLogsServiceError(
        `Failed to fetch health logs: ${error.message}`,
        500,
        { error: error.message },
      );
    }

    return NextResponse.json(
      {
        healthLogs: healthLogs || [],
        total_logs: healthLogs?.length || 0,
      },
      {
        status: 200,
        headers: getStableDataCacheHeaders(),
      },
    );
  } catch (error) {
    if (error instanceof HealthLogsServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to fetch health logs' },
      { status: 500 },
    );
  }
}

/**
 * Handler for POST /api/health-logs
 * Creates a new health log
 */
export async function handlePostHealthLog(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;

  const body = await request.json();
  const bodyValidation = validateBody(createHealthLogSchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }
  const {
    class_id,
    student_id,
    type,
    recorded_at,
    temperature_celsius,
    data,
    notes,
    severity,
  } = bodyValidation.data;

  try {
    // Ensure class_id is null if not provided or empty string
    const finalClassId = class_id && class_id.trim() !== '' ? class_id : null;

    // Get student's class_id if not provided
    let finalClassIdToUse = finalClassId;
    if (!finalClassIdToUse) {
      const { data: student, error: studentError } = await adminClient
        .from('students')
        .select('class_id, org_id')
        .eq('id', student_id)
        .maybeSingle();

      if (studentError) {
        throw new HealthLogsServiceError(
          `Failed to fetch student: ${studentError.message}`,
          500,
          { error: `Failed to fetch student: ${studentError.message}` },
        );
      }

      if (student?.class_id) {
        finalClassIdToUse = student.class_id;
      }

      // Verify student belongs to the same org
      if (student?.org_id && student.org_id !== orgId) {
        throw new HealthLogsServiceError(
          'Student does not belong to your organization.',
          403,
          { error: 'Student does not belong to your organization.' },
        );
      }
    }

    // Insert new health log - always use authenticated user's ID
    const { data: inserted, error: insertError } = await adminClient
      .from('health_logs')
      .insert({
        org_id: orgId,
        class_id: finalClassIdToUse,
        student_id,
        type,
        recorded_at,
        temperature_celsius: temperature_celsius || null,
        data: data || {},
        notes: notes || null,
        severity: severity || null,
        recorded_by: userId, // Always use authenticated user
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
      `,
      )
      .single();

    if (insertError) {
      throw new HealthLogsServiceError(
        `Failed to create health log: ${insertError.message}`,
        500,
        { error: `Failed to create health log: ${insertError.message}` },
      );
    }

    return NextResponse.json(
      {
        healthLog: inserted,
        message: 'Health log created successfully!',
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof HealthLogsServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to create health log' },
      { status: 500 },
    );
  }
}

/**
 * Handler for PUT /api/health-logs
 * Updates an existing health log
 */
export async function handlePutHealthLog(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;
  const roles = (metadata?.roles ?? []) as SamveraRole[];

  const body = await request.json();
  const bodyValidation = validateBody(updateHealthLogSchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }
  const { id, student_id, type, recorded_at, temperature_celsius, data, notes, severity } =
    bodyValidation.data;

  try {
    // Verify ownership and org access
    const { data: existing, error: fetchError } = await adminClient
      .from('health_logs')
      .select('recorded_by, org_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      throw new HealthLogsServiceError('Health log not found', 404, {
        error: 'Health log not found',
      });
    }

    // Verify user's org matches log's org
    if (existing.org_id !== orgId) {
      throw new HealthLogsServiceError(
        'Access denied. This health log belongs to a different organization.',
        403,
        {
          error: 'Access denied. This health log belongs to a different organization.',
        },
      );
    }

    // Check if user is the creator or has admin/principal role
    const isAdminOrPrincipal = roles.some((role) =>
      ['admin', 'principal'].includes(role),
    );

    if (existing.recorded_by !== userId && !isAdminOrPrincipal) {
      throw new HealthLogsServiceError(
        'Access denied. You can only update your own health logs.',
        403,
        { error: 'Access denied. You can only update your own health logs.' },
      );
    }

    // Build update payload (only include fields that are provided)
    const updatePayload: any = {};
    if (student_id !== undefined) updatePayload.student_id = student_id;
    if (type !== undefined) updatePayload.type = type;
    if (recorded_at !== undefined) updatePayload.recorded_at = recorded_at;
    if (temperature_celsius !== undefined)
      updatePayload.temperature_celsius = temperature_celsius || null;
    if (data !== undefined) updatePayload.data = data || {};
    if (notes !== undefined) updatePayload.notes = notes || null;
    if (severity !== undefined) updatePayload.severity = severity || null;

    const { data: updated, error: updateError } = await adminClient
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
      `,
      )
      .single();

    if (updateError) {
      throw new HealthLogsServiceError(
        `Failed to update health log: ${updateError.message}`,
        500,
        { error: `Failed to update health log: ${updateError.message}` },
      );
    }

    if (!updated) {
      throw new HealthLogsServiceError('Health log not found', 404, {
        error: 'Health log not found',
      });
    }

    return NextResponse.json(
      {
        healthLog: updated,
        message: 'Health log updated successfully!',
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof HealthLogsServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to update health log' },
      { status: 500 },
    );
  }
}

/**
 * Handler for DELETE /api/health-logs
 * Soft deletes a health log
 */
export async function handleDeleteHealthLog(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;
  const roles = (metadata?.roles ?? []) as SamveraRole[];

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(deleteHealthLogQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  const { id } = queryValidation.data;

  try {
    // Verify ownership and org access
    const { data: existing, error: fetchError } = await adminClient
      .from('health_logs')
      .select('recorded_by, org_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      throw new HealthLogsServiceError('Health log not found', 404, {
        error: 'Health log not found',
      });
    }

    // Verify user's org matches log's org
    if (existing.org_id !== orgId) {
      throw new HealthLogsServiceError(
        'Access denied. This health log belongs to a different organization.',
        403,
        {
          error: 'Access denied. This health log belongs to a different organization.',
        },
      );
    }

    // Check if user is the creator or has admin/principal role
    const isAdminOrPrincipal = roles.some((role) =>
      ['admin', 'principal'].includes(role),
    );

    if (existing.recorded_by !== userId && !isAdminOrPrincipal) {
      throw new HealthLogsServiceError(
        'Access denied. You can only delete your own health logs.',
        403,
        { error: 'Access denied. You can only delete your own health logs.' },
      );
    }

    // Soft delete by setting deleted_at
    const { error } = await adminClient
      .from('health_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new HealthLogsServiceError(
        `Failed to delete health log: ${error.message}`,
        500,
        { error: error.message },
      );
    }

    return NextResponse.json(
      {
        message: 'Health log deleted successfully!',
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof HealthLogsServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to delete health log' },
      { status: 500 },
    );
  }
}

