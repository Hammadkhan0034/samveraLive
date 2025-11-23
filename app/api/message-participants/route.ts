import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireServerAuth } from '@/lib/supabaseServer';
import { getCurrentUserOrgId, MissingOrgIdError } from '@/lib/server-helpers';
import { getRealtimeDataCacheHeaders } from '@/lib/cacheConfig';
import { z } from 'zod';
import { validateQuery, validateBody, validateParams, uuidSchema, userIdSchema } from '@/lib/validation';

// GET query parameter schema
const getMessageParticipantsQuerySchema = z.object({
  messageId: uuidSchema,
});

// POST body schema
const postMessageParticipantBodySchema = z.object({
  message_id: uuidSchema,
  user_id: userIdSchema,
  role: z.string().nullable().optional(),
});

// PUT body schema
const putMessageParticipantBodySchema = z.object({
  id: uuidSchema,
  unread: z.boolean().optional(),
  role: z.string().nullable().optional(),
});

// DELETE query parameter schema
const deleteMessageParticipantQuerySchema = z.object({
  id: uuidSchema,
});

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { user } = await requireServerAuth();
    let orgId: string;
    try {
      orgId = await getCurrentUserOrgId(user);
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return NextResponse.json({ 
          error: 'Organization ID not found',
          code: 'MISSING_ORG_ID'
        }, { status: 401 });
      }
      throw err;
    }

    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(getMessageParticipantsQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { messageId } = queryValidation.data;

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

    // Fetch all participants
    const { data: participants, error } = await supabaseAdmin
      .from('message_participants')
      .select(`
        *,
        users!inner(id, first_name, last_name, email, role)
      `)
      .eq('message_id', messageId)
      .eq('org_id', orgId);

    if (error) {
      console.error('❌ Error fetching participants:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ participants: participants || [] }, { 
      status: 200,
      headers: getRealtimeDataCacheHeaders()
    });
  } catch (err: any) {
    console.error('❌ Error in message-participants GET:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { user } = await requireServerAuth();
    let orgId: string;
    try {
      orgId = await getCurrentUserOrgId(user);
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return NextResponse.json({ 
          error: 'Organization ID not found',
          code: 'MISSING_ORG_ID'
        }, { status: 401 });
      }
      throw err;
    }

    const body = await request.json();
    const bodyValidation = validateBody(postMessageParticipantBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { message_id, user_id, role = null } = bodyValidation.data;

    // Verify user has access to this message thread
    const { data: existingParticipant } = await supabaseAdmin
      .from('message_participants')
      .select('message_id')
      .eq('user_id', user.id)
      .eq('message_id', message_id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!existingParticipant) {
      return NextResponse.json({ error: 'Message thread not found or access denied' }, { status: 404 });
    }

    // Check if participant already exists
    const { data: existing } = await supabaseAdmin
      .from('message_participants')
      .select('id')
      .eq('message_id', message_id)
      .eq('user_id', user_id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Participant already exists' }, { status: 400 });
    }

    // Add participant
    const { data: participant, error } = await supabaseAdmin
      .from('message_participants')
      .insert({
        org_id: orgId,
        message_id,
        user_id,
        role,
        unread: true
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding participant:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ participant }, { status: 201 });
  } catch (err: any) {
    console.error('❌ Error in message-participants POST:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { user } = await requireServerAuth();
    let orgId: string;
    try {
      orgId = await getCurrentUserOrgId(user);
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return NextResponse.json({ 
          error: 'Organization ID not found',
          code: 'MISSING_ORG_ID'
        }, { status: 401 });
      }
      throw err;
    }

    const body = await request.json();
    const bodyValidation = validateBody(putMessageParticipantBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { id, unread, role } = bodyValidation.data;

    // Verify user has access (either updating their own or is participant in the thread)
    const { data: participant } = await supabaseAdmin
      .from('message_participants')
      .select('id, user_id, message_id')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    // User can update their own participant record or if they're a participant in the thread
    const { data: userParticipant } = await supabaseAdmin
      .from('message_participants')
      .select('id')
      .eq('message_id', participant.message_id)
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!userParticipant && participant.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updateData: any = {};
    if (unread !== undefined) updateData.unread = unread;
    if (role !== undefined) updateData.role = role;

    const { data: updated, error } = await supabaseAdmin
      .from('message_participants')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ participant: updated }, { status: 200 });
  } catch (err: any) {
    console.error('❌ Error in message-participants PUT:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { user } = await requireServerAuth();
    let orgId: string;
    try {
      orgId = await getCurrentUserOrgId(user);
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return NextResponse.json({ 
          error: 'Organization ID not found',
          code: 'MISSING_ORG_ID'
        }, { status: 401 });
      }
      throw err;
    }

    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(deleteMessageParticipantQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { id } = queryValidation.data;

    // Verify user has access
    const { data: participant } = await supabaseAdmin
      .from('message_participants')
      .select('id, user_id, message_id')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    // User can remove their own participant record
    if (participant.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('message_participants')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error('❌ Error in message-participants DELETE:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

