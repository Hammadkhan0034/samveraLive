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

  const { classId: rawClassId, date, kind, page, pageSize } = queryValidation.data;
  const classId = rawClassId ?? undefined;
  const currentPage = page ?? 1;
  const currentPageSize = pageSize ?? 20;

  try {
    const result = await fetchDailyLogs(adminClient, {
      orgId,
      userId: user.id,
      isTeacher,
      classId,
      date,
      kind: kind || 'activity',
      page: currentPage,
      pageSize: currentPageSize,
    });

    return NextResponse.json(
      {
        dailyLogs: result.logs || [],
        totalCount: result.totalCount || 0,
        page: currentPage,
        pageSize: currentPageSize,
        totalPages: result.totalPages || 0,
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
    // First, fetch the existing log to verify ownership
    const { data: existingLog, error: fetchError } = await adminClient
      .from('daily_logs')
      .select('id, created_by')
      .eq('id', bodyValidation.data.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError) {
      throw new DailyLogsServiceError(
        `Failed to fetch daily log: ${fetchError.message}`,
        500,
        {
          error: `Failed to fetch daily log: ${fetchError.message}`,
        },
      );
    }

    if (!existingLog) {
      throw new DailyLogsServiceError('Daily log not found', 404, {
        error: 'Daily log not found',
      });
    }

    // Verify the user is the creator
    if (existingLog.created_by !== user.id) {
      throw new DailyLogsServiceError(
        'You can only edit activities you created',
        403,
        {
          error: 'You can only edit activities you created',
        },
      );
    }

    const updated = await updateDailyLog(adminClient, user.id, bodyValidation.data);

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
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(deleteDailyLogQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }

  const { id } = queryValidation.data;

  try {
    // First, fetch the existing log to verify ownership
    const { data: existingLog, error: fetchError } = await adminClient
      .from('daily_logs')
      .select('id, created_by')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError) {
      throw new DailyLogsServiceError(
        `Failed to fetch daily log: ${fetchError.message}`,
        500,
        {
          error: `Failed to fetch daily log: ${fetchError.message}`,
        },
      );
    }

    if (!existingLog) {
      throw new DailyLogsServiceError('Daily log not found', 404, {
        error: 'Daily log not found',
      });
    }

    // Verify the user is the creator
    if (existingLog.created_by !== user.id) {
      throw new DailyLogsServiceError(
        'You can only delete activities you created',
        403,
        {
          error: 'You can only delete activities you created',
        },
      );
    }

    await softDeleteDailyLog(adminClient, user.id, id);

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
    page = 1,
    pageSize = 20,
  }: FetchDailyLogsArgs,
) {
  try {
    // Build count query with same filters
    let countQuery = adminClient
      .from('daily_logs')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('kind', kind || 'activity')
      .is('deleted_at', null);

    // If teacher, only fetch logs created by them
    if (isTeacher) {
      countQuery = countQuery.eq('created_by', userId);
    }

    // Filter by class if specified (for principals)
    if (classId) {
      countQuery = countQuery.eq('class_id', classId);
    }

    if (date) {
      // Filter by date (start of day to end of day)
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      countQuery = countQuery
        .gte('recorded_at', startOfDay.toISOString())
        .lte('recorded_at', endOfDay.toISOString());
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      throw new DailyLogsServiceError(
        `Failed to count daily logs: ${countError.message}`,
        500,
        {
          error: countError.message,
        },
      );
    }

    const totalCount = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Calculate pagination offset
    const offset = (page - 1) * pageSize;

    // Build data query with same filters
    let dataQuery = adminClient
      .from('daily_logs')
      .select(
        `
        id,
        recorded_at,
        creator_name,
        image,
        note,
        created_by
      `,
      )
      .eq('org_id', orgId)
      .eq('kind', kind || 'activity')
      .is('deleted_at', null);

    // If teacher, only fetch logs created by them
    if (isTeacher) {
      dataQuery = dataQuery.eq('created_by', userId);
    }

    // Filter by class if specified (for principals)
    if (classId) {
      dataQuery = dataQuery.eq('class_id', classId);
    }

    if (date) {
      // Filter by date (start of day to end of day)
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      dataQuery = dataQuery
        .gte('recorded_at', startOfDay.toISOString())
        .lte('recorded_at', endOfDay.toISOString());
    }

    dataQuery = dataQuery
      .order('recorded_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, error } = await dataQuery;

    if (error) {
      throw new DailyLogsServiceError(
        `Failed to fetch daily logs: ${error.message}`,
        500,
        {
          error: error.message,
        },
      );
    }

    return {
      logs: data ?? [],
      totalCount,
      totalPages,
    };
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
        recorded_at,
        creator_name,
        image,
        note,
        created_by
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
  userId: string,
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
      .eq('created_by', userId)
      .is('deleted_at', null)
      .select(
        `
        id,
        recorded_at,
        creator_name,
        image,
        note,
        created_by
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

    if (!updated) {
      throw new DailyLogsServiceError(
        'Daily log not found or you do not have permission to edit it',
        403,
        {
          error: 'Daily log not found or you do not have permission to edit it',
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
  userId: string,
  id: string,
) {
  try {
    const { data: deleted, error: deleteError } = await adminClient
      .from('daily_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('created_by', userId)
      .is('deleted_at', null)
      .select('id');

    if (deleteError) {
      throw new DailyLogsServiceError(
        `Failed to delete daily log: ${deleteError.message}`,
        500,
        {
          error: `Failed to delete daily log: ${deleteError.message}`,
        },
      );
    }

    if (!deleted || deleted.length === 0) {
      throw new DailyLogsServiceError(
        'Daily log not found or you do not have permission to delete it',
        403,
        {
          error: 'Daily log not found or you do not have permission to delete it',
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

