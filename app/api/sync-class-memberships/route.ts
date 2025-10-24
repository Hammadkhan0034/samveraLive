import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await request.json();

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    console.log('🔄 Syncing class memberships for organization:', orgId);

    // Get all staff members for this organization
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, metadata')
      .eq('org_id', orgId)
      .eq('role_id', 20); // Staff role

    if (staffError) {
      console.error('❌ Error fetching staff:', staffError);
      return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }

    console.log('👥 Found staff members:', staff?.length || 0);

    let syncedCount = 0;
    let errorCount = 0;

    // Process each staff member
    for (const member of staff || []) {
      const classId = member.metadata?.class_id;
      
      if (classId) {
        console.log(`🔗 Syncing ${member.full_name} to class ${classId}`);
        
        // Check if membership already exists
        const { data: existingMembership } = await supabaseAdmin
          .from('class_memberships')
          .select('id')
          .eq('user_id', member.id)
          .eq('class_id', classId)
          .single();

        if (!existingMembership) {
          // Create new membership
          const { error: membershipError } = await supabaseAdmin
            .from('class_memberships')
            .insert({
              user_id: member.id,
              class_id: classId,
              membership_role: 'teacher'
            });

          if (membershipError) {
            console.error(`❌ Failed to create membership for ${member.full_name}:`, membershipError);
            errorCount++;
          } else {
            console.log(`✅ Created membership for ${member.full_name}`);
            syncedCount++;
          }
        } else {
          console.log(`⚠️ Membership already exists for ${member.full_name}`);
        }
      } else {
        console.log(`⚠️ No class_id found for ${member.full_name}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync completed. ${syncedCount} memberships created, ${errorCount} errors.`,
      synced_count: syncedCount,
      error_count: errorCount,
      total_staff: staff?.length || 0
    });

  } catch (error) {
    console.error('💥 Error in sync-class-memberships API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
