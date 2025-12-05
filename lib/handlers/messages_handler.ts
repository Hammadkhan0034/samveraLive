import { NextResponse } from 'next/server';
import { getRealtimeDataCacheHeaders, getUserDataCacheHeaders } from '@/lib/cacheConfig';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams, userIdSchema, threadTypeSchema, uuidSchema } from '@/lib/validation';
import type { AuthUser, UserMetadata, SamveraRole } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleGetMessages(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;

  // Fetch message threads where user is a participant
  // First, get all participants for this user
  const { data: participants, error: participantsError } = await adminClient
    .from('message_participants')
    .select('message_id, unread, org_id')
    .eq('user_id', userId)
    .eq('org_id', orgId);

  if (participantsError) {
    console.error('❌ Error fetching message participants:', participantsError);
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  if (!participants || participants.length === 0) {
    return NextResponse.json({ threads: [] }, {
      status: 200,
      headers: getRealtimeDataCacheHeaders()
    });
  }

  // Get unique message IDs
  const messageIds = Array.from(new Set(participants.map((p: any) => p.message_id)));

  // Fetch the actual messages
  const { data: messages, error: messagesError } = await adminClient
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
    const { data: threadParticipants } = await adminClient
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
    const { data: latestItem } = await adminClient
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

    // Determine role
    let participantRole = otherParticipantData?.role || (otherParticipant ? otherParticipant.role : null);

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
        role: participantRole
      } : null
    });
  }

  const threads = Array.from(threadMap.values());

  return NextResponse.json({ threads }, {
    status: 200,
    headers: getRealtimeDataCacheHeaders()
  });
}

