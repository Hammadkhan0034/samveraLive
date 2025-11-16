import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireServerAuth } from '@/lib/supabaseServer';
import { getRealtimeDataCacheHeaders } from '@/lib/cacheConfig';

async function getRequesterOrgId(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('org_id')
    .eq('id', userId)
    .maybeSingle();
  
  if (error || !data) return null;
  return data.org_id;
}

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { user } = await requireServerAuth();
    const orgId = await getRequesterOrgId(user.id);
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    // Verify user has access to this message thread
    const { data: participant } = await supabaseAdmin
      .from('message_participants')
      .select('message_id')
      .eq('user_id', user.id)
      .eq('message_id', messageId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!participant) {
      return NextResponse.json({ error: 'Message thread not found or access denied' }, { status: 404 });
    }

    // Fetch message items
    const { data: items, error } = await supabaseAdmin
      .from('message_items')
      .select(`
        *,
        users!author_id(id, first_name, last_name, email)
      `)
      .eq('message_id', messageId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching message items:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mark thread as read for this user
    await supabaseAdmin
      .from('message_participants')
      .update({ unread: false })
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('org_id', orgId);

    return NextResponse.json({ items: items || [] }, {
      status: 200,
      headers: getRealtimeDataCacheHeaders()
    });
  } catch (err: any) {
    console.error('❌ Error in message-items GET:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { user } = await requireServerAuth();
    const orgId = await getRequesterOrgId(user.id);
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const { message_id, body: messageBody, attachments = [] } = body;

    if (!message_id) {
      return NextResponse.json({ error: 'message_id is required' }, { status: 400 });
    }

    if (!messageBody || !messageBody.trim()) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    }

    // Verify user has access to this message thread
    const { data: participant } = await supabaseAdmin
      .from('message_participants')
      .select('message_id')
      .eq('user_id', user.id)
      .eq('message_id', message_id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!participant) {
      return NextResponse.json({ error: 'Message thread not found or access denied' }, { status: 404 });
    }

    // Create message item
    const { data: item, error } = await supabaseAdmin
      .from('message_items')
      .insert({
        org_id: orgId,
        message_id,
        author_id: user.id,
        body: messageBody.trim(),
        attachments: Array.isArray(attachments) ? attachments : [],
        edit_history: []
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating message item:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mark thread as unread for all other participants
    await supabaseAdmin
      .from('message_participants')
      .update({ unread: true })
      .eq('message_id', message_id)
      .neq('user_id', user.id)
      .eq('org_id', orgId);

    return NextResponse.json({ item }, { status: 201 });
  } catch (err: any) {
    console.error('❌ Error in message-items POST:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { user } = await requireServerAuth();
    const orgId = await getRequesterOrgId(user.id);
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const { id, body: messageBody } = body;

    if (!id) {
      return NextResponse.json({ error: 'Message item ID is required' }, { status: 400 });
    }

    // Get existing item to check author and get edit history
    const { data: existingItem, error: fetchError } = await supabaseAdmin
      .from('message_items')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (fetchError || !existingItem) {
      return NextResponse.json({ error: 'Message item not found' }, { status: 404 });
    }

    // Verify user is the author
    if (existingItem.author_id !== user.id) {
      return NextResponse.json({ error: 'Only the author can edit this message' }, { status: 403 });
    }

    // Update edit history
    const editHistory = Array.isArray(existingItem.edit_history) ? existingItem.edit_history : [];
    editHistory.push({
      previous_body: existingItem.body,
      edited_at: new Date().toISOString()
    });

    const { data: updated, error } = await supabaseAdmin
      .from('message_items')
      .update({
        body: messageBody?.trim() || existingItem.body,
        edit_history: editHistory
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err: any) {
    console.error('❌ Error in message-items PUT:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { user } = await requireServerAuth();
    const orgId = await getRequesterOrgId(user.id);
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Message item ID is required' }, { status: 400 });
    }

    // Get existing item to check author
    const { data: existingItem } = await supabaseAdmin
      .from('message_items')
      .select('author_id')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!existingItem) {
      return NextResponse.json({ error: 'Message item not found' }, { status: 404 });
    }

    // Verify user is the author
    if (existingItem.author_id !== user.id) {
      return NextResponse.json({ error: 'Only the author can delete this message' }, { status: 403 });
    }

    // Soft delete
    const { error } = await supabaseAdmin
      .from('message_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error('❌ Error in message-items DELETE:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

