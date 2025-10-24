import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    if (!classId) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
    }

    console.log('🔍 Testing class existence:', classId);

    // Check if class exists
    const { data: classData, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id, name, description, org_id')
      .eq('id', classId)
      .single();

    if (classError) {
      console.error('❌ Error fetching class:', classError);
      return NextResponse.json({ 
        error: 'Class not found', 
        details: classError.message,
        classId: classId
      }, { status: 404 });
    }

    console.log('✅ Class found:', classData);
    return NextResponse.json({ 
      success: true, 
      class: classData,
      message: 'Class exists in database'
    });

  } catch (error) {
    console.error('💥 Error in test-class API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
