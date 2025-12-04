import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getUserDataCacheHeaders } from '@/lib/cacheConfig'
import { validateQuery } from '@/lib/validation'
import { searchStudentsQuerySchema } from '@/lib/validation/students'
import type { AuthUser, UserMetadata } from '@/lib/types/auth'

export async function handleSearchStudents(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined
  const orgId = metadata?.org_id

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    )
  }

  const { searchParams } = new URL(request.url)
  const queryValidation = validateQuery(searchStudentsQuerySchema, searchParams)
  if (!queryValidation.success) {
    return queryValidation.error
  }
  const { q } = queryValidation.data

  // Query students joined with users table for names
  // Return only id, first_name, last_name
  let studentsQuery = adminClient
    .from('students')
    .select(
      `
        id,
        users:users!students_user_id_fkey (
          first_name,
          last_name
        )
      `,
    )
    .eq('org_id', orgId)
    .is('deleted_at', null)

  // If query is empty, return latest 5 students ordered by created_at DESC
  // Otherwise, search across first_name and last_name on related users row
  if (!q || !q.trim()) {
    studentsQuery = studentsQuery.order('created_at', { ascending: false }).limit(5)
  } else {
    const trimmed = q.trim()
    studentsQuery = studentsQuery
      .or(
        `users.first_name.ilike.%${trimmed}%,users.last_name.ilike.%${trimmed}%`,
      )
      .limit(5)
  }

  const { data: studentsData, error } = await studentsQuery

  if (error) {
    console.error('❌ Error searching students:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search students' },
      { status: 500 },
    )
  }

  // Transform the data to match expected format
  const students =
    (studentsData || []).map((row: any) => ({
      id: row.id,
      first_name: row.users?.first_name || '',
      last_name: row.users?.last_name || '',
    })) ?? []

  return NextResponse.json(
    { students },
    {
      status: 200,
      headers: getUserDataCacheHeaders(),
    },
  )
}


