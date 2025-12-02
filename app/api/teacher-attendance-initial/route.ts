import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import { getAuthUserWithOrg, MissingOrgIdError, mapAuthErrorToResponse } from '@/lib/server-helpers';

/**
 * Unified endpoint that returns all data needed for teacher attendance page
 * Returns classes, students, and today's attendance in a single request
 */
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Admin client not configured' },
        { status: 500 }
      );
    }

    // Derive userId and orgId from authenticated session instead of query params
    let userId: string;
    let orgId: string | null = null;
    try {
      const user = await getAuthUserWithOrg();
      userId = user.id;
      orgId = user.user_metadata?.org_id || null;
      if (!orgId) {
        throw new MissingOrgIdError();
      }
    } catch (err) {
      return mapAuthErrorToResponse(err);
    }

    // Fetch all data in parallel
    const [classesResult, studentsResult, attendanceResult] = await Promise.allSettled([
      // 1. Fetch teacher classes
      (async () => {
        const { data: memberships, error: membershipError } = await supabaseAdmin
          .from('class_memberships')
          .select('class_id, membership_role')
          .eq('user_id', userId);

        if (membershipError || !memberships || memberships.length === 0) {
          return [];
        }

        const classIds = memberships.map(m => m.class_id);
        const { data: classDetails, error: classError } = await supabaseAdmin
          .from('classes')
          .select('id, name, code, org_id')
          .in('id', classIds)
          .is('deleted_at', null);

        if (classError || !classDetails) {
          return [];
        }

        return classDetails.map(cls => ({
          id: cls.id,
          name: cls.name,
          code: cls.code,
        }));
      })(),

      // 2. Fetch students for all classes (if orgId available)
      (async () => {
        if (!orgId) return [];

        // First get class IDs for this teacher
        const { data: memberships } = await supabaseAdmin
          .from('class_memberships')
          .select('class_id')
          .eq('user_id', userId);

        if (!memberships || memberships.length === 0) {
          return [];
        }

        const classIds = memberships.map(m => m.class_id);

        // Fetch students for all classes
        const { data: students, error } = await supabaseAdmin
          .from('students')
          .select(`
            id,
            user_id,
            class_id,
            users!students_user_id_fkey (
              id,
              first_name,
              last_name,
              dob,
              gender,
              phone,
              address,
              ssn
            ),
            registration_time,
            start_date,
            barngildi,
            student_language,
            created_at,
            updated_at,
            classes!students_class_id_fkey (
              id,
              name
            )
          `)
          .is('deleted_at', null)
          .eq('org_id', orgId)
          .in('class_id', classIds)
          .order('created_at', { ascending: false });

        if (error || !students) {
          return [];
        }

        // Fetch guardians for all students
        const studentsWithGuardians = await Promise.all(
          students.map(async (student) => {
            if (!supabaseAdmin) {
              return {
                ...student,
                guardians: [],
              };
            }
            const { data: guardianRelations } = await supabaseAdmin
              .from('guardian_students')
              .select(`
                id,
                relation,
                guardian_id,
                student_id,
                users!guardian_students_guardian_id_fkey (
                  id,
                  first_name,
                  last_name,
                  email
                )
              `)
              .eq('student_id', student.id);

            return {
              ...student,
              guardians: guardianRelations || [],
            };
          })
        );

        return studentsWithGuardians;
      })(),

      // 3. Fetch today's attendance (if orgId available)
      (async () => {
        if (!orgId) return [];

        const today = new Date().toISOString().split('T')[0];

        // Get class IDs for this teacher
        const { data: memberships } = await supabaseAdmin
          .from('class_memberships')
          .select('class_id')
          .eq('user_id', userId);

        if (!memberships || memberships.length === 0) {
          return [];
        }

        const classIds = memberships.map(m => m.class_id);

        const { data: attendance, error } = await supabaseAdmin
          .from('attendance')
          .select(`
            id,
            org_id,
            class_id,
            student_id,
            date,
            status,
            notes,
            recorded_by,
            created_at,
            updated_at
          `)
          .eq('org_id', orgId)
          .eq('date', today)
          .in('class_id', classIds);

        if (error || !attendance) {
          return [];
        }

        return attendance;
      })(),
    ]);

    // Extract results
    const classes = classesResult.status === 'fulfilled' ? classesResult.value : [];
    const students = studentsResult.status === 'fulfilled' ? studentsResult.value : [];
    const attendance = attendanceResult.status === 'fulfilled' ? attendanceResult.value : [];

    // Log any errors
    if (classesResult.status === 'rejected') {
      console.error('Error fetching classes:', classesResult.reason);
    }
    if (studentsResult.status === 'rejected') {
      console.error('Error fetching students:', studentsResult.reason);
    }
    if (attendanceResult.status === 'rejected') {
      console.error('Error fetching attendance:', attendanceResult.reason);
    }

    return NextResponse.json(
      {
        classes,
        students,
        attendance,
      },
      {
        status: 200,
        headers: getUserDataCacheHeaders(),
      }
    );
  } catch (error: any) {
    console.error('Error in teacher-attendance-initial GET:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

