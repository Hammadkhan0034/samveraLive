import { NextResponse } from 'next/server';
import type { AuthUser } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleGetUserPreferences(
  _request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const { data, error } = await adminClient
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
    theme: (data?.theme as 'light' | 'dark') || 'light',
    language: (data?.language as 'en' | 'is') || 'is',
  });
}

