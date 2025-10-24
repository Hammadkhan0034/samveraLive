import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    console.log('🏗️ Creating student_requests table...');

    // Try to insert a test record to check if table exists
    const { data: testData, error: testError } = await supabaseAdmin
      .from('student_requests')
      .insert({
        org_id: '00000000-0000-0000-0000-000000000000',
        class_id: '00000000-0000-0000-0000-000000000000',
        first_name: 'test',
        requested_by: '00000000-0000-0000-0000-000000000000'
      })
      .select();

    if (testError && testError.message.includes('does not exist')) {
      console.log('❌ Table does not exist, please create it manually');
      return NextResponse.json({ 
        error: 'Table does not exist', 
        suggestion: 'Please create the student_requests table in your database first. You can run the SQL from db-design.sql file in your Supabase SQL editor.'
      }, { status: 400 });
    }

    if (testData) {
      // Delete the test record
      await supabaseAdmin
        .from('student_requests')
        .delete()
        .eq('id', testData[0].id);
    }

    console.log('✅ Table exists and is accessible');
    return NextResponse.json({ 
      success: true, 
      message: 'student_requests table is accessible' 
    });

  } catch (error) {
    console.error('💥 Error checking table:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}