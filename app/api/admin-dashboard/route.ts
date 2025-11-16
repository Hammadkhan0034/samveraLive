import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

const PRINCIPAL_ROLE_ID = 30
const GUARDIAN_ROLE_ID = 10

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please check SUPABASE_SERVICE_ROLE_KEY in .env.local' 
      }, { status: 500 })
    }

    console.log('🔄 Loading admin dashboard data...')

    // Fetch all organizations
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('orgs')
      .select('id,name,slug,timezone,created_at,updated_at')
      .order('created_at', { ascending: false })

    if (orgsError) {
      console.error('❌ Error fetching organizations:', orgsError)
      return NextResponse.json({ error: orgsError.message }, { status: 500 })
    }

    const orgsList = orgs || []
    const orgIds = orgsList.map(o => o.id)
    const orgMap = new Map(orgsList.map(o => [o.id, o.name]))

    // Calculate statistics using efficient database queries
    // Total unique users (count distinct user IDs across all roles)
    const { count: totalUsersCount, error: usersCountError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)

    if (usersCountError) {
      console.warn('⚠️ Error counting total users:', usersCountError)
    }

    // Total teachers (count where role='teacher')
    const { count: totalTeachersCount, error: teachersCountError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'teacher')
      .is('deleted_at', null)

    if (teachersCountError) {
      console.warn('⚠️ Error counting teachers:', teachersCountError)
    }

    // Total students (count from students table)
    const { count: totalStudentsCount, error: studentsCountError } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)

    if (studentsCountError) {
      console.warn('⚠️ Error counting students:', studentsCountError)
    }

    // Total guardians/parents (count where role='guardian' or role='parent')
    const { count: totalGuardiansCount, error: guardiansCountError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('role', ['guardian', 'parent'])
      .is('deleted_at', null)

    if (guardiansCountError) {
      console.warn('⚠️ Error counting guardians:', guardiansCountError)
    }

    // Active users (count where is_active=true, plus all students)
    const { count: activeUsersCount, error: activeUsersError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('deleted_at', null)

    if (activeUsersError) {
      console.warn('⚠️ Error counting active users:', activeUsersError)
    }

    // New registrations (count where created_at > 7 days ago)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoISO = weekAgo.toISOString()

    const { count: newRegistrationsCount, error: newRegistrationsError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgoISO)
      .is('deleted_at', null)

    if (newRegistrationsError) {
      console.warn('⚠️ Error counting new registrations:', newRegistrationsError)
    }

    // Also count new students from last week
    const { count: newStudentsCount, error: newStudentsError } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgoISO)
      .is('deleted_at', null)

    if (newStudentsError) {
      console.warn('⚠️ Error counting new students:', newStudentsError)
    }

    // Calculate active users: active principals + active teachers + active guardians + all students
    const activeUsersTotal = (activeUsersCount || 0) + (totalStudentsCount || 0)
    const newRegistrationsTotal = (newRegistrationsCount || 0) + (newStudentsCount || 0)

    const stats = {
      totalUsers: totalUsersCount || 0,
      totalTeachers: totalTeachersCount || 0,
      totalStudents: totalStudentsCount || 0,
      totalParents: totalGuardiansCount || 0,
      activeUsers: activeUsersTotal,
      newRegistrations: newRegistrationsTotal
    }

    // Fetch list data for tables
    // Principals (all, with org names)
    const { data: principalsData, error: principalsError } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at')
      .eq('role', 'principal')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (principalsError) {
      console.warn('⚠️ Error fetching principals:', principalsError)
    }

    const principals = (principalsData || []).map((p: any) => ({
      id: p.id,
      email: p.email || null,
      phone: p.phone || null,
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      full_name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null,
      org_id: p.org_id,
      is_active: p.is_active,
      created_at: p.created_at,
      org_name: orgMap.get(p.org_id) || null
    }))

    // Teachers (all orgs, with org names)
    const { data: teachersData, error: teachersError } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at')
      .eq('role', 'teacher')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (teachersError) {
      console.warn('⚠️ Error fetching teachers:', teachersError)
    }

    const teachers = (teachersData || []).map((t: any) => ({
      id: t.id,
      email: t.email || null,
      phone: t.phone || null,
      first_name: t.first_name || '',
      last_name: t.last_name || '',
      org_id: t.org_id || null,
      is_active: t.is_active !== false,
      created_at: t.created_at || new Date().toISOString(),
      org_name: orgMap.get(t.org_id) || null
    }))

    // Guardians (all orgs, with org names)
    const { data: guardiansData, error: guardiansError } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at')
      .in('role', ['guardian', 'parent'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (guardiansError) {
      console.warn('⚠️ Error fetching guardians:', guardiansError)
    }

    const guardians = (guardiansData || []).map((g: any) => ({
      id: g.id,
      email: g.email || null,
      phone: g.phone || null,
      full_name: [g.first_name, g.last_name].filter(Boolean).join(' ').trim() || '',
      org_id: g.org_id,
      is_active: g.is_active,
      created_at: g.created_at,
      org_name: orgMap.get(g.org_id) || null
    }))

    // Students (all orgs, with org names)
    // Need to join with users table to get user data
    const { data: studentsData, error: studentsError } = await supabaseAdmin
      .from('students')
      .select(`
        id,
        user_id,
        class_id,
        org_id,
        registration_time,
        start_date,
        barngildi,
        created_at,
        users!students_user_id_fkey (
          id,
          first_name,
          last_name,
          dob,
          gender,
          phone,
          address
        ),
        classes!students_class_id_fkey (
          id,
          name
        )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (studentsError) {
      console.warn('⚠️ Error fetching students:', studentsError)
    }

    const students = (studentsData || []).map((s: any) => ({
      id: s.id || s.user_id,
      user_id: s.user_id,
      class_id: s.class_id,
      org_id: s.org_id,
      first_name: s.users?.first_name || '',
      last_name: s.users?.last_name || null,
      dob: s.users?.dob || null,
      gender: s.users?.gender || 'unknown',
      phone: s.users?.phone || null,
      address: s.users?.address || null,
      registration_time: s.registration_time || null,
      start_date: s.start_date || null,
      barngildi: s.barngildi || null,
      created_at: s.created_at || new Date().toISOString(),
      classes: s.classes || null,
      org_name: orgMap.get(s.org_id) || null
    }))

    console.log('✅ Admin dashboard data loaded:', {
      stats,
      orgs: orgsList.length,
      principals: principals.length,
      teachers: teachers.length,
      guardians: guardians.length,
      students: students.length
    })

    return NextResponse.json({
      stats,
      orgs: orgsList,
      principals,
      teachers,
      guardians,
      students
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in admin-dashboard GET:', err)
    return NextResponse.json({ 
      error: err.message || 'Unknown error',
      details: err?.details || ''
    }, { status: 500 })
  }
}

