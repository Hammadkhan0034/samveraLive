import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseClient';

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
      console.error('❌ Supabase admin client not configured');
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const orgId = await getRequesterOrgId(user.id);
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || user.id;

    // Fetch message threads where user is a participant
    // First, get all participants for this user
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('message_participants')
      .select('message_id, unread, org_id')
      .eq('user_id', userId)
      .eq('org_id', orgId);

    if (participantsError) {
      console.error('❌ Error fetching message participants:', participantsError);
      return NextResponse.json({ error: participantsError.message }, { status: 500 });
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json({ threads: [] }, { status: 200 });
    }

    // Get unique message IDs
    const messageIds = Array.from(new Set(participants.map((p: any) => p.message_id)));

    // Fetch the actual messages
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('id, org_id, thread_type, subject, created_by, deleted_at, created_at, updated_at')
      .in('id', messageIds)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('❌ Error fetching messages:', messagesError);
      return NextResponse.json({ error: messagesError.message }, { status: 500 });
    }

    // Get unique message threads and enrich with participant info
    const threadMap = new Map<string, any>();
    
    // Create a map of message_id to participant data for quick lookup
    const participantMap = new Map<string, any>();
    for (const p of participants || []) {
      participantMap.set(p.message_id, p);
    }
    
    for (const message of messages || []) {
      if (!message || threadMap.has(message.id)) continue;
      
      // Get participant data for this message
      const participant = participantMap.get(message.id);
      if (!participant) continue;
      
      // Get all participants for this thread
      const { data: threadParticipants } = await supabaseAdmin
        .from('message_participants')
        .select(`
          id,
          user_id,
          unread,
          role,
          users!inner(id, first_name, last_name, email, role)
        `)
        .eq('message_id', message.id)
        .eq('org_id', orgId);

      // Get latest message item
      const { data: latestItem } = await supabaseAdmin
        .from('message_items')
        .select('*')
        .eq('message_id', message.id)
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Find other participant (not the current user)
      const otherParticipant = threadParticipants?.find(
        (p: any) => p.user_id !== userId
      );

      // Count unread items for this user
      const unreadCount = participant.unread ? 1 : 0;

      const otherParticipantData = otherParticipant?.users 
        ? (Array.isArray(otherParticipant.users) ? otherParticipant.users[0] : otherParticipant.users)
        : null;

      threadMap.set(message.id, {
        ...message,
        unread: participant.unread,
        unread_count: unreadCount,
        latest_item: latestItem || null,
        other_participant: otherParticipantData ? {
          id: otherParticipantData.id,
          first_name: otherParticipantData.first_name,
          last_name: otherParticipantData.last_name,
          email: otherParticipantData.email,
          role: otherParticipantData.role || (otherParticipant ? otherParticipant.role : null)
        } : null
      });
    }

    const threads = Array.from(threadMap.values());

    return NextResponse.json({ threads }, { status: 200 });
  } catch (err: any) {
    console.error('❌ Error in messages GET:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured');
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const orgId = await getRequesterOrgId(user.id);
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const { thread_type = 'dm', subject, recipient_id, recipient_ids } = body;

    if (!recipient_id && (!recipient_ids || recipient_ids.length === 0)) {
      return NextResponse.json({ error: 'recipient_id or recipient_ids is required' }, { status: 400 });
    }

    // For DM threads, check if a thread already exists between these participants
    if (thread_type === 'dm' && recipient_id) {
      const participantIds = [user.id, recipient_id].sort();
      
      // Find all threads where both users are participants
      const { data: existingParticipants } = await supabaseAdmin
        .from('message_participants')
        .select('message_id')
        .in('user_id', participantIds)
        .eq('org_id', orgId);
      
      if (existingParticipants && existingParticipants.length > 0) {
        // Group by message_id to find threads with both participants
        const messageIdCounts = new Map<string, number>();
        existingParticipants.forEach((p: any) => {
          messageIdCounts.set(p.message_id, (messageIdCounts.get(p.message_id) || 0) + 1);
        });
        
        // Find threads that have both participants (count === 2)
        for (const [messageId, count] of Array.from(messageIdCounts.entries())) {
          if (count === 2) {
            // Check if this is a DM thread and not deleted
            const { data: existingMessage } = await supabaseAdmin
              .from('messages')
              .select('id, thread_type, deleted_at')
              .eq('id', messageId)
              .eq('org_id', orgId)
              .eq('thread_type', 'dm')
              .is('deleted_at', null)
              .maybeSingle();
            
            if (existingMessage) {
              // Return existing thread instead of creating a new one
              return NextResponse.json({ message: existingMessage }, { status: 200 });
            }
          }
        }
      }
    }

    // Create message thread
    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        org_id: orgId,
        thread_type,
        subject: subject || null,
        created_by: user.id
      })
      .select()
      .single();

    if (messageError || !message) {
      console.error('❌ Error creating message thread:', messageError);
      return NextResponse.json({ error: messageError?.message || 'Failed to create message thread' }, { status: 500 });
    }

    // Add participants (sender and recipient(s))
    const participantIds = recipient_ids || [recipient_id];
    const allParticipantIds = [user.id, ...participantIds].filter((id, index, self) => self.indexOf(id) === index);

    const participants = allParticipantIds.map((participantId, index) => ({
      org_id: orgId,
      message_id: message.id,
      user_id: participantId,
      unread: participantId !== user.id, // Only mark as unread if not the sender
      role: null
    }));

    const { error: participantsError } = await supabaseAdmin
      .from('message_participants')
      .insert(participants);

    if (participantsError) {
      console.error('❌ Error creating message participants:', participantsError);
      // Clean up message thread if participants fail
      await supabaseAdmin.from('messages').delete().eq('id', message.id);
      return NextResponse.json({ error: participantsError.message }, { status: 500 });
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (err: any) {
    console.error('❌ Error in messages POST:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const orgId = await getRequesterOrgId(user.id);
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const { id, subject, deleted_at } = body;

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Verify user has access to this message
    const { data: participant } = await supabaseAdmin
      .from('message_participants')
      .select('message_id, messages!inner(org_id)')
      .eq('user_id', user.id)
      .eq('message_id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!participant) {
      return NextResponse.json({ error: 'Message not found or access denied' }, { status: 404 });
    }

    const updateData: any = {};
    if (subject !== undefined) updateData.subject = subject;
    if (deleted_at !== undefined) updateData.deleted_at = deleted_at;

    const { data: updated, error } = await supabaseAdmin
      .from('messages')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: updated }, { status: 200 });
  } catch (err: any) {
    console.error('❌ Error in messages PUT:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const orgId = await getRequesterOrgId(user.id);
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Verify user has access to this message
    const { data: participant } = await supabaseAdmin
      .from('message_participants')
      .select('message_id')
      .eq('user_id', user.id)
      .eq('message_id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!participant) {
      return NextResponse.json({ error: 'Message not found or access denied' }, { status: 404 });
    }

    // Soft delete
    const { error } = await supabaseAdmin
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error('❌ Error in messages DELETE:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
