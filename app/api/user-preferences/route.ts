import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireServerAuth } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const { user } = await requireServerAuth();
    const supabase = await createSupabaseServer();
    
    const { data, error } = await supabase
      .from('users')
      .select('theme, language')
      .eq('id', user.id)
      .maybeSingle();
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      theme: (data?.theme as 'light' | 'dark' | 'system') || 'system',
      language: (data?.language as 'en' | 'is') || 'en',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}

