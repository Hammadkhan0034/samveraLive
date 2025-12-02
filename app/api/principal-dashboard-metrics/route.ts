import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getNoCacheHeaders } from '@/lib/cacheConfig';
import { getAuthUserWithOrg, MissingOrgIdError, mapAuthErrorToResponse } from '@/lib/server-helpers';

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured');
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    // Get authenticated user and orgId from server-side auth (no query params needed)
    let orgId: string;
    let user;
    try {
      user = await getAuthUserWithOrg();
      orgId = user.user_metadata?.org_id;
      if (!orgId) {
        throw new MissingOrgIdError();
      }
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return mapAuthErrorToResponse(err);
      }
      const message = err instanceof Error ? err.message : 'Authentication required';
      return NextResponse.json({ error: message }, { status: 401 });
    }

    // Check if user has principal or admin role
    const userRoles = user.user_metadata?.roles || [];
    const hasAccess = userRoles.some((role: string) => ['principal', 'admin'].includes(role));
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied. Principal or admin role required.' 
      }, { status: 403 });
    }

    // Fetch all metrics in parallel using Promise.allSettled
    const [
      studentsResult,
      staffResult,
      classesResult,
      menusResult
    ] = await Promise.allSettled([
      // 1. Students count: Count from students table filtered by org_id, excluding deleted
      (async () => {
        try {
          const { count, error } = await supabaseAdmin
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
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

      // 2. Staff count: Count from staff table joined with users table, filtered by org_id and active status
      (async () => {
        try {
          const { data: staffData, error: staffErr } = await supabaseAdmin
            .from('staff')
            .select(`
              id,
              users!inner(id,is_active,deleted_at)
            `)
            .eq('org_id', orgId);
          
          if (staffErr) {
            console.error('Error fetching staff count:', staffErr);
            return 0;
          }
          
          // Filter to only active and non-deleted staff
          const activeStaff = (staffData || []).filter((s: any) => 
            s.users?.is_active === true && !s.users?.deleted_at
          );
          
          return activeStaff.length;
        } catch (err) {
          console.error('Error loading staff count:', err);
          return 0;
        }
      })(),

      // 3. Classes count: Count from classes table filtered by org_id, excluding deleted
      (async () => {
        try {
          const { count, error } = await supabaseAdmin
            .from('classes')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .is('deleted_at', null);
          
          if (error) {
            console.error('Error fetching classes count:', error);
            return 0;
          }
          
          return count || 0;
        } catch (err) {
          console.error('Error loading classes count:', err);
          return 0;
        }
      })(),

      // 4. Menus count: Count from menus table filtered by org_id, excluding deleted
      (async () => {
        try {
          const { count, error } = await supabaseAdmin
            .from('menus')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .is('deleted_at', null);
          
          if (error) {
            console.error('Error fetching menus count:', error);
            return 0;
          }
          
          return count || 0;
        } catch (err) {
          console.error('Error loading menus count:', err);
          return 0;
        }
      })(),

    ]);

    // Extract results, defaulting to 0 on failure
    const studentsCount = studentsResult.status === 'fulfilled' ? studentsResult.value : 0;
    const staffCount = staffResult.status === 'fulfilled' ? staffResult.value : 0;
    const classesCount = classesResult.status === 'fulfilled' ? classesResult.value : 0;
    const menusCount = menusResult.status === 'fulfilled' ? menusResult.value : 0;

    // Log any failures for debugging
    if (studentsResult.status === 'rejected') {
      console.error('Students count failed:', studentsResult.reason);
    }
    if (staffResult.status === 'rejected') {
      console.error('Staff count failed:', staffResult.reason);
    }
    if (classesResult.status === 'rejected') {
      console.error('Classes count failed:', classesResult.reason);
    }
    if (menusResult.status === 'rejected') {
      console.error('Menus count failed:', menusResult.reason);
    }

    return NextResponse.json({
      studentsCount,
      staffCount,
      classesCount,
      menusCount,
    }, {
      status: 200,
      headers: getNoCacheHeaders()
    });
  } catch (err: any) {
    console.error('❌ Error in principal-dashboard-metrics GET:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

