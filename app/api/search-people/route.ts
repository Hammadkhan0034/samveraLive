import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

// GET /api/search-people?q=...&orgId=...&role=guardian|student|all&mode=email|name|any&limit=10
export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const orgId = searchParams.get('orgId') || undefined
    const role = (searchParams.get('role') || 'all') as 'guardian' | 'student' | 'all'
    const mode = (searchParams.get('mode') || 'any') as 'email' | 'name' | 'any'
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 25)

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    if (!q) {
      return NextResponse.json({ results: [], count: 0 }, { status: 200 })
    }

    // Build guardian query from users
    const guardianPromise = (async () => {
      if (role !== 'guardian' && role !== 'all') return [] as any[]
      let guardianQuery = supabaseAdmin
        .from('users')
        .select('id,email,first_name,last_name,role')
        .eq('org_id', orgId)
        .eq('role', 'guardian')
        .limit(limit)

      if (mode === 'email') {
        guardianQuery = guardianQuery.ilike('email', `%${q}%`)
      } else if (mode === 'name') {
        guardianQuery = guardianQuery.or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%`
        )
      } else {
        guardianQuery = guardianQuery.or(
          `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`
        )
      }

      const { data, error } = await guardianQuery
      if (error) return []
      return (data || []).map((u: any) => ({
        id: u.id,
        label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        email: u.email,
        role: 'guardian' as const,
        guardian_id: u.id,
        student_id: null,
      }))
    })()

    // Build student query from students join users
    const studentPromise = (async () => {
      if (role !== 'student' && role !== 'all') return [] as any[]
      
      // First, get all students for this org
      const { data: studentsData, error: studentsError } = await supabaseAdmin
        .from('students')
        .select('id, user_id, org_id')
        .eq('org_id', orgId)
        .is('deleted_at', null)
      
      if (studentsError || !studentsData || studentsData.length === 0) {
        console.log('No students found or error:', studentsError)
        return []
      }

      // Get all user_ids from students
      const userIds = studentsData.map((s: any) => s.user_id).filter(Boolean)
      
      if (userIds.length === 0) {
        return []
      }

      // Now fetch users and filter by search query
      let usersQuery = supabaseAdmin
        .from('users')
        .select('id, email, first_name, last_name')
        .in('id', userIds)

      if (mode === 'email') {
        usersQuery = usersQuery.ilike('email', `%${q}%`)
      } else if (mode === 'name') {
        usersQuery = usersQuery.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      } else {
        usersQuery = usersQuery.or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      }

      const { data: usersData, error: usersError } = await usersQuery
      
      if (usersError || !usersData || usersData.length === 0) {
        console.log('No users found or error:', usersError)
        return []
      }

      // Map users back to students
      const matchedUserIds = new Set(usersData.map((u: any) => u.id))
      const matchedStudents = studentsData
        .filter((s: any) => matchedUserIds.has(s.user_id))
        .slice(0, limit)

      // Create a map of user_id -> user data for quick lookup
      const userMap = new Map(usersData.map((u: any) => [u.id, u]))

      return matchedStudents.map((s: any) => {
        const user = userMap.get(s.user_id)
        return {
          id: s.id,
          label: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || '',
          email: user?.email || '',
          role: 'student' as const,
          guardian_id: null,
          student_id: s.id,
          student_user_id: s.user_id,
        }
      })
    })()

    const [guardians, students] = await Promise.all([guardianPromise, studentPromise])
    const combined = [...guardians, ...students].slice(0, limit)

    return NextResponse.json({ results: combined, count: combined.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}


