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
import type { OrganizationDetails, OrganizationMetrics } from '@/lib/types/orgs';

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

  const { ids: idsParam, page = 1, pageSize = 20 } = queryValidation.data;

  // Handle legacy ids parameter for backward compatibility
  const ids = idsParam
    ? idsParam
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
        })
    : [];

  try {
    // If specific IDs are requested, return them without pagination (backward compatibility)
    if (ids.length > 0) {
      const q = adminClient
        .from('orgs')
        .select('id,name,slug,email,phone,website,address,city,state,postal_code,timezone,is_active,created_by,updated_by,created_at,updated_at,deleted_at')
        .order('created_at', { ascending: false });

      const { data, error } = await q.in('id', ids);

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

    // Paginated query
    const offset = (page - 1) * pageSize;

    // Get total count
    const { count, error: countError } = await adminClient
      .from('orgs')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const totalCount = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Get paginated data
    const { data, error } = await adminClient
      .from('orgs')
      .select('id,name,slug,email,phone,website,address,city,state,postal_code,timezone,is_active,created_by,updated_by,created_at,updated_at,deleted_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        orgs: data || [],
        totalCount,
        totalPages,
        currentPage: page,
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
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const body = await request.json();
  const bodyValidation = validateBody(postOrgBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  const {
    name,
    slug,
    email,
    phone,
    website,
    address,
    city,
    state,
    postal_code,
    timezone,
  } = bodyValidation.data;

  try {
    const insertData: Record<string, unknown> = {
      name,
      slug,
      timezone,
      created_by: user.id,
    };

    if (email !== undefined) insertData.email = email;
    if (phone !== undefined) insertData.phone = phone;
    if (website !== undefined) insertData.website = website;
    if (address !== undefined) insertData.address = address;
    if (city !== undefined) insertData.city = city;
    if (state !== undefined) insertData.state = state;
    if (postal_code !== undefined) insertData.postal_code = postal_code;

    const { data, error } = await adminClient
      .from('orgs')
      .insert(insertData)
      .select('id,name,slug,email,phone,website,address,city,state,postal_code,timezone,is_active,created_by,updated_by,created_at,updated_at,deleted_at')
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
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const body = await request.json();
  const bodyValidation = validateBody(putOrgBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  const {
    id,
    name,
    slug,
    email,
    phone,
    website,
    address,
    city,
    state,
    postal_code,
    timezone,
  } = bodyValidation.data;

  const patch: Record<string, unknown> = {
    updated_by: user.id,
  };

  if (name !== undefined) patch.name = name;
  if (slug !== undefined) patch.slug = slug;
  if (email !== undefined) patch.email = email;
  if (phone !== undefined) patch.phone = phone;
  if (website !== undefined) patch.website = website;
  if (address !== undefined) patch.address = address;
  if (city !== undefined) patch.city = city;
  if (state !== undefined) patch.state = state;
  if (postal_code !== undefined) patch.postal_code = postal_code;
  if (timezone !== undefined) patch.timezone = timezone;

  try {
    const { data, error } = await adminClient
      .from('orgs')
      .update(patch)
      .eq('id', id)
      .select('id,name,slug,email,phone,website,address,city,state,postal_code,timezone,is_active,created_by,updated_by,created_at,updated_at,deleted_at')
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

/**
 * Handler for GET /api/orgs/[id] - Get organization details with metrics
 */
export async function handleGetOrgDetails(
  _request: Request,
  _user: AuthUser,
  adminClient: SupabaseClient,
  orgId: string,
): Promise<NextResponse> {
  try {
    // Validate orgId is a UUID
    try {
      uuidSchema.parse(orgId);
    } catch {
      return NextResponse.json({ error: 'Invalid organization ID' }, { status: 400 });
    }

    // Fetch organization
    const { data: org, error: orgError } = await adminClient
      .from('orgs')
      .select('id,name,slug,email,phone,website,address,city,state,postal_code,timezone,is_active,created_by,updated_by,created_at,updated_at,deleted_at')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Calculate metrics in parallel
    const [
      studentsResult,
      teachersResult,
      parentsResult,
      principalsResult,
    ] = await Promise.allSettled([
      // Students count
      adminClient
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .is('deleted_at', null),
      
      // Teachers count
      adminClient
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'teacher')
        .is('deleted_at', null),
      
      // Parents/Guardians count
      adminClient
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'guardian')
        .is('deleted_at', null),
      
      // Principals count
      adminClient
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'principal')
        .is('deleted_at', null),
    ]);

    // Extract counts, defaulting to 0 on failure
    // Note: When using { count: 'exact', head: true }, data is always null,
    // so we check for fulfillment and errors, then extract count directly
    const studentsCount = studentsResult.status === 'fulfilled' && !studentsResult.value.error
      ? studentsResult.value.count ?? 0
      : 0;
    
    const teachersCount = teachersResult.status === 'fulfilled' && !teachersResult.value.error
      ? teachersResult.value.count ?? 0
      : 0;
    
    const parentsCount = parentsResult.status === 'fulfilled' && !parentsResult.value.error
      ? parentsResult.value.count ?? 0
      : 0;
    
    const principalsCount = principalsResult.status === 'fulfilled' && !principalsResult.value.error
      ? principalsResult.value.count ?? 0
      : 0;

    // Calculate total users (students + teachers + parents + principals)
    const totalUsers = studentsCount + teachersCount + parentsCount + principalsCount;

    const metrics: OrganizationMetrics = {
      students: studentsCount,
      teachers: teachersCount,
      parents: parentsCount,
      principals: principalsCount,
      totalUsers,
    };

    const orgDetails: OrganizationDetails = {
      ...org,
      metrics,
    };

    return NextResponse.json(
      { org: orgDetails },
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

