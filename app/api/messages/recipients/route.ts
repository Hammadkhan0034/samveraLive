import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const org_id = searchParams.get('org_id');
    const user_role = searchParams.get('user_role');
    const search = searchParams.get('search') || '';

    if (!org_id || !user_role) {
      return NextResponse.json({ error: 'Missing org_id or user_role' }, { status: 400 });
    }

    // Determine which roles the current user can message
    let allowedRoles: string[] = [];
    if (user_role === 'principal') {
      allowedRoles = ['teacher', 'guardian', 'principal'];
    } else if (user_role === 'teacher') {
      allowedRoles = ['principal', 'guardian', 'teacher'];
    } else if (user_role === 'guardian' || user_role === 'parent') {
      allowedRoles = ['teacher', 'principal'];
    }

    if (allowedRoles.length === 0) {
      return NextResponse.json({ recipients: [] }, { status: 200 });
    }

    // Build query for users
    let query = supabaseAdmin
      .from('users')
      .select('id, email, first_name, last_name, role, org_id')
      .eq('org_id', org_id)
      .in('role', allowedRoles)
      .is('deleted_at', null)
      .order('first_name', { ascending: true })
      .order('last_name', { ascending: true });

    // Apply search filter if provided
    if (search.trim()) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error } = await query.limit(100);

    if (error) {
      console.error('❌ Error fetching recipients:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to include full name
    const recipients = (users || []).map((user: any) => ({
      id: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unknown',
      role: user.role,
      org_id: user.org_id
    }));

    // Group by role for easier UI rendering
    const grouped = allowedRoles.reduce((acc: any, role: string) => {
      acc[role] = recipients.filter((r: any) => r.role === role);
      return acc;
    }, {});

    console.log('✅ Fetched recipients:', recipients.length);
    return NextResponse.json({ recipients, grouped }, { status: 200 });
  } catch (err: any) {
    console.error('💥 Error in GET /api/messages/recipients:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

