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

    console.log('🔍 Fetching classes for teacher:', userId);

    const supabase = supabaseAdmin;

    // Get teacher's assigned classes from the users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }

    if (!userData) {
      console.error('❌ User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('👤 User data:', userData);
    console.log('👤 User org_id:', userData.org_id);

    // Get teacher's assigned classes from class_memberships table
    console.log('🔍 Looking for class memberships for user:', userId);
    
    // First get the class memberships
    const { data: memberships, error: membershipError } = await supabase
      .from('class_memberships')
      .select('class_id, membership_role')
      .eq('user_id', userId);

    if (membershipError) {
      console.error('❌ Error fetching class memberships:', membershipError);
      return NextResponse.json({ error: 'Failed to fetch class memberships' }, { status: 500 });
    }

    console.log('🔍 Class memberships found:', memberships);

    if (memberships && memberships.length > 0) {
      try {
        // Get class details for each membership
        const classIds = memberships.map(m => m.class_id);
        console.log('🔍 Fetching class details for IDs:', classIds);
        
        const { data: classDetails, error: classError } = await supabase
          .from('classes')
          .select('id, name, code, org_id')
          .in('id', classIds)
          .is('deleted_at', null);

        if (classError) {
          console.error('❌ Error fetching class details:', classError);
          console.error('❌ Class IDs being queried:', classIds);
          console.error('❌ User org_id:', userData.org_id);
          console.error('❌ Full error details:', JSON.stringify(classError, null, 2));
          // Instead of returning error, return empty array to prevent UI errors
          console.log('⚠️ Returning empty classes array due to database error');
          return NextResponse.json({ classes: [] }, {
            headers: getUserDataCacheHeaders()
          });
        }

        console.log('✅ Class details found:', classDetails);
        
        if (!classDetails || classDetails.length === 0) {
          console.error('❌ No class details found for IDs:', classIds);
          console.error('❌ This might mean the class was deleted or doesn\'t exist');
          console.log('⚠️ Returning empty classes array instead of error');
          return NextResponse.json({ classes: [] }, {
            headers: getUserDataCacheHeaders()
          });
        }
        
        const classes = classDetails?.map(cls => ({
          id: cls.id,
          name: cls.name,
          code: cls.code
        })) || [];
        
        console.log('✅ Assigned classes found:', classes);
        return NextResponse.json({ classes }, {
          headers: getUserDataCacheHeaders()
        });
      } catch (queryError) {
        console.error('💥 Unexpected error in class details query:', queryError);
        console.log('⚠️ Returning empty classes array due to unexpected error');
        return NextResponse.json({ classes: [] }, {
          headers: getUserDataCacheHeaders()
        });
      }
    } else {
      console.log('⚠️ No class memberships found for this teacher');
      // Return empty array instead of all organization classes
      return NextResponse.json({ classes: [] }, {
        headers: getUserDataCacheHeaders()
      });
    }

  } catch (error) {
    console.error('💥 Error in teacher-classes API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
