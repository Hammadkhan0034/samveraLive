import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const orgId = searchParams.get('orgId');

    console.log('🔍 Debug class memberships for:', { userId, orgId });

    // First, check if class_memberships table exists by trying a simple query
    let allMemberships: any[] = [];
    let tableExists = false;
    
    try {
      const { data: testData, error: testError } = await supabaseAdmin
        .from('class_memberships')
        .select('id')
        .limit(1);

      if (testError) {
        console.error('❌ class_memberships table error:', testError);
        return NextResponse.json({ 
          error: 'class_memberships table issue', 
          details: testError.message,
          suggestion: 'Please create the class_memberships table first'
        }, { status: 500 });
      }

      tableExists = true;
      console.log('✅ class_memberships table exists');

      // Now get all memberships
      const { data: membershipsData, error: allError } = await supabaseAdmin
        .from('class_memberships')
        .select(`
          id,
          user_id,
          class_id,
          membership_role,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (allError) {
        console.error('❌ Error fetching memberships:', allError);
        return NextResponse.json({ 
          error: 'Failed to fetch memberships', 
          details: allError.message 
        }, { status: 500 });
      }

      allMemberships = membershipsData || [];
      console.log('✅ Fetched memberships:', allMemberships.length);

    } catch (error) {
      console.error('❌ Table access error:', error);
      return NextResponse.json({ 
        error: 'Cannot access class_memberships table', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    // Get memberships for specific user if provided
    let userMemberships: any[] = [];
    if (userId && tableExists) {
      const { data: userMembershipsData, error: userError } = await supabaseAdmin
        .from('class_memberships')
        .select(`
          id,
          user_id,
          class_id,
          membership_role,
          created_at
        `)
        .eq('user_id', userId);

      if (!userError) {
        userMemberships = userMembershipsData || [];
        console.log('✅ User memberships:', userMemberships.length);
      } else {
        console.error('❌ Error fetching user memberships:', userError);
      }
    }

    // Get memberships for specific org if provided
    let orgMemberships: any[] = [];
    if (orgId && tableExists) {
      // First get classes for this org, then get memberships for those classes
      const { data: orgClasses } = await supabaseAdmin
        .from('classes')
        .select('id')
        .eq('org_id', orgId);

      if (orgClasses && orgClasses.length > 0) {
        const classIds = orgClasses.map(c => c.id);
        const { data: orgMembershipsData, error: orgError } = await supabaseAdmin
          .from('class_memberships')
          .select(`
            id,
            user_id,
            class_id,
            membership_role,
            created_at
          `)
          .in('class_id', classIds);

        if (!orgError) {
          orgMemberships = orgMembershipsData || [];
          console.log('✅ Org memberships:', orgMemberships.length);
        } else {
          console.error('❌ Error fetching org memberships:', orgError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      table_exists: tableExists,
      total_memberships: allMemberships?.length || 0,
      user_memberships: userMemberships,
      org_memberships: orgMemberships,
      all_memberships: allMemberships || [],
      debug_info: {
        user_id: userId,
        org_id: orgId,
        user_has_memberships: userMemberships.length > 0,
        org_has_memberships: orgMemberships.length > 0,
        table_accessible: tableExists
      }
    });

  } catch (error) {
    console.error('💥 Error in debug-class-memberships API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
