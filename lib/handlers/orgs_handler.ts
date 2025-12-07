import { NextResponse } from 'next/server';
import { getStableDataCacheHeaders } from '@/lib/cacheConfig';
import { validateBody, validateQuery, uuidSchema } from '@/lib/validation';
import {
  getOrgsQuerySchema,
  postOrgBodySchema,
  putOrgBodySchema,
  deleteOrgQuerySchema,
} from '@/lib/validation/orgs';
import type { AuthUser } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleGetOrgs(
  request: Request,
  _user: AuthUser,
  adminClient: SupabaseClient,
) {
  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(getOrgsQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }

  const { ids: idsParam, page, limit } = queryValidation.data;
  const ids = (idsParam || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((id) => {
      try {
        uuidSchema.parse(id);
        return true;
      } catch {
        return false;
      }
    });

  try {
    // If specific IDs are requested, return those without pagination
    if (ids.length > 0) {
      const { data, error } = await adminClient
        .from('orgs')
        .select('id,name,slug,timezone,created_at,updated_at')
        .in('id', ids)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(
        { orgs: data || [] },
        {
          status: 200,
          headers: getStableDataCacheHeaders(),
        },
      );
    }

    // Get total count for pagination
    const { count, error: countError } = await adminClient
      .from('orgs')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const totalCount = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const offset = (page - 1) * limit;

    // Fetch paginated data
    const { data, error } = await adminClient
      .from('orgs')
      .select('id,name,slug,timezone,created_at,updated_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        orgs: data || [],
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
      {
        status: 200,
        headers: getStableDataCacheHeaders(),
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function handlePostOrg(
  request: Request,
  _user: AuthUser,
  adminClient: SupabaseClient,
) {
  const body = await request.json();
  const bodyValidation = validateBody(postOrgBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  const { name, slug, timezone } = bodyValidation.data;

  try {
    const { data, error } = await adminClient
      .from('orgs')
      .insert({ name, slug, timezone })
      .select('id,name,slug,timezone,created_at,updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ org: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function handlePutOrg(
  request: Request,
  adminClient: SupabaseClient,
) {
  const body = await request.json();
  const bodyValidation = validateBody(putOrgBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  const { id, name, slug, timezone } = bodyValidation.data;
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (slug !== undefined) patch.slug = slug;
  if (timezone !== undefined) patch.timezone = timezone;

  try {
    const { data, error } = await adminClient
      .from('orgs')
      .update(patch)
      .eq('id', id)
      .select('id,name,slug,timezone,created_at,updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ org: data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function handleDeleteOrg(
  request: Request,
  adminClient: SupabaseClient,
) {
  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(deleteOrgQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }

  const { id } = queryValidation.data;

  try {
    const { error } = await adminClient.from('orgs').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

