import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getStableDataCacheHeaders } from '@/lib/cacheConfig'
import { z } from 'zod'
import { validateQuery, storyIdSchema, orgIdSchema } from '@/lib/validation'

// GET query parameter schema
const getStoryItemsQuerySchema = z.object({
  storyId: storyIdSchema,
  orgId: orgIdSchema.optional(),
});

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(getStoryItemsQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { storyId, orgId } = queryValidation.data

    console.log('🔍 Fetching story items for storyId:', storyId, 'orgId:', orgId)

    let query = supabaseAdmin
      .from('story_items')
      .select('id, story_id, order_index, url, duration_ms, caption, mime_type, created_at')
      .eq('story_id', storyId)
      .order('order_index', { ascending: true })

    if (orgId) {
      query = query.eq('org_id', orgId)
      console.log('🔍 Filtering by orgId:', orgId)
    }

    let { data, error } = await query
    
    if (error) {
      console.error('❌ Error fetching story items:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Found', data?.length || 0, 'story items')
    if (data && data.length > 0) {
      console.log('Sample item:', {
        id: data[0].id,
        story_id: data[0].story_id,
        hasUrl: !!(data[0] as any).url,
        url: (data[0] as any).url?.substring(0, 50),
        mimeType: data[0].mime_type
      })
      // Ensure url is present in response (as null if not in DB)
      data = data.map((item: any) => ({
        ...item,
        url: item.url || null
      }))
    }

    return NextResponse.json({ items: data || [] }, { 
      status: 200,
      headers: getStableDataCacheHeaders()
    })
  } catch (e: any) {
    console.error('❌ Exception fetching story items:', e)
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}


