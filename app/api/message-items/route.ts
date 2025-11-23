import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireServerAuth } from '@/lib/supabaseServer';
import { getCurrentUserOrgId, MissingOrgIdError } from '@/lib/server-helpers';
import { getRealtimeDataCacheHeaders } from '@/lib/cacheConfig';
import { z } from 'zod';
import { validateQuery, validateBody, uuidSchema } from '@/lib/validation';

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
    // GET query parameter schema
    const getMessageItemsQuerySchema = z.object({
      messageId: uuidSchema,
    });
    
    const queryValidation = validateQuery(getMessageItemsQuerySchema, searchParams);
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
    // POST body schema
    const postMessageItemBodySchema = z.object({
      message_id: uuidSchema,
      body: z.string().min(1, { message: 'Message body is required' }).max(10000),
      attachments: z.array(z.any()).default([]),
    });
    
    const bodyValidation = validateBody(postMessageItemBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { message_id, body: messageBody, attachments } = bodyValidation.data;

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
    // PUT body schema
    const putMessageItemBodySchema = z.object({
      id: uuidSchema,
      body: z.string().min(1).max(10000).optional(),
    });
    
    const bodyValidation = validateBody(putMessageItemBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { id, body: messageBody } = bodyValidation.data;

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
    // DELETE query parameter schema
    const deleteMessageItemQuerySchema = z.object({
      id: uuidSchema,
    });
    
    const queryValidation = validateQuery(deleteMessageItemQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { id } = queryValidation.data;

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

