import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getNoCacheHeaders } from '@/lib/cacheConfig';
import { z } from 'zod';
import { validateBody, studentIdSchema, dateSchema, attendanceStatusSchema, classIdSchema, notesSchema } from '@/lib/validation';
import { getAuthUserWithOrg, mapAuthErrorToResponse } from '@/lib/server-helpers';

// POST body schema
const postBatchAttendanceBodySchema = z.object({
  records: z.array(
    z.object({
      student_id: studentIdSchema,
      status: attendanceStatusSchema,
      date: dateSchema,
      class_id: classIdSchema.optional().nullable(),
      notes: notesSchema.optional().nullable(),
    })
  ).min(1),
});

/**
 * Batch endpoint for saving multiple attendance records in a single request
 * More efficient than individual POST requests
 */
export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local',
        },
        { status: 500 }
      );
    }

    // Derive org_id and user (recorded_by) from authenticated context
    let orgId: string;
    let userId: string;
    try {
      const { user, orgId: resolvedOrgId } = await getAuthUserWithOrg();
      orgId = resolvedOrgId;
      userId = user.id;
    } catch (err) {
      return mapAuthErrorToResponse(err);
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
    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .upsert(attendanceRecords, {
        onConflict: 'student_id,date',
        ignoreDuplicates: false,
      })
      .select('id,org_id,class_id,student_id,date,status,notes,recorded_by,created_at,updated_at');

    if (attendanceError) {
      console.error('❌ Error saving batch attendance:', attendanceError);
      return NextResponse.json(
        {
          error: `Failed to save batch attendance: ${attendanceError.message}`,
        },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully saved ${attendance?.length || 0} attendance record(s) via batch`);

    return NextResponse.json(
      {
        attendance: attendance || [],
        message: `Successfully saved ${attendance?.length || 0} attendance record(s)!`,
        count: attendance?.length || 0,
      },
      { status: 201, headers: getNoCacheHeaders() }
    );
  } catch (err: any) {
    console.error('❌ Error in attendance batch POST:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

