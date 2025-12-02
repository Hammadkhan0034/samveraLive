import { NextResponse } from 'next/server';

import { getNoCacheHeaders } from '@/lib/cacheConfig';
import { validateBody, validateQuery } from '@/lib/validation';
import {
  deleteAttendanceQuerySchema,
  getAttendanceQuerySchema,
  postAttendanceBodySchema,
  putAttendanceBodySchema,
  type DeleteAttendanceQueryParams,
  type GetAttendanceQueryParams,
  type PostAttendanceBody,
  type PutAttendanceBody,
} from '@/lib/validation/attendance';
import {
  AttendanceServiceError,
  deleteAttendanceById,
  fetchAttendanceByFilters,
  upsertAttendance,
  updateAttendance,
} from '@/lib/services/attendance';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  attendanceStatusSchema,
  classIdSchema,
  dateSchema,
  notesSchema,
  studentIdSchema,
} from '@/lib/validation';

/**
 * Handler for GET /api/attendance
 * Fetches attendance records filtered by optional class, student, and date.
 */
export async function handleGetAttendance(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery<GetAttendanceQueryParams>(
    getAttendanceQuerySchema,
    searchParams,
  );
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  const { classId, studentId, date } = queryValidation.data;

  try {
    const attendance = await fetchAttendanceByFilters({
      orgId,
      classId,
      studentId,
      date,
    });

    return NextResponse.json(
      {
        attendance,
        total: attendance.length,
      },
      {
        status: 200,
        headers: getNoCacheHeaders(),
      },
    );
  } catch (err: unknown) {
    console.error('Error fetching attendance records', err);
    const isServiceError = err instanceof AttendanceServiceError;
    return NextResponse.json(
      {
        error: isServiceError
          ? 'Failed to fetch attendance'
          : 'Unexpected error while fetching attendance',
      },
      { status: 500 },
    );
  }
}

/**
 * Handler for POST /api/attendance
 * Creates or updates a single attendance record.
 */
export async function handlePostAttendance(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;
  const userId = user.id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  const rawBody = await request.json();
  const bodyValidation = validateBody<PostAttendanceBody>(
    postAttendanceBodySchema,
    rawBody,
  );
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  try {
    const attendance = await upsertAttendance({
      orgId,
      userId,
      payload: bodyValidation.data,
    });

    return NextResponse.json(
      {
        attendance,
        message: 'Attendance saved successfully!',
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error('Error saving attendance record', err);
    const isServiceError = err instanceof AttendanceServiceError;
    return NextResponse.json(
      {
        error: isServiceError
          ? 'Failed to save attendance'
          : 'Unexpected error while saving attendance',
      },
      { status: 500 },
    );
  }
}

/**
 * Handler for PUT /api/attendance
 * Updates mutable fields of an attendance record.
 */
export async function handlePutAttendance(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const userId = user.id;

  const rawBody = await request.json();

  const bodyValidation = validateBody<PutAttendanceBody>(
    putAttendanceBodySchema,
    rawBody,
  );
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  try {
    const attendance = await updateAttendance({
      userId,
      payload: bodyValidation.data,
    });

    return NextResponse.json(
      {
        attendance,
        message: 'Attendance updated successfully!',
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error('Error updating attendance record', err);
    const isServiceError = err instanceof AttendanceServiceError;
    return NextResponse.json(
      {
        error: isServiceError
          ? 'Failed to update attendance'
          : 'Unexpected error while updating attendance',
      },
      { status: 500 },
    );
  }
}

/**
 * Handler for DELETE /api/attendance
 * Deletes an attendance record scoped to the current organization.
 */
export async function handleDeleteAttendance(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery<DeleteAttendanceQueryParams>(
    deleteAttendanceQuerySchema,
    searchParams,
  );
  if (!queryValidation.success) {
    return queryValidation.error;
  }

  const { id } = queryValidation.data;

  try {
    await deleteAttendanceById({
      orgId,
      id,
    });

    return NextResponse.json(
      {
        message: 'Attendance deleted successfully!',
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error('Error deleting attendance record', err);
    const isServiceError = err instanceof AttendanceServiceError;
    return NextResponse.json(
      {
        error: isServiceError
          ? 'Failed to delete attendance'
          : 'Unexpected error while deleting attendance',
      },
      { status: 500 },
    );
  }
}

// POST body schema for batch attendance
const postBatchAttendanceBodySchema = z.object({
  records: z.array(
    z.object({
      student_id: studentIdSchema,
      status: attendanceStatusSchema,
      date: dateSchema,
      class_id: classIdSchema.optional().nullable(),
      notes: notesSchema.optional().nullable(),
    }),
  ).min(1),
});

/**
 * Handler for POST /api/attendance/batch
 * Batch endpoint for saving multiple attendance records in a single request.
 * More efficient than individual POST requests.
 */
export async function handlePostBatchAttendance(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;
  const userId = user.id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  const body = await request.json();
  const bodyValidation = validateBody(postBatchAttendanceBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }
  const { records } = bodyValidation.data;

  // Prepare records for upsert
  const attendanceRecords = records.map((record) => ({
    org_id: orgId,
    class_id: record.class_id || null,
    student_id: record.student_id,
    date: record.date,
    status: record.status,
    notes: record.notes || null,
    recorded_by: userId,
    updated_at: new Date().toISOString(),
  }));

  // Use upsert to handle UNIQUE constraint (student_id, date)
  // This will update existing records or create new ones
  const { data: attendance, error: attendanceError } = await adminClient
    .from('attendance')
    .upsert(attendanceRecords, {
      onConflict: 'student_id,date',
      ignoreDuplicates: false,
    })
    .select(
      'id,org_id,class_id,student_id,date,status,notes,recorded_by,created_at,updated_at',
    );

  if (attendanceError) {
    console.error('❌ Error saving batch attendance:', attendanceError);
    return NextResponse.json(
      {
        error: `Failed to save batch attendance: ${attendanceError.message}`,
      },
      { status: 500 },
    );
  }

  console.log(
    `✅ Successfully saved ${attendance?.length || 0} attendance record(s) via batch`,
  );

  return NextResponse.json(
    {
      attendance: attendance || [],
      message: `Successfully saved ${attendance?.length || 0} attendance record(s)!`,
      count: attendance?.length || 0,
    },
    { status: 201, headers: getNoCacheHeaders() },
  );
}

