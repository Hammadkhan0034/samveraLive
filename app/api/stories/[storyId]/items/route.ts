import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { storyId } = await params
    const body = await request.json()
    const { items } = body || {}

    if (!storyId) {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
    }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items must be an array' }, { status: 400 })
    }

    // Verify story exists and get org_id
    const { data: story, error: storyError } = await supabaseAdmin
      .from('stories')
      .select('id, org_id')
      .eq('id', storyId)
      .single()

    if (storyError || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    const org_id = story.org_id

    // Process items: use url field instead of image_data
    const payload = items
      .map((it: any, idx: number) => {
        return {
          org_id,
          story_id: storyId,
          url: it.url || null,
          order_index: typeof it.order_index === 'number' ? it.order_index : idx,
          duration_ms: typeof it.duration_ms === 'number' ? it.duration_ms : 30000,
          caption: it.caption || null,
          mime_type: it.mime_type || null,
        }
      })
      .filter((it: any) => {
        // Filter out completely empty items (no url AND no caption)
        const hasContent = it.url || it.caption
        if (!hasContent) {
          console.warn('⚠️ Filtering out empty item at index:', it.order_index)
        }
        return hasContent
      })

    if (payload.length === 0) {
      return NextResponse.json({ error: 'No valid items to insert' }, { status: 400 })
    }

    const { data: insertedItems, error: itemsError } = await supabaseAdmin
      .from('story_items')
      .insert(payload)
      .select('id, story_id, order_index, url, duration_ms, caption, mime_type, created_at')

    if (itemsError) {
      console.error('❌ Failed to insert story_items:', itemsError)
      return NextResponse.json({ 
        error: `Failed to save story items: ${itemsError.message}`,
        details: itemsError.details
      }, { status: 500 })
    }

    console.log('✅ Successfully inserted', insertedItems?.length || 0, 'story items')

    return NextResponse.json({ items: insertedItems || [] }, { status: 201 })
  } catch (e: any) {
    console.error('❌ Exception in POST /api/stories/[storyId]/items:', e)
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { storyId } = await params

    if (!storyId) {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
    }

    // Verify story exists
    const { data: story, error: storyError } = await supabaseAdmin
      .from('stories')
      .select('id')
      .eq('id', storyId)
      .single()

    if (storyError || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Delete all items for this story
    const { error: deleteError } = await supabaseAdmin
      .from('story_items')
      .delete()
      .eq('story_id', storyId)

    if (deleteError) {
      console.error('❌ Failed to delete story items:', deleteError)
      return NextResponse.json({ 
        error: `Failed to delete story items: ${deleteError.message}`
      }, { status: 500 })
    }

    console.log('✅ Successfully deleted story items for story:', storyId)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (e: any) {
    console.error('❌ Exception in DELETE /api/stories/[storyId]/items:', e)
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}

