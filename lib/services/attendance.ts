import { supabaseAdmin } from '@/lib/supabaseClient';

import type { AttendanceRecord } from '@/lib/types/attendance';
import type {
  GetAttendanceQueryParams,
  PostAttendanceBody,
  PutAttendanceBody,
} from '@/lib/validation/attendance';

/**
 * Error class for attendance service failures.
 * Keeps low-level details server-side while allowing route handlers
 * to map to safe HTTP responses.
 */
export class AttendanceServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AttendanceServiceError';
  }
}

function assertSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new AttendanceServiceError('Attendance service is not configured');
  }
}

type FetchAttendanceArgs = {
  orgId: string;
} & GetAttendanceQueryParams;

/**
 * Fetch attendance records filtered by optional class, student, and date.
 */
export async function fetchAttendanceByFilters({
  orgId,
  classId,
  studentId,
  date,
}: FetchAttendanceArgs): Promise<AttendanceRecord[]> {
  assertSupabaseAdmin();

  try {
    let query = supabaseAdmin!
      .from('attendance')
      .select(
        `
        id,
        org_id,
        class_id,
        student_id,
        date,
        status,
        notes,
        recorded_by,
        left_at,
        created_at,
        updated_at,
        students!attendance_student_id_fkey (
          id,
          user_id,
          users!students_user_id_fkey (
            id,
            first_name,
            last_name
          ),
          classes!students_class_id_fkey (
            id,
            name
          )
        )
      `,
      )
      .eq('org_id', orgId)
      .order('date', { ascending: false });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query;

    if (error) {
      throw new AttendanceServiceError('Failed to fetch attendance', error);
    }

    return (data ?? []) as unknown as AttendanceRecord[];
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      throw error;
    }
    throw new AttendanceServiceError('Failed to fetch attendance', error);
  }
}

type UpsertAttendanceArgs = {
  orgId: string;
  userId: string;
  payload: PostAttendanceBody;
};

/**
 * Create or update a single attendance record for a student and date.
 * Uses Supabase upsert on the UNIQUE (student_id, date) constraint.
 */
export async function upsertAttendance({
  orgId,
  userId,
  payload,
}: UpsertAttendanceArgs): Promise<AttendanceRecord> {
  assertSupabaseAdmin();

  const { class_id, student_id, date, status, notes, left_at } = payload;

  // If left_at is being set, preserve the existing status if it's not 'gone'
  // Otherwise use the provided status
  let finalStatus = status;
  if (left_at !== undefined && left_at !== null) {
    // When marking as gone, preserve original status
    // First check if record exists
    const { data: existing } = await supabaseAdmin!
      .from('attendance')
      .select('status')
      .eq('student_id', student_id)
      .eq('date', date)
      .single();
    
    if (existing && existing.status !== 'gone') {
      finalStatus = existing.status;
    }
  }

  try {
    const { data, error } = await supabaseAdmin!
      .from('attendance')
      .upsert(
        {
          org_id: orgId,
          class_id: class_id || null,
          student_id,
          date,
          status: finalStatus,
          notes: notes || null,
          recorded_by: userId,
          left_at: left_at !== undefined ? left_at : undefined,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'student_id,date',
          ignoreDuplicates: false,
        },
      )
      .select(
        'id,org_id,class_id,student_id,date,status,notes,recorded_by,left_at,created_at,updated_at',
      )
      .single()
      .returns<AttendanceRecord>();

    if (error || !data) {
      throw new AttendanceServiceError('Failed to save attendance', error);
    }

    return data;
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      throw error;
    }
    throw new AttendanceServiceError('Failed to save attendance', error);
  }
}

type UpdateAttendanceArgs = {
  userId: string;
  payload: PutAttendanceBody;
};

/**
 * Update mutable fields of an attendance record.
 */
export async function updateAttendance({
  userId,
  payload,
}: UpdateAttendanceArgs): Promise<AttendanceRecord> {
  assertSupabaseAdmin();

  const { id, status, notes, left_at } = payload;

  const updateData: Partial<Pick<AttendanceRecord, 'status' | 'notes' | 'left_at'>> & {
    updated_at: string;
    recorded_by: string;
  } = {
    updated_at: new Date().toISOString(),
    recorded_by: userId,
  };

  if (typeof status !== 'undefined') {
    updateData.status = status;
  }

  if (typeof notes !== 'undefined') {
    updateData.notes = notes;
  }

  // Handle left_at: can be set to a timestamp or null to unmark as gone
  if (left_at !== undefined) {
    updateData.left_at = left_at;
  }

  // If left_at is being set, preserve existing status (unless explicitly changed)
  if (left_at !== undefined && left_at !== null && typeof status === 'undefined') {
    const { data: existing } = await supabaseAdmin!
      .from('attendance')
      .select('status')
      .eq('id', id)
      .single();
    
    if (existing && existing.status !== 'gone') {
      // Preserve original status when marking as gone
      updateData.status = existing.status;
    }
  }

  try {
    const { data, error } = await supabaseAdmin!
      .from('attendance')
      .update(updateData)
      .eq('id', id)
      .select(
        'id,org_id,class_id,student_id,date,status,notes,recorded_by,left_at,created_at,updated_at',
      )
      .single()
      .returns<AttendanceRecord>();

    if (error || !data) {
      throw new AttendanceServiceError('Failed to update attendance', error);
    }

    return data;
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      throw error;
    }
    throw new AttendanceServiceError('Failed to update attendance', error);
  }
}

type DeleteAttendanceArgs = {
  orgId: string;
  id: string;
};

/**
 * Delete an attendance record scoped to the current organization.
 */
export async function deleteAttendanceById({
  orgId,
  id,
}: DeleteAttendanceArgs): Promise<void> {
  assertSupabaseAdmin();

  try {
    const { error } = await supabaseAdmin!
      .from('attendance')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      throw new AttendanceServiceError('Failed to delete attendance', error);
    }
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      throw error;
    }
    throw new AttendanceServiceError('Failed to delete attendance', error);
  }
}


