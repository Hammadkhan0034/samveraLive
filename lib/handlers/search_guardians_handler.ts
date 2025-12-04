import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateQuery } from '@/lib/validation';
import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

// GET query parameter schema
const searchGuardiansQuerySchema = z.object({
  q: z.string().default(''),
});

export async function handleSearchGuardians(
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
  const queryValidation = validateQuery(searchGuardiansQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  const { q } = queryValidation.data;

  // Query guardians from users table
  // Return only id, first_name, last_name, email
  let guardiansQuery = adminClient
    .from('users')
    .select('id, first_name, last_name, email')
    .eq('org_id', orgId)
    .eq('role', 'guardian');

  // If query is empty, return latest 5 guardians ordered by created_at DESC
  // Otherwise, search across first_name, last_name, and email
  if (!q || !q.trim()) {
    guardiansQuery = guardiansQuery
      .order('created_at', { ascending: false })
      .limit(5);
  } else {
    guardiansQuery = guardiansQuery
      .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(5);
  }

  const { data: guardiansData, error } = await guardiansQuery;

  if (error) {
    console.error('❌ Error searching guardians:', error);
    return NextResponse.json({ error: error.message || 'Failed to search guardians' }, { status: 500 });
  }

  // Transform the data to match expected format
  const guardians = (guardiansData || []).map((guardian: any) => ({
    id: guardian.id,
    first_name: guardian.first_name || '',
    last_name: guardian.last_name || '',
    email: guardian.email || null,
  }));

  return NextResponse.json({ guardians }, {
    status: 200,
    headers: getUserDataCacheHeaders()
  });
}

