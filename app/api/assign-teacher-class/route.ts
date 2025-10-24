import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { userId, classId } = await request.json();

    if (!userId || !classId) {
      return NextResponse.json({ error: 'User ID and Class ID are required' }, { status: 400 });
    }

    console.log('🔧 Assigning teacher to class:', { userId, classId });

    // First, remove any existing memberships for this user
    const { error: deleteError } = await supabaseAdmin
      .from('class_memberships')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ Error removing existing memberships:', deleteError);
    }

    // Add new membership using class_memberships table
    const { data, error } = await supabaseAdmin
      .from('class_memberships')
      .insert({
        user_id: userId,
        class_id: classId,
        membership_role: 'teacher'
      })
      .select();

    if (error) {
      console.error('❌ Error creating class membership:', error);
      return NextResponse.json({ error: 'Failed to assign class to teacher' }, { status: 500 });
    }

    console.log('✅ Teacher assigned to class successfully:', data);
    return NextResponse.json({ 
      success: true, 
      message: 'Teacher assigned to class successfully',
      membership: data[0]
    });

  } catch (error) {
    console.error('💥 Error in assign-teacher-class API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
