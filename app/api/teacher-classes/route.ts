import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import { z } from 'zod';
import { validateQuery, userIdSchema } from '@/lib/validation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// GET query parameter schema
const getTeacherClassesQuerySchema = z.object({
  userId: userIdSchema,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(getTeacherClassesQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { userId } = queryValidation.data;

    const supabase = supabaseAdmin;

    // Get teacher's assigned classes from the users table
    // Try to fetch user data, but don't fail if user doesn't exist yet
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (userError) {
      // Continue anyway - user might exist in auth but not in users table yet
    }
    
    // First get the class memberships
    const { data: memberships, error: membershipError } = await supabase
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
        
        const { data: classDetails, error: classError } = await supabase
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

  } catch (error) {
    // Return empty array instead of error to prevent UI issues
    return NextResponse.json({ classes: [] }, {
      headers: getUserDataCacheHeaders()
    });
  }
}
