import { NextResponse } from 'next/server';
import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import type { AuthUser } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleGetAdminDashboard(
  _request: Request,
  _user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    // Fetch all organizations
    const { data: orgs, error: orgsError } = await adminClient
      .from('orgs')
      .select('id,name,slug,timezone,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (orgsError) {
      return NextResponse.json({ error: orgsError.message }, { status: 500 });
    }

    const orgsList = orgs || [];
    const orgMap = new Map(orgsList.map(o => [o.id, o.name]));

    // Calculate statistics using efficient database queries
    // Total unique users (count distinct user IDs across all roles)
    const { count: totalUsersCount, error: usersCountError } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    if (usersCountError) {
      // Continue with count = 0
    }

    // Total teachers (count where role='teacher')
    const { count: totalTeachersCount, error: teachersCountError } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'teacher')
      .is('deleted_at', null);

    if (teachersCountError) {
      // Continue with count = 0
    }

    // Total students (count from students table)
    const { count: totalStudentsCount, error: studentsCountError } = await adminClient
      .from('students')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    if (studentsCountError) {
      // Continue with count = 0
    }

    // Total guardians (count where role='guardian')
    const { count: totalGuardiansCount, error: guardiansCountError } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'guardian')
      .is('deleted_at', null);

    if (guardiansCountError) {
      // Continue with count = 0
    }

    // Active users (count where is_active=true, plus all students)
    const { count: activeUsersCount, error: activeUsersError } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('deleted_at', null);

    if (activeUsersError) {
      // Continue with count = 0
    }

    // New registrations (count where created_at > 7 days ago)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    const { count: newRegistrationsCount, error: newRegistrationsError } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgoISO)
      .is('deleted_at', null);

    if (newRegistrationsError) {
      // Continue with count = 0
    }

    // Also count new students from last week
    const { count: newStudentsCount, error: newStudentsError } = await adminClient
      .from('students')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgoISO)
      .is('deleted_at', null);

    if (newStudentsError) {
      // Continue with count = 0
    }

    // Calculate active users: active principals + active teachers + active guardians + all students
    const activeUsersTotal = (activeUsersCount || 0) + (totalStudentsCount || 0);
    const newRegistrationsTotal = (newRegistrationsCount || 0) + (newStudentsCount || 0);

    const stats = {
      totalUsers: totalUsersCount || 0,
      totalTeachers: totalTeachersCount || 0,
      totalStudents: totalStudentsCount || 0,
      totalParents: totalGuardiansCount || 0,
      activeUsers: activeUsersTotal,
      newRegistrations: newRegistrationsTotal
    };

    // Fetch list data for tables
    // Principals (all, with org names)
    const { data: principalsData, error: principalsError } = await adminClient
      .from('users')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at')
      .eq('role', 'principal')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (principalsError) {
      // Continue with empty array
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
    }));

    // Teachers (all orgs, with org names)
    const { data: teachersData, error: teachersError } = await adminClient
      .from('users')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at')
      .eq('role', 'teacher')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (teachersError) {
      // Continue with empty array
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
    }));

    // Guardians (all orgs, with org names)
    const { data: guardiansData, error: guardiansError } = await adminClient
      .from('users')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at')
      .eq('role', 'guardian')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (guardiansError) {
      // Continue with empty array
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
    }));

    // Students (all orgs, with org names)
    // Need to join with users table to get user data
    const { data: studentsData, error: studentsError } = await adminClient
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
      .order('created_at', { ascending: false });

    if (studentsError) {
      // Continue with empty array
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
    }));

    return NextResponse.json({
      stats,
      orgs: orgsList,
      principals,
      teachers,
      guardians,
      students
    }, {
      status: 200,
      headers: getUserDataCacheHeaders()
    });

  } catch (err: any) {
    return NextResponse.json({ 
      error: err.message || 'Unknown error',
      details: err?.details || ''
    }, { status: 500 });
  }
}

