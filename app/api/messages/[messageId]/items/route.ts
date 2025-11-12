import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(
  request: Request,
  { params }: { params: { messageId: string } }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { messageId } = params;
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // Verify user is a participant in this thread
    const { data: participant, error: participantError } = await supabaseAdmin
      .from('message_participants')
      .select('id, unread')
      .eq('message_id', messageId)
      .eq('user_id', user_id)
      .maybeSingle();

    if (participantError || !participant) {
      return NextResponse.json({ error: 'Access denied or thread not found' }, { status: 403 });
    }

    // Get message items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('message_items')
      .select(`
        id,
        message_id,
        author_id,
        body,
        attachments,
        created_at,
        updated_at,
        users!inner(
          id,
          first_name,
          last_name,
          email,
          role
        )
      `)
      .eq('message_id', messageId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (itemsError) {
      console.error('❌ Error fetching message items:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // Mark thread as read for this user
    if (participant.unread) {
      await supabaseAdmin
        .from('message_participants')
        .update({ unread: false })
        .eq('message_id', messageId)
        .eq('user_id', user_id);
    }

    // Transform items to include author info
    const transformedItems = (items || []).map((item: any) => {
      const user = Array.isArray(item.users) ? item.users[0] : item.users;
      return {
        id: item.id,
        message_id: item.message_id,
        author_id: item.author_id,
        author_name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'Unknown',
        author_email: user?.email,
        author_role: user?.role,
        body: item.body,
        attachments: item.attachments || [],
        created_at: item.created_at,
        updated_at: item.updated_at
      };
    });

    console.log('✅ Fetched message items:', transformedItems.length);
    return NextResponse.json({ items: transformedItems.reverse() }, { status: 200 }); // Reverse to show oldest first
  } catch (err: any) {
    console.error('💥 Error in GET /api/messages/[messageId]/items:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { messageId: string } }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { messageId } = params;
    const body = await request.json();
    const { user_id, org_id, body: messageBody, attachments = [] } = body;

    if (!user_id || !org_id || !messageBody || !messageBody.trim()) {
      return NextResponse.json({ error: 'Missing required fields: user_id, org_id, body' }, { status: 400 });
    }

    // Verify user is a participant
    const { data: participant, error: participantError } = await supabaseAdmin
      .from('message_participants')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user_id)
      .maybeSingle();

    if (participantError || !participant) {
      return NextResponse.json({ error: 'Access denied or thread not found' }, { status: 403 });
    }

    // Verify message exists and belongs to org
    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .select('id, org_id')
      .eq('id', messageId)
      .eq('org_id', org_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message thread not found' }, { status: 404 });
    }

    // Create message item
    const { data: item, error: itemError } = await supabaseAdmin
      .from('message_items')
      .insert({
        org_id,
        message_id: messageId,
        author_id: user_id,
        body: messageBody.trim(),
        attachments: Array.isArray(attachments) ? attachments : []
      })
      .select()
      .single();

    if (itemError || !item) {
      console.error('❌ Error creating message item:', itemError);
      return NextResponse.json({ error: itemError?.message || 'Failed to create message' }, { status: 500 });
    }

    // Mark all other participants as unread
    await supabaseAdmin
      .from('message_participants')
      .update({ unread: true })
      .eq('message_id', messageId)
      .neq('user_id', user_id);

    // Update message updated_at timestamp
    await supabaseAdmin
      .from('messages')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', messageId);

    console.log('✅ Created message item:', item.id);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err: any) {
    console.error('💥 Error in POST /api/messages/[messageId]/items:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

