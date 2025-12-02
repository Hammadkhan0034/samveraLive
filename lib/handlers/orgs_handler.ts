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

  const idsParam = queryValidation.data.ids || '';
  const ids = idsParam
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
    const q = adminClient
      .from('orgs')
      .select('id,name,slug,timezone,created_at,updated_at')
      .order('created_at', { ascending: false });

    const { data, error } = ids.length ? await q.in('id', ids) : await q;

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

