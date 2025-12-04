import { NextResponse } from 'next/server';

import { getStableDataCacheHeaders } from '@/lib/cacheConfig';
import { validateBody, validateQuery } from '@/lib/validation';
import {
  deleteMenuQuerySchema,
  getMenusQuerySchema,
  postMenuBodySchema,
  putMenuBodySchema,
} from '@/lib/validation/menus';
import type {
  FetchMenusArgs,
  UpdateMenuPayload,
  UpsertMenuPayload,
} from '@/lib/types/menus';
import type { AuthUser, SamveraRole, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleGetMenus(
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
  const queryValidation = validateQuery(getMenusQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }

  const {
    classId: rawClassId,
    day,
  } = queryValidation.data;
  const classId = rawClassId ?? undefined;

  try {
    const menus = await fetchMenus(adminClient, {
      orgId,
      userId: user.id,
      isTeacher,
      classId,
      day,
    });

    return NextResponse.json(
      {
        menus: menus || [],
        total_menus: menus?.length || 0,
      },
      {
        status: 200,
        headers: getStableDataCacheHeaders(),
      },
    );
  } catch (error) {
    if (error instanceof MenusServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to fetch menus' },
      { status: 500 },
    );
  }
}

export async function handlePostMenu(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  const body = await request.json();
  const bodyValidation = validateBody(postMenuBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  try {
    const result = await upsertMenu(adminClient, orgId, user.id, bodyValidation.data);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof MenusServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to create or update menu' },
      { status: 500 },
    );
  }
}

export async function handlePutMenu(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const body = await request.json();
  const bodyValidation = validateBody(putMenuBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  try {
    const updated = await updateMenu(adminClient, bodyValidation.data);

    return NextResponse.json(
      {
        menu: updated,
        message: 'Menu updated successfully!',
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof MenusServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to update menu' },
      { status: 500 },
    );
  }
}

export async function handleDeleteMenu(
  request: Request,
  adminClient: SupabaseClient,
) {
  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(deleteMenuQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }

  const { id } = queryValidation.data;

  try {
    await softDeleteMenu(adminClient, id);

    return NextResponse.json(
      {
        message: 'Menu deleted successfully!',
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof MenusServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to delete menu' },
      { status: 500 },
    );
  }
}

class MenusServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly body: unknown = { error: message },
  ) {
    super(message);
    this.name = 'MenusServiceError';
  }
}

async function fetchMenus(
  adminClient: SupabaseClient,
  {
  orgId,
  userId,
  isTeacher,
  classId,
  day,
}: FetchMenusArgs) {
  try {
    let query = adminClient
      .from('menus')
      .select(
        'id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_by,created_at,updated_at',
      )
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('day', { ascending: false });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    if (isTeacher) {
      query = query.eq('created_by', userId);
    }

    if (day) {
      query = query.eq('day', day);
    }

    const { data, error } = await query;

    if (error) {
      throw new MenusServiceError(`Failed to fetch menus: ${error.message}`, 500, {
        error: error.message,
      });
    }

    return data ?? [];
  } catch (error) {
    if (error instanceof MenusServiceError) {
      throw error;
    }
    throw new MenusServiceError('Failed to fetch menus', 500, {
      error: error instanceof Error ? error.message : 'Failed to fetch menus',
    });
  }
}

async function upsertMenu(
  adminClient: SupabaseClient,
  orgId: string | undefined,
  userId: string,
  payload: UpsertMenuPayload,
) {
  if (!orgId) {
    throw new MenusServiceError('Organization not found for user', 400, {
      error: 'Organization not found for user',
    });
  }

  const { class_id, day, breakfast, lunch, snack, notes, is_public } =
    payload;

  const finalClassId =
    class_id && class_id.trim() !== '' ? class_id : null;

  try {
    let query = adminClient
      .from('menus')
      .select('id')
      .eq('org_id', orgId)
      .eq('day', day)
      .is('deleted_at', null);

    if (finalClassId) {
      query = query.eq('class_id', finalClassId);
    } else {
      query = query.is('class_id', null);
    }

    const { data: existing, error: checkError } = await query.maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      const isNetworkError =
        checkError.message?.includes('fetch failed') ||
        checkError.message?.includes('timeout') ||
        checkError.message?.includes('Connect Timeout');

      if (isNetworkError) {
        throw new MenusServiceError(
          'Network error. Please check your connection and try again.',
          503,
          {
            error: 'Network error. Please check your connection and try again.',
            retryable: true,
          },
        );
      }

      throw new MenusServiceError(
        `Failed to check for existing menu: ${checkError.message}`,
        500,
        { error: `Failed to check for existing menu: ${checkError.message}` },
      );
    }

    let result;

    if (existing?.id) {
      const updatePayload: Record<string, unknown> = { deleted_at: null };
      if (typeof breakfast !== 'undefined') {
        updatePayload.breakfast = breakfast || null;
      }
      if (typeof lunch !== 'undefined') {
        updatePayload.lunch = lunch || null;
      }
      if (typeof snack !== 'undefined') {
        updatePayload.snack = snack || null;
      }
      if (typeof notes !== 'undefined') {
        updatePayload.notes = notes || null;
      }
      if (typeof is_public !== 'undefined') {
        updatePayload.is_public = is_public;
      }

      const { data: updated, error: updateError } = await adminClient
        .from('menus')
        .update(updatePayload)
        .eq('id', existing.id)
        .select(
          'id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_at,updated_at',
        )
        .single();

      if (updateError) {
        const isNetworkError =
          updateError.message?.includes('fetch failed') ||
          updateError.message?.includes('timeout') ||
          updateError.message?.includes('Connect Timeout');

        if (isNetworkError) {
          throw new MenusServiceError(
            'Network error. Please check your connection and try again.',
            503,
            {
              error:
                'Network error. Please check your connection and try again.',
              retryable: true,
            },
          );
        }

        throw new MenusServiceError(
          `Failed to update menu: ${updateError.message}`,
          500,
          { error: `Failed to update menu: ${updateError.message}` },
        );
      }

      result = updated;
    } else {
      const { data: inserted, error: insertError } = await adminClient
        .from('menus')
        .insert({
          org_id: orgId,
          class_id: finalClassId,
          day,
          breakfast: breakfast || null,
          lunch: lunch || null,
          snack: snack || null,
          notes: notes || null,
          is_public: typeof is_public !== 'undefined' ? is_public : true,
          created_by: userId,
          deleted_at: null,
        })
        .select(
          'id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_by,created_at,updated_at',
        )
        .single();

      if (insertError) {
        const isNetworkError =
          insertError.message?.includes('fetch failed') ||
          insertError.message?.includes('timeout') ||
          insertError.message?.includes('Connect Timeout');

        if (isNetworkError) {
          throw new MenusServiceError(
            'Network error. Please check your connection and try again.',
            503,
            {
              error:
                'Network error. Please check your connection and try again.',
              retryable: true,
            },
          );
        }

        throw new MenusServiceError(
          `Failed to create menu: ${insertError.message}`,
          500,
          { error: `Failed to create menu: ${insertError.message}` },
        );
      }

      result = inserted;
    }

    return {
      menu: result,
      message: 'Menu created/updated successfully!',
    };
  } catch (error) {
    if (error instanceof MenusServiceError) {
      throw error;
    }

    throw new MenusServiceError('Failed to create or update menu', 500, {
      error:
        error instanceof Error
          ? `Failed to create or update menu: ${error.message}`
          : 'Failed to create or update menu',
    });
  }
}

async function updateMenu(
  adminClient: SupabaseClient,
  payload: UpdateMenuPayload,
) {
  const { id, breakfast, lunch, snack, notes, is_public } = payload;

  try {
    const { data: updated, error } = await adminClient
      .from('menus')
      .update({
        breakfast: typeof breakfast !== 'undefined' ? breakfast : null,
        lunch: typeof lunch !== 'undefined' ? lunch : null,
        snack: typeof snack !== 'undefined' ? snack : null,
        notes: typeof notes !== 'undefined' ? notes : null,
        is_public: typeof is_public !== 'undefined' ? is_public : true,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select(
        'id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_at,updated_at',
      )
      .single();

    if (error) {
      throw new MenusServiceError(
        `Failed to update menu: ${error.message}`,
        500,
        { error: `Failed to update menu: ${error.message}` },
      );
    }

    if (!updated) {
      throw new MenusServiceError('Menu not found', 404, {
        error: 'Menu not found',
      });
    }

    return updated;
  } catch (error) {
    if (error instanceof MenusServiceError) {
      throw error;
    }

    throw new MenusServiceError('Failed to update menu', 500, {
      error:
        error instanceof Error
          ? `Failed to update menu: ${error.message}`
          : 'Failed to update menu',
    });
  }
}

async function softDeleteMenu(
  adminClient: SupabaseClient,
  id: string,
) {
  try {
    const { error } = await adminClient
      .from('menus')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new MenusServiceError(
        `Failed to delete menu: ${error.message}`,
        500,
        { error: error.message },
      );
    }
  } catch (error) {
    if (error instanceof MenusServiceError) {
      throw error;
    }

    throw new MenusServiceError('Failed to delete menu', 500, {
      error:
        error instanceof Error
          ? `Failed to delete menu: ${error.message}`
          : 'Failed to delete menu',
    });
  }
}



