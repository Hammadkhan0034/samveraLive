import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getStableDataCacheHeaders } from '@/lib/cacheConfig';
import { validateQuery, storyIdSchema } from '@/lib/validation';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

// GET query parameter schema
const getStoryItemsQuerySchema = z.object({
  storyId: storyIdSchema,
});

export async function handleGetStoryItems(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(getStoryItemsQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  const { storyId } = queryValidation.data;

  console.log('🔍 Fetching story items for storyId:', storyId, 'orgId:', orgId);

  try {
    let query = adminClient
      .from('story_items')
      .select('id, story_id, order_index, url, duration_ms, caption, mime_type, created_at')
      .eq('story_id', storyId)
      .eq('org_id', orgId)
      .order('order_index', { ascending: true });

    let { data, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching story items:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Found', data?.length || 0, 'story items');
    if (data && data.length > 0) {
      console.log('Sample item:', {
        id: data[0].id,
        story_id: data[0].story_id,
        hasUrl: !!(data[0] as any).url,
        url: (data[0] as any).url?.substring(0, 50),
        mimeType: data[0].mime_type
      });
      // Ensure url is present in response (as null if not in DB)
      data = data.map((item: any) => ({
        ...item,
        url: item.url || null
      }));
    }

    return NextResponse.json({ items: data || [] }, { 
      status: 200,
      headers: getStableDataCacheHeaders()
    });
  } catch (e: any) {
    console.error('❌ Exception fetching story items:', e);
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

