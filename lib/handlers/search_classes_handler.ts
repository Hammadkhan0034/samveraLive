import { NextResponse } from 'next/server';
import { validateQuery } from '@/lib/validation';
import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import { searchClassesQuerySchema } from '@/lib/validation/classes';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleSearchClasses(
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
  const queryValidation = validateQuery(searchClassesQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  const { q } = queryValidation.data;

  // Query classes from classes table
  // Return only id, name, code
  let classesQuery = adminClient
    .from('classes')
    .select('id, name, code')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  // If query is empty, return latest 5 classes ordered by created_at DESC
  // Otherwise, search across name and code
  if (!q || !q.trim()) {
    classesQuery = classesQuery
      .order('created_at', { ascending: false })
      .limit(5);
  } else {
    classesQuery = classesQuery
      .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
      .limit(5);
  }

  const { data: classesData, error } = await classesQuery;

  if (error) {
    console.error('❌ Error searching classes:', error);
    return NextResponse.json({ error: error.message || 'Failed to search classes' }, { status: 500 });
  }

  // Transform the data to match expected format
  const classes = (classesData || []).map((cls: any) => ({
    id: cls.id,
    name: cls.name || '',
    code: cls.code || null,
  }));

  return NextResponse.json({ classes }, {
    status: 200,
    headers: getUserDataCacheHeaders()
  });
}