export async function handlePostMessage(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;

  const body = await request.json();
  // POST body schema
  const postMessageBodySchema = z.object({
    thread_type: threadTypeSchema.default('dm'),
    subject: z.string().max(500).nullable().optional(),
    recipient_id: userIdSchema.optional(),
    recipient_ids: z.array(userIdSchema).optional(),
  }).refine((data) => data.recipient_id || (data.recipient_ids && data.recipient_ids.length > 0), {
    message: 'recipient_id or recipient_ids is required',
  });
  
  const bodyValidation = validateBody(postMessageBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }
  const { thread_type, subject, recipient_id, recipient_ids } = bodyValidation.data;

  // For individual/DM threads, check if a thread already exists between these participants
  if ((thread_type === 'individual' || thread_type === 'dm') && recipient_id) {
    const participantIds = [userId, recipient_id].sort();
    
    // Find all threads where both users are participants
    const { data: existingParticipants } = await adminClient
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
          const { data: existingMessage } = await adminClient
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
  const { data: message, error: messageError } = await adminClient
    .from('messages')
    .insert({
      org_id: orgId,
      thread_type,
      subject: subject || null,
      created_by: userId
    })
    .select()
    .single();

  if (messageError || !message) {
    console.error('❌ Error creating message thread:', messageError);
    return NextResponse.json({ error: messageError?.message || 'Failed to create message thread' }, { status: 500 });
  }

  // Add participants (sender and recipient(s))
  const participantIds = recipient_ids || [recipient_id];
  const allParticipantIds = [userId, ...participantIds].filter((id, index, self) => self.indexOf(id) === index);

  const participants = allParticipantIds.map((participantId) => ({
    org_id: orgId,
    message_id: message.id,
    user_id: participantId,
    unread: participantId !== userId, // Only mark as unread if not the sender
    role: null
  }));

  const { error: participantsError } = await adminClient
    .from('message_participants')
    .insert(participants);

  if (participantsError) {
    console.error('❌ Error creating message participants:', participantsError);
    // Clean up message thread if participants fail
    await adminClient.from('messages').delete().eq('id', message.id);
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  return NextResponse.json({ message }, { status: 201 });
}

export async function handlePutMessage(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;

  const body = await request.json();
  // PUT body schema
  const putMessageBodySchema = z.object({
    id: uuidSchema,
    subject: z.string().max(500).nullable().optional(),
    deleted_at: z.string().datetime().nullable().optional(),
  });
  
  const bodyValidation = validateBody(putMessageBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }
  const { id, subject, deleted_at } = bodyValidation.data;

  // Verify user has access to this message
  const { data: participant } = await adminClient
    .from('message_participants')
    .select('message_id, messages!inner(org_id)')
    .eq('user_id', userId)
    .eq('message_id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: 'Message not found or access denied' }, { status: 404 });
  }

  const updateData: any = {};
  if (subject !== undefined) updateData.subject = subject;
  if (deleted_at !== undefined) updateData.deleted_at = deleted_at;

  const { data: updated, error } = await adminClient
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
}

export async function handleDeleteMessage(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
  }

  // Verify user has access to this message
  const { data: participant } = await adminClient
    .from('message_participants')
    .select('message_id')
    .eq('user_id', userId)
    .eq('message_id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: 'Message not found or access denied' }, { status: 404 });
  }

  // Soft delete
  const { error } = await adminClient
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function handleGetRecipients(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;
  const roles = (metadata.roles ?? []) as SamveraRole[];
  
  // Determine user's role (use first role or default)
  const userRole = roles[0] || 'guardian';

  // Determine which roles the current user can message
  let allowedRoles: string[] = [];
  if (userRole === 'principal') {
    allowedRoles = ['teacher', 'guardian', 'principal'];
  } else if (userRole === 'teacher') {
    allowedRoles = ['principal', 'guardian', 'teacher'];
  } else if (userRole === 'guardian') {
    allowedRoles = ['teacher', 'principal'];
  }

  if (allowedRoles.length === 0) {
    return NextResponse.json({ recipients: [] }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  // Build query for users
  let query = adminClient
    .from('users')
    .select('id, email, first_name, last_name, role, org_id')
    .eq('org_id', orgId)
    .in('role', allowedRoles)
    .is('deleted_at', null)
    .order('first_name', { ascending: true })
    .order('last_name', { ascending: true });

  // Apply search filter if provided
  if (search && search.trim()) {
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
  return NextResponse.json({ recipients, grouped }, { 
    status: 200,
    headers: getUserDataCacheHeaders()
  });
}

export async function handleGetMessageItems(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
  messageId: string,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0') || 0, 0);

  // Verify user is a participant in this thread
  const { data: participant, error: participantError } = await adminClient
    .from('message_participants')
    .select('id, unread')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (participantError || !participant) {
    return NextResponse.json({ error: 'Access denied or thread not found' }, { status: 403 });
  }

  // Get message items
  const { data: items, error: itemsError } = await adminClient
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
    await adminClient
      .from('message_participants')
      .update({ unread: false })
      .eq('message_id', messageId)
      .eq('user_id', userId);
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
  return NextResponse.json({ items: transformedItems.reverse() }, { 
    status: 200,
    headers: getRealtimeDataCacheHeaders()
  }); // Reverse to show oldest first
}

export async function handlePostMessageItem(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
  messageId: string,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;

  const body = await request.json();
  // POST body schema (removed user_id and org_id - use authenticated user)
  const postMessageItemBodySchema = z.object({
    body: z.string().min(1, { message: 'Message body is required' }).max(10000, { message: 'Message body is too long' }),
    attachments: z.array(z.any()).optional().default([]),
  });
  
  const bodyValidation = validateBody(postMessageItemBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }
  const { body: messageBody, attachments } = bodyValidation.data;

  // Verify user is a participant
  const { data: participant, error: participantError } = await adminClient
    .from('message_participants')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (participantError || !participant) {
    return NextResponse.json({ error: 'Access denied or thread not found' }, { status: 403 });
  }

  // Verify message exists and belongs to org
  const { data: message, error: messageError } = await adminClient
    .from('messages')
    .select('id, org_id')
    .eq('id', messageId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (messageError || !message) {
    return NextResponse.json({ error: 'Message thread not found' }, { status: 404 });
  }

  // Create message item
  const { data: item, error: itemError } = await adminClient
    .from('message_items')
    .insert({
      org_id: orgId,
      message_id: messageId,
      author_id: userId,
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
  await adminClient
    .from('message_participants')
    .update({ unread: true })
    .eq('message_id', messageId)
    .neq('user_id', userId);

  // Update message updated_at timestamp
  await adminClient
    .from('messages')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', messageId);

  console.log('✅ Created message item:', item.id);
  return NextResponse.json({ item }, { status: 201 });
}

