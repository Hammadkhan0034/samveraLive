import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateQuery } from '@/lib/validation';
import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

// GET query parameter schema (orgId removed - comes from user metadata)
const searchPeopleQuerySchema = z.object({
  q: z.string().default(''),
  role: z.enum(['guardian', 'student', 'all']).default('all'),
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
});

export async function handleSearchPeople(
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
  const queryValidation = validateQuery(searchPeopleQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  const { q, role, mode, limit } = queryValidation.data;

  // Ensure limit is a number
  const limitNum = typeof limit === 'number' ? limit : 10;

  if (!q) {
    return NextResponse.json({ results: [], count: 0 }, { status: 200 });
  }

  // Build guardian query from users
  const guardianPromise = (async () => {
    if (role !== 'guardian' && role !== 'all') return [] as any[];
    let guardianQuery = adminClient
      .from('users')
      .select('id,email,first_name,last_name,role')
      .eq('org_id', orgId)
      .eq('role', 'guardian')
      .limit(limitNum);

    if (mode === 'email') {
      guardianQuery = guardianQuery.ilike('email', `%${q}%`);
    } else if (mode === 'name') {
      guardianQuery = guardianQuery.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%`
      );
    } else {
      guardianQuery = guardianQuery.or(
        `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`
      );
    }

    const { data, error } = await guardianQuery;
    if (error) return [];
    return (data || []).map((u: any) => ({
      id: u.id,
      label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      email: u.email,
      role: 'guardian' as const,
      guardian_id: u.id,
      student_id: null,
    }));
  })();

  // Build student query from students join users
  const studentPromise = (async () => {
    if (role !== 'student' && role !== 'all') return [] as any[];

    // First, get all students for this org
    const { data: studentsData, error: studentsError } = await adminClient
      .from('students')
      .select('id, user_id, org_id')
      .eq('org_id', orgId)
      .is('deleted_at', null);

    if (studentsError || !studentsData || studentsData.length === 0) {
      console.log('No students found or error:', studentsError);
      return [];
    }

    // Get all user_ids from students
    const userIds = studentsData.map((s: any) => s.user_id).filter(Boolean);

    if (userIds.length === 0) {
      return [];
    }

    // Now fetch users and filter by search query
    let usersQuery = adminClient
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', userIds);

    if (mode === 'email') {
      usersQuery = usersQuery.ilike('email', `%${q}%`);
    } else if (mode === 'name') {
      usersQuery = usersQuery.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    } else {
      usersQuery = usersQuery.or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    }

    const { data: usersData, error: usersError } = await usersQuery;

    if (usersError || !usersData || usersData.length === 0) {
      console.log('No users found or error:', usersError);
      return [];
    }

    // Map users back to students
    const matchedUserIds = new Set(usersData.map((u: any) => u.id));
    const matchedStudents = studentsData
      .filter((s: any) => matchedUserIds.has(s.user_id))
      .slice(0, limitNum);

    // Create a map of user_id -> user data for quick lookup
    const userMap = new Map(usersData.map((u: any) => [u.id, u]));

    return matchedStudents.map((s: any) => {
      const user = userMap.get(s.user_id);
      return {
        id: s.id,
        label: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || '',
        email: user?.email || '',
        role: 'student' as const,
        guardian_id: null,
        student_id: s.id,
        student_user_id: s.user_id,
      };
    });
  })();

  const [guardians, students] = await Promise.all([guardianPromise, studentPromise]);
  const combined = [...guardians, ...students].slice(0, limitNum);

  return NextResponse.json({ results: combined, count: combined.length }, {
    headers: getUserDataCacheHeaders()
  });
}

