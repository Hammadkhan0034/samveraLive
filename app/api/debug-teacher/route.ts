import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('🔍 Debug info for teacher:', userId);

    // Use service role key to bypass RLS policies
    let userData;
    const { data: initialUserData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, org_id, is_active')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      console.error('❌ User ID:', userId);
      console.error('❌ Error details:', userError.message);
      
      // Try to get all users to see what's available
      const { data: allUsers, error: allUsersError } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email, org_id, is_active')
        .limit(10);
      
      console.log('🔍 All users in database:', allUsers);
      
      // Check if user exists in auth.users but not in public.users
      if (userError.code === 'PGRST116') {
        console.log('⚠️ User not found in public.users table, but might exist in auth.users');
        
        // Try to get user from auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (authUser && authUser.user) {
          console.log('✅ User found in auth, creating in public.users table');
          
          // Create user in public.users table
          const { data: newUser, error: createError } = await supabaseAdmin
            .from('users')
            .insert({
              id: userId,
              full_name: 'Unknown',
              email: authUser.user.email,
              org_id: authUser.user.user_metadata?.org_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
              is_active: true
            })
            .select()
            .single();
          
          if (createError) {
            console.error('❌ Error creating user:', createError);
            return NextResponse.json({ 
              error: 'Failed to create user in database', 
              details: createError.message 
            }, { status: 500 });
          }
          
          console.log('✅ User created successfully:', newUser);
          // Set userData to the newly created user
          userData = newUser;
        } else {
          return NextResponse.json({ 
            error: 'User not found in database or auth', 
            details: userError.message,
            userId: userId,
            availableUsers: allUsers || []
          }, { status: 500 });
        }
      } else {
        return NextResponse.json({ 
          error: 'Failed to fetch user data', 
          details: userError.message,
          userId: userId,
          availableUsers: allUsers || []
        }, { status: 500 });
      }
    } else {
      userData = initialUserData;
      console.log('✅ User data found:', userData);
    }

    // Get class memberships for this user
    console.log('🔍 Looking for class memberships for user:', userId);
    
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('class_memberships')
      .select(`
        class_id,
        membership_role,
        classes!inner(id, name, description, org_id)
      `)
      .eq('user_id', userId)
      .eq('classes.org_id', userData.org_id);

    if (membershipError) {
      console.error('❌ Error fetching class memberships:', membershipError);
    } else {
      console.log('🔍 Class memberships found:', memberships);
    }

    const assignedClasses = memberships || [];
    const classIds = assignedClasses.map(m => m.class_id);

    // Get all classes for the organization
    const { data: allClasses, error: classesError } = await supabaseAdmin
      .from('classes')
      .select('id, name, description, org_id')
      .eq('org_id', userData.org_id);

    // Get students for the organization
    const { data: allStudents, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, first_name, last_name, class_id, org_id')
      .eq('org_id', userData.org_id);

    // Get student requests for the organization (if table exists)
    let allRequests: any[] = [];
    try {
      const { data: requestsData, error: requestsError } = await supabaseAdmin
        .from('student_requests')
        .select('id, first_name, last_name, class_id, status, org_id')
        .eq('org_id', userData.org_id);
      
      if (!requestsError) {
        allRequests = requestsData || [];
      }
    } catch (error) {
      console.log('⚠️ student_requests table does not exist yet');
    }

    return NextResponse.json({
      user: userData,
      classes: allClasses || [],
      students: allStudents || [],
      student_requests: allRequests || [],
      debug_info: {
        user_has_class_id: assignedClasses.length > 0,
        user_class_ids: classIds,
        user_org_id: userData.org_id,
        total_classes: allClasses?.length || 0,
        total_students: allStudents?.length || 0,
        total_requests: allRequests?.length || 0,
        assigned_classes: assignedClasses.length
      }
    });

  } catch (error) {
    console.error('💥 Error in debug-teacher API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
