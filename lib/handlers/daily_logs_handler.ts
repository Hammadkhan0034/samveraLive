import { NextResponse } from 'next/server';

import { getNoCacheHeaders, getStableDataCacheHeaders } from '@/lib/cacheConfig';
import { getCurrentUserOrgId } from '@/lib/server-helpers';
import { validateBody, validateQuery } from '@/lib/validation';
import {
  deleteDailyLogQuerySchema,
  getDailyLogsQuerySchema,
  postDailyLogBodySchema,
  putDailyLogBodySchema,
  type DeleteDailyLogQueryParams,
  type GetDailyLogsQueryParams,
  type PostDailyLogBody,
  type PutDailyLogBody,
} from '@/lib/validation/daily-logs';
import type {
  CreateDailyLogPayload,
  FetchDailyLogsArgs,
  UpdateDailyLogPayload,
} from '@/lib/types/daily-logs';
import type { AuthUser, SamveraRole, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Handler for GET /api/daily-logs
 * Fetches daily logs filtered by optional class, date, and kind.
 */
export async function handleGetDailyLogs(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const roles = (metadata?.roles ?? []) as SamveraRole[];
  const orgId = metadata?.org_id;
  const isTeacher = roles.includes('teacher');

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(getDailyLogsQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }

  const { classId: rawClassId, date, kind } = queryValidation.data;
  const classId = rawClassId ?? undefined;

  try {
    const logs = await fetchDailyLogs(adminClient, {
      orgId,
      userId: user.id,
      isTeacher,
      classId,
      date,
      kind: kind || 'activity',
    });

    return NextResponse.json(
      {
        dailyLogs: logs || [],
        total_logs: logs?.length || 0,
      },
      {
        status: 200,
        headers: getStableDataCacheHeaders(),
      },
    );
  } catch (error) {
    if (error instanceof DailyLogsServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to fetch daily logs' },
      { status: 500 },
    );
  }
}

/**
 * Handler for POST /api/daily-logs
 * Creates a new daily log entry.
 */
export async function handlePostDailyLog(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  const body = await request.json();
  const bodyValidation = validateBody(postDailyLogBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  try {
    // Get user's full name for creator_name
    const { data: userData } = await adminClient
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const creatorName =
      userData?.first_name && userData?.last_name
        ? `${userData.first_name} ${userData.last_name}`
        : userData?.first_name || userData?.email || 'Unknown';

    const result = await createDailyLog(
      adminClient,
      orgId,
      user.id,
      creatorName,
      bodyValidation.data,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof DailyLogsServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to create daily log' },
      { status: 500 },
    );
  }
}

/**
 * Handler for PUT /api/daily-logs
 * Updates an existing daily log entry.
 */
export async function handlePutDailyLog(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const body = await request.json();
  const bodyValidation = validateBody(putDailyLogBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  try {
    const updated = await updateDailyLog(adminClient, bodyValidation.data);

    return NextResponse.json(
      {
        dailyLog: updated,
        message: 'Daily log updated successfully!',
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof DailyLogsServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to update daily log' },
      { status: 500 },
    );
  }
}

/**
 * Handler for DELETE /api/daily-logs
 * Soft deletes a daily log entry.
 */
export async function handleDeleteDailyLog(
  request: Request,
  adminClient: SupabaseClient,
) {
  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(deleteDailyLogQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }

  const { id } = queryValidation.data;

  try {
    await softDeleteDailyLog(adminClient, id);

    return NextResponse.json(
      {
        message: 'Daily log deleted successfully!',
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof DailyLogsServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to delete daily log' },
      { status: 500 },
    );
  }
}

class DailyLogsServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly body: unknown = { error: message },
  ) {
    super(message);
    this.name = 'DailyLogsServiceError';
  }
}

async function fetchDailyLogs(
  adminClient: SupabaseClient,
  {
    orgId,
    userId,
    isTeacher,
    classId,
    date,
    kind,
  }: FetchDailyLogsArgs,
) {
  try {
    let query = adminClient
      .from('daily_logs')
      .select(
        `
        id,
        org_id,
        class_id,
        kind,
        recorded_at,
        created_by,
        creator_name,
        image,
        public,
        deleted_at,
        updated_at,
        note,
        classes:class_id (
          id,
          name,
          code
        ),
        users:created_by (
          id,
          first_name,
          last_name,
          email
        )
      `,
      )
      .eq('org_id', orgId)
      .eq('kind', kind || 'activity')
      .is('deleted_at', null)
      .order('recorded_at', { ascending: false });

    // If teacher, filter by their assigned classes
    if (isTeacher) {
      // Get teacher's class memberships
      const { data: memberships } = await adminClient
        .from('class_memberships')
        .select('class_id')
        .eq('user_id', userId);

      if (memberships && memberships.length > 0) {
        const classIds = memberships.map((m) => m.class_id);
        query = query.in('class_id', classIds);
      } else {
        // Teacher has no classes, return empty array
        return [];
      }
    }

    if (classId) {
      query = query.eq('class_id', classId);
    }

    if (date) {
      // Filter by date (start of day to end of day)
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query = query
        .gte('recorded_at', startOfDay.toISOString())
        .lte('recorded_at', endOfDay.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new DailyLogsServiceError(
        `Failed to fetch daily logs: ${error.message}`,
        500,
        {
          error: error.message,
        },
      );
    }

    return data ?? [];
  } catch (error) {
    if (error instanceof DailyLogsServiceError) {
      throw error;
    }
    throw new DailyLogsServiceError('Failed to fetch daily logs', 500, {
      error: error instanceof Error ? error.message : 'Failed to fetch daily logs',
    });
  }
}

async function createDailyLog(
  adminClient: SupabaseClient,
  orgId: string | undefined,
  userId: string,
  creatorName: string,
  payload: PostDailyLogBody,
) {
  if (!orgId) {
    throw new DailyLogsServiceError('Organization not found for user', 400, {
      error: 'Organization not found for user',
    });
  }

  const {
    class_id,
    recorded_at,
    note,
    image,
    kind,
    public: isPublic,
  } = payload;

  const finalClassId = class_id && class_id.trim() !== '' ? class_id : null;
  const recordedAt = recorded_at || new Date().toISOString();

  try {
    const { data: inserted, error: insertError } = await adminClient
      .from('daily_logs')
      .insert({
        org_id: orgId,
        class_id: finalClassId,
        kind: kind || 'activity',
        recorded_at: recordedAt,
        note: note || null,
        image: image || null,
        public: isPublic !== undefined ? isPublic : false,
        created_by: userId,
        creator_name: creatorName,
        deleted_at: null,
      })
      .select(
        `
        id,
        org_id,
        class_id,
        kind,
        recorded_at,
        created_by,
        creator_name,
        image,
        public,
        deleted_at,
        updated_at,
        note,
        classes:class_id (
          id,
          name,
          code
        ),
        users:created_by (
          id,
          first_name,
          last_name,
          email
        )
      `,
      )
      .single();

    if (insertError) {
      throw new DailyLogsServiceError(
        `Failed to create daily log: ${insertError.message}`,
        500,
        {
          error: `Failed to create daily log: ${insertError.message}`,
        },
      );
    }

    return {
      dailyLog: inserted,
      message: 'Daily log created successfully!',
    };
  } catch (error) {
    if (error instanceof DailyLogsServiceError) {
      throw error;
    }
    throw new DailyLogsServiceError('Failed to create daily log', 500, {
      error: error instanceof Error ? error.message : 'Failed to create daily log',
    });
  }
}

async function updateDailyLog(
  adminClient: SupabaseClient,
  payload: PutDailyLogBody,
) {
  const {
    id,
    class_id,
    recorded_at,
    note,
    image,
    public: isPublic,
  } = payload;

  try {
    const updatePayload: Record<string, unknown> = {};

    if (class_id !== undefined) {
      updatePayload.class_id = class_id && class_id.trim() !== '' ? class_id : null;
    }
    if (recorded_at !== undefined) {
      updatePayload.recorded_at = recorded_at;
    }
    if (note !== undefined) {
      updatePayload.note = note || null;
    }
    if (image !== undefined) {
      updatePayload.image = image || null;
    }
    if (isPublic !== undefined) {
      updatePayload.public = isPublic;
    }

    const { data: updated, error: updateError } = await adminClient
      .from('daily_logs')
      .update(updatePayload)
      .eq('id', id)
      .select(
        `
        id,
        org_id,
        class_id,
        kind,
        recorded_at,
        created_by,
        creator_name,
        image,
        public,
        deleted_at,
        updated_at,
        note,
        classes:class_id (
          id,
          name,
          code
        ),
        users:created_by (
          id,
          first_name,
          last_name,
          email
        )
      `,
      )
      .single();

    if (updateError) {
      throw new DailyLogsServiceError(
        `Failed to update daily log: ${updateError.message}`,
        500,
        {
          error: `Failed to update daily log: ${updateError.message}`,
        },
      );
    }

    return updated;
  } catch (error) {
    if (error instanceof DailyLogsServiceError) {
      throw error;
    }
    throw new DailyLogsServiceError('Failed to update daily log', 500, {
      error: error instanceof Error ? error.message : 'Failed to update daily log',
    });
  }
}

async function softDeleteDailyLog(
  adminClient: SupabaseClient,
  id: string,
) {
  try {
    const { error: deleteError } = await adminClient
      .from('daily_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) {
      throw new DailyLogsServiceError(
        `Failed to delete daily log: ${deleteError.message}`,
        500,
        {
          error: `Failed to delete daily log: ${deleteError.message}`,
        },
      );
    }
  } catch (error) {
    if (error instanceof DailyLogsServiceError) {
      throw error;
    }
    throw new DailyLogsServiceError('Failed to delete daily log', 500, {
      error: error instanceof Error ? error.message : 'Failed to delete daily log',
    });
  }
}

