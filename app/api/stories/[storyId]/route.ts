import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getStableDataCacheHeaders } from '@/lib/cacheConfig'
import { z } from 'zod'
import { validateParams, validateQuery, storyIdSchema, userIdSchema, orgIdSchema } from '@/lib/validation'

// Path parameter schema
const storyIdParamsSchema = z.object({
  storyId: storyIdSchema,
});

// Query parameter schema
const getStoryQuerySchema = z.object({
  authorId: userIdSchema.optional(),
  orgId: orgIdSchema.optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const rawParams = await params
    const paramsValidation = validateParams(storyIdParamsSchema, rawParams)
    if (!paramsValidation.success) {
      return paramsValidation.error
    }
    const { storyId } = paramsValidation.data

    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(getStoryQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { authorId, orgId } = queryValidation.data

    // Fetch story
    const { data: story, error: storyError } = await supabaseAdmin
      .from('stories')
      .select('id, org_id, class_id, author_id, title, caption, is_public, expires_at, created_at, updated_at, deleted_at')
      .eq('id', storyId)
      .single()

    if (storyError || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Check if story is deleted
    if (story.deleted_at) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Verify author_id if provided
    if (authorId && story.author_id !== authorId) {
      return NextResponse.json({ error: 'Unauthorized: You can only view your own stories' }, { status: 403 })
    }

    // Verify org_id if provided
    if (orgId && story.org_id !== orgId) {
      return NextResponse.json({ error: 'Unauthorized: Organization mismatch' }, { status: 403 })
    }

    // Fetch story items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('story_items')
      .select('id, story_id, order_index, url, duration_ms, caption, mime_type, created_at')
      .eq('story_id', storyId)
      .order('order_index', { ascending: true })

    if (itemsError) {
      console.error('❌ Error fetching story items:', itemsError)
      // Return story even if items fail to load
    }

    return NextResponse.json({ 
      story,
      items: items || []
    }, { 
      status: 200,
      headers: getStableDataCacheHeaders()
    })
  } catch (e: any) {
    console.error('❌ Exception in GET /api/stories/[storyId]:', e)
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}

