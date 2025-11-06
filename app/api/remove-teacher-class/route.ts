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

    console.log('🔧 Removing teacher from class:', { userId, classId });

    // Remove membership from class_memberships table
    const { error } = await supabaseAdmin
      .from('class_memberships')
      .delete()
      .eq('user_id', userId)
      .eq('class_id', classId);

    if (error) {
      console.error('❌ Error removing class membership:', error);
      return NextResponse.json({ error: 'Failed to remove teacher from class' }, { status: 500 });
    }

    console.log('✅ Teacher removed from class successfully');
    return NextResponse.json({ 
      success: true, 
      message: 'Teacher removed from class successfully'
    });

  } catch (error) {
    console.error('💥 Error in remove-teacher-class API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

