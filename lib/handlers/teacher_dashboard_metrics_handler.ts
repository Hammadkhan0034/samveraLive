import { NextResponse } from 'next/server';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getNoCacheHeaders } from '@/lib/cacheConfig';
import { getCurrentUserOrgId } from '@/lib/server-helpers';

export async function handleGetTeacherDashboardMetrics(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    // Get orgId from authenticated user
    const orgId = await getCurrentUserOrgId(user);
    
    // Get userId from authenticated session
    const userId = user.id;
    
    // Get teacher's classes from class_memberships
    const { data: teacherMemberships, error: membershipError } = await adminClient
      .from('class_memberships')
      .select('class_id')
      .eq('user_id', userId)
      .eq('org_id', orgId);
    
    if (membershipError) {
      console.error('Error fetching teacher memberships:', membershipError);
      return NextResponse.json({ error: 'Failed to fetch teacher classes' }, { status: 500 });
    }
    
    // Get validated class IDs from memberships
    const validatedClassIds = (teacherMemberships || []).map(m => m.class_id);

    const today = new Date().toISOString().split('T')[0];

    // Calculate classes count from validated class IDs
    const classesCount = validatedClassIds.length;

    // Fetch remaining metrics in parallel using Promise.allSettled
    const [
      attendanceResult,
      studentsResult,
    ] = await Promise.allSettled([
      // 1. Attendance count: Sum of attendance records for today across all classes
      (async () => {
        if (validatedClassIds.length === 0) return 0;
        
        try {
          const fetchPromises = validatedClassIds.map(async (classId) => {
            try {
              const { count, error } = await adminClient
                .from('attendance')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', orgId)
                .eq('class_id', classId)
                .eq('date', today);
              
              if (error) {
                console.error(`Error fetching attendance for class ${classId}:`, error);
                return 0;
              }
              
              return count || 0;
            } catch (err) {
              console.error(`Error in attendance fetch for class ${classId}:`, err);
              return 0;
            }
          });

          const results = await Promise.allSettled(fetchPromises);
          return results.reduce((sum, result) => {
            return sum + (result.status === 'fulfilled' ? result.value : 0);
          }, 0);
        } catch (err) {
          console.error('Error loading attendance count:', err);
          return 0;
        }
      })(),

      // 2. Students count: Total students from all teacher's classes
      (async () => {
        if (validatedClassIds.length === 0) return 0;
        
        try {
          const { count, error } = await adminClient
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .in('class_id', validatedClassIds)
            .is('deleted_at', null);
          
          if (error) {
            console.error('Error fetching students count:', error);
            return 0;
          }
          
          return count || 0;
        } catch (err) {
          console.error('Error loading students count:', err);
          return 0;
        }
      })(),

    ]);

    // Extract results, defaulting to 0 on failure
    const attendanceCount = attendanceResult.status === 'fulfilled' ? attendanceResult.value : 0;
    const studentsCount = studentsResult.status === 'fulfilled' ? studentsResult.value : 0;

    // Log any failures for debugging
    if (attendanceResult.status === 'rejected') {
      console.error('Attendance count failed:', attendanceResult.reason);
    }
    if (studentsResult.status === 'rejected') {
      console.error('Students count failed:', studentsResult.reason);
    }

    return NextResponse.json({
      classesCount,
      studentsCount,
      attendanceCount,
    }, {
      status: 200,
      headers: getNoCacheHeaders()
    });
  } catch (err: any) {
    console.error('❌ Error in teacher-dashboard-metrics handler:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

