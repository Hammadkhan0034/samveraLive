import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    console.log('🔍 Testing if student_requests table exists...');
    
    // Try to query the table
    const { data, error } = await supabaseAdmin
      .from('student_requests')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Table error:', error);
      return NextResponse.json({ 
        error: `Table error: ${error.message}`,
        code: error.code,
        details: error.details,
        hint: error.hint
      }, { status: 500 });
    }

    console.log('✅ Table exists and is accessible');
    return NextResponse.json({ 
      success: true, 
      message: 'student_requests table exists and is accessible',
      data: data || []
    });

  } catch (err: any) {
    console.error('💥 Test error:', err);
    return NextResponse.json({ 
      error: err.message || 'Unknown error' 
    }, { status: 500 });
  }
}
