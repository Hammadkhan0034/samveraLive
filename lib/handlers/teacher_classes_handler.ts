import { NextResponse } from 'next/server';
import type { AuthUser } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import { getCurrentUserOrgId } from '@/lib/server-helpers';

export async function handleGetTeacherClasses(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    // Get org_id from server side (user metadata or database)
    const orgId = await getCurrentUserOrgId(user);
    
    // Get user_id from authenticated user
    const userId = user.id;

    // Get teacher's assigned classes from the users table
    // Try to fetch user data, but don't fail if user doesn't exist yet
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (userError) {
      // Continue anyway - user might exist in auth but not in users table yet
    }
    
    // First get the class memberships
    const { data: memberships, error: membershipError } = await adminClient
      .from('class_memberships')
      .select('class_id, membership_role')
      .eq('user_id', userId);

    if (membershipError) {
      // Return empty array instead of error to prevent UI issues
      return NextResponse.json({ classes: [] }, {
        headers: getUserDataCacheHeaders()
      });
    }

    if (memberships && memberships.length > 0) {
      try {
        // Get class details for each membership
        const classIds = memberships.map(m => m.class_id);
        
        const { data: classDetails, error: classError } = await adminClient
          .from('classes')
          .select('id, name, code, org_id')
          .in('id', classIds)
          .is('deleted_at', null);

        if (classError) {
          // Return empty array to prevent UI errors
          return NextResponse.json({ classes: [] }, {
            headers: getUserDataCacheHeaders()
          });
        }
        
        if (!classDetails || classDetails.length === 0) {
          return NextResponse.json({ classes: [] }, {
            headers: getUserDataCacheHeaders()
          });
        }
        
        const classes = classDetails?.map(cls => ({
          id: cls.id,
          name: cls.name,
          code: cls.code
        })) || [];
        
        return NextResponse.json({ classes }, {
          headers: getUserDataCacheHeaders()
        });
      } catch (queryError) {
        // Return empty array on unexpected errors
        return NextResponse.json({ classes: [] }, {
          headers: getUserDataCacheHeaders()
        });
      }
    } else {
      // Return empty array instead of all organization classes
      return NextResponse.json({ classes: [] }, {
        headers: getUserDataCacheHeaders()
      });
    }
  } catch (err: unknown) {
    // Return empty array instead of error to prevent UI issues
    return NextResponse.json({ classes: [] }, {
      headers: getUserDataCacheHeaders()
    });
  }
}

