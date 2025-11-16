import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { storyId } = await params
    const { searchParams } = new URL(request.url)
    const authorId = searchParams.get('authorId') // Optional: to verify ownership
    const orgId = searchParams.get('orgId') // Optional: to verify org access

    if (!storyId) {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
    }

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
    }, { status: 200 })
  } catch (e: any) {
    console.error('❌ Exception in GET /api/stories/[storyId]:', e)
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}

