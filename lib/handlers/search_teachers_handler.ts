import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateQuery, uuidSchema } from '@/lib/validation';
import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

// GET query parameter schema (orgId removed - comes from user metadata)
const searchTeachersQuerySchema = z.object({
  q: z.string().default(''),
  mode: z.enum(['email', 'name', 'any']).default('any'),
  limit: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        return Math.min(parseInt(val) || 10, 25);
      }
      return typeof val === 'number' ? Math.min(val, 25) : 10;
    },
    z.number().int().nonnegative()
  ).default(10),
  excludeIds: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        return val ? val.split(',').filter(Boolean) : [];
      }
      return Array.isArray(val) ? val : [];
    },
    z.array(z.string())
  ).default([]),
}).refine((data) => {
  // Validate that excludeIds are valid UUIDs if provided
  if (data.excludeIds && data.excludeIds.length > 0) {
    return data.excludeIds.every(id => {
      try {
        uuidSchema.parse(id);
        return true;
      } catch {
        return false;
      }
    });
  }
  return true;
}, { message: 'excludeIds must contain valid UUIDs' });

export async function handleSearchTeachers(
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
  const queryValidation = validateQuery(searchTeachersQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  const { q, mode, limit, excludeIds } = queryValidation.data;

  // Ensure limit is a number and excludeIds is an array
  const limitNum = typeof limit === 'number' ? limit : 10;
  const excludeIdsArray = Array.isArray(excludeIds) ? excludeIds : [];

  if (!q) {
    return NextResponse.json({ results: [], count: 0 }, { status: 200 });
  }

  // Query teachers: users with role='teacher' joined with staff table
  // First get all staff user_ids for this org
  const { data: staffData, error: staffError } = await adminClient
    .from('staff')
    .select('user_id')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (staffError) {
    console.error('❌ Error fetching staff:', staffError);
    return NextResponse.json({ error: staffError.message || 'Failed to fetch staff' }, { status: 500 });
  }

  let teacherUserIds = (staffData || []).map((s: any) => s.user_id).filter(Boolean);

  // Apply exclude IDs if provided (already validated as UUIDs)
  if (excludeIdsArray && excludeIdsArray.length > 0) {
    teacherUserIds = teacherUserIds.filter((id: string) => !excludeIdsArray.includes(id));
  }

  if (teacherUserIds.length === 0) {
    return NextResponse.json({ results: [], count: 0 }, { status: 200 });
  }

  // Now query users who are in the teacher list and match search criteria
  let teachersQuery = adminClient
    .from('users')
    .select('id, email, first_name, last_name')
    .eq('org_id', orgId)
    .eq('role', 'teacher')
    .in('id', teacherUserIds)
    .is('deleted_at', null)
    .limit(limitNum);

  // Apply search filters based on mode
  if (mode === 'email') {
    teachersQuery = teachersQuery.ilike('email', `%${q}%`);
  } else if (mode === 'name') {
    teachersQuery = teachersQuery.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  } else {
    teachersQuery = teachersQuery.or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  }

  const { data: teachersData, error } = await teachersQuery;

  if (error) {
    console.error('❌ Error searching teachers:', error);
    return NextResponse.json({ error: error.message || 'Failed to search teachers' }, { status: 500 });
  }

  // Transform the data to match expected format
  const results = (teachersData || []).map((teacher: any) => ({
    id: teacher.id,
    email: teacher.email || '',
    first_name: teacher.first_name || '',
    last_name: teacher.last_name || '',
    full_name: `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email || 'Unknown',
  }));

  return NextResponse.json({ results, count: results.length }, {
    status: 200,
    headers: getUserDataCacheHeaders()
  });
}

