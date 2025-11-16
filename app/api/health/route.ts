import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    // Test database connection
    const { error } = await supabase.from('users').select('id').limit(1);
    
    if (error) {
      return NextResponse.json(
        { status: 'unhealthy', error: error.message },
        { status: 503 }
      );
    }
    
    return NextResponse.json({ status: 'healthy' });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'unhealthy', error: err.message || 'Unknown error' },
      { status: 503 }
    );
  }
}

