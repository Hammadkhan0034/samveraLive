import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import { userIdSchema } from '@/lib/validation';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import { getCurrentUserOrgId } from '@/lib/server-helpers';

/**
 * Handler for GET /api/teachers/[id]
 * Fetches a single teacher's details including:
 * - User information from users table
 * - Staff-specific data (education_level, union_name) from staff table
 * - Assigned classes from class_memberships
 * - Student count per class
 * - Total student count across all classes
 */
export async function handleGetTeacherDetails(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
  teacherId: string,
): Promise<NextResponse> {
  try {
    const metadata = user.user_metadata as UserMetadata | undefined;
    let orgId = metadata?.org_id;
    if (!orgId) {
      orgId = await getCurrentUserOrgId(user);
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization not found for user' },
        { status: 400 },
      );
    }

    // Validate teacher ID
    const idValidation = userIdSchema.safeParse(teacherId);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid teacher ID' },
        { status: 400 },
      );
    }

    // Fetch teacher user data
    const { data: teacherUser, error: userError } = await adminClient
      .from('users')
      .select(
        'id,email,phone,first_name,last_name,org_id,role,is_active,created_at,ssn,address,last_login_at,avatar_url,bio,gender,dob,status,updated_at',
      )
      .eq('id', teacherId)
      .eq('org_id', orgId)
      .single();

    if (userError || !teacherUser) {
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 404 },
      );
    }

    // Verify the user is a teacher
    if (teacherUser.role !== 'teacher') {
      return NextResponse.json(
        { error: 'User is not a teacher' },
        { status: 400 },
      );
    }

    // Fetch staff-specific data from staff table
    const { data: staffData, error: staffError } = await adminClient
      .from('staff')
      .select('education_level,union_name,created_at,updated_at')
      .eq('user_id', teacherId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (staffError) {
      console.error('❌ Error fetching staff data:', staffError);
      // Continue without staff data - teacher might not have staff record yet
    }

    // Fetch assigned classes from class_memberships
    const { data: memberships, error: membershipError } = await adminClient
      .from('class_memberships')
      .select(`
        class_id,
        membership_role,
        created_at,
        classes!inner(
          id,
          name,
          code,
          org_id,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', teacherId)
      .eq('membership_role', 'teacher')
      .eq('org_id', orgId);

    if (membershipError) {
      console.error('❌ Error fetching class memberships:', membershipError);
    }

    // Get class IDs
    const classIds = (memberships || [])
      .map((m: any) => m.classes?.id)
      .filter(Boolean) as string[];

    // Count students per class
    const classesWithStudentCounts = await Promise.all(
      (memberships || []).map(async (membership: any) => {
        const classData = membership.classes;
        if (!classData) return null;

        // Count students in this class
        const { count, error: countError } = await adminClient
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', classData.id)
          .eq('org_id', orgId)
          .is('deleted_at', null);

        if (countError) {
          console.error(
            `❌ Error counting students for class ${classData.id}:`,
            countError,
          );
        }

        return {
          id: classData.id,
          name: classData.name,
          code: classData.code || null,
          student_count: count || 0,
          created_at: classData.created_at,
          updated_at: classData.updated_at,
        };
      }),
    );

    // Filter out null values
    const classes = classesWithStudentCounts.filter(Boolean) as Array<{
      id: string;
      name: string;
      code: string | null;
      student_count: number;
      created_at: string;
      updated_at: string;
    }>;

    // Calculate total students across all classes
    const totalStudents = classes.reduce(
      (sum, cls) => sum + cls.student_count,
      0,
    );

    // Combine teacher data with staff data
    const teacher = {
      id: teacherUser.id,
      email: teacherUser.email,
      first_name: teacherUser.first_name,
      last_name: teacherUser.last_name,
      phone: teacherUser.phone || null,
      address: teacherUser.address || null,
      org_id: teacherUser.org_id,
      is_active: teacherUser.is_active,
      role: teacherUser.role,
      created_at: teacherUser.created_at,
      last_login_at: teacherUser.last_login_at || null,
      avatar_url: teacherUser.avatar_url || null,
      bio: teacherUser.bio || null,
      gender: teacherUser.gender || null,
      dob: teacherUser.dob || null,
      status: teacherUser.status || null,
      updated_at: teacherUser.updated_at,
      // Staff table fields
      education_level: staffData?.education_level || null,
      union_name: staffData?.union_name || null,
    };

    return NextResponse.json(
      {
        teacher,
        classes,
        total_students: totalStudents,
        total_classes: classes.length,
      },
      {
        status: 200,
        headers: getUserDataCacheHeaders(),
      },
    );
  } catch (err: any) {
    console.error('❌ Error in handleGetTeacherDetails:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
