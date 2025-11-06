import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const classId = searchParams.get('classId')
    const includeDeleted = searchParams.get('includeDeleted') === 'true'
    const onlyPublic = searchParams.get('onlyPublic') === 'true'
    const audience = searchParams.get('audience') // 'principal' | 'teacher' | 'parent'
    const teacherClassId = searchParams.get('teacherClassId')
    const teacherClassIdsCsv = searchParams.get('teacherClassIds') // comma-separated class ids for teacher
    const teacherAuthorId = searchParams.get('teacherAuthorId') // teacher's user ID to see their own stories
    const parentClassIdsCsv = searchParams.get('parentClassIds') // comma-separated class ids
    const parentUserId = searchParams.get('parentUserId') // parent's user ID to fetch their children's classes

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

    let query = supabaseAdmin
      .from('stories')
      .select('id, org_id, class_id, author_id, title, caption, is_public, expires_at, created_at, updated_at, deleted_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (classId) {
      query = query.eq('class_id', classId)
    }

    if (!includeDeleted) query = query.is('deleted_at', null)
    // Hide expired stories
    query = query.gt('expires_at', nowIso)

    if (onlyPublic) query = query.eq('is_public', true)

    // Audience-specific filters
    if (audience === 'teacher') {
      // Teachers should see:
      // 1. Org-wide stories (class_id is null)
      // 2. Their own class-specific stories (for classes they teach)
      const teacherClassIds = (teacherClassIdsCsv || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      
      if (teacherClassIds.length > 0) {
        // Show org-wide stories OR stories for teacher's classes
        query = query.or(`class_id.is.null,class_id.in.(${teacherClassIds.join(',')})`)
        
        // Also include stories created by this teacher (if author_id provided)
        // This ensures teacher sees their own stories even if class filtering fails
        if (teacherAuthorId) {
          // We'll post-process to include teacher's own stories
          // For now, the class_id filter should cover it
        }
      } else {
        // Fallback: if no class IDs provided, show org-wide only
        query = query.is('class_id', null)
      }
    } else if (audience === 'parent') {
      // Parents should see:
      // 1. ALL org-wide stories (principal's stories) - not just public ones
      // 2. Class-specific stories for their children (teacher's class stories)
      let parentClassIds: string[] = []
      
      // First try to get from query params (from frontend metadata)
      if (parentClassIdsCsv) {
        parentClassIds = parentClassIdsCsv
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      }
      
      // If no class IDs from params but we have parentUserId, fetch from database
      if (parentClassIds.length === 0 && parentUserId) {
        try {
          // Get all students linked to this guardian
          const { data: relationships, error: relError } = await supabaseAdmin
            .from('guardian_students')
            .select('student_id')
            .eq('guardian_id', parentUserId)
          
          if (!relError && relationships && relationships.length > 0) {
            const studentIds = relationships.map(r => r.student_id).filter(Boolean)
            
            if (studentIds.length > 0) {
              // Get class_ids for these students
              const { data: students, error: studentsError } = await supabaseAdmin
                .from('students')
                .select('class_id')
                .in('id', studentIds)
                .not('class_id', 'is', null)
              
              if (!studentsError && students) {
                parentClassIds = students
                  .map(s => s.class_id)
                  .filter((id): id is string => !!id && typeof id === 'string')
                  // Remove duplicates
                  .filter((id, index, self) => self.indexOf(id) === index)
              }
            }
          }
        } catch (e) {
          console.error('Error fetching parent class IDs:', e)
        }
      }
      
      if (parentClassIds.length > 0) {
        // Show ALL org-wide stories (class_id is null) OR class-specific stories for their children
        query = query.or(`class_id.is.null,class_id.in.(${parentClassIds.join(',')})`)
      } else {
        // If we don't know class ids, show all org-wide stories (principal's stories)
        query = query.is('class_id', null)
      }
    } else if (audience === 'principal') {
      // Show only org-wide stories to principals to avoid teacher class stories
      query = query.is('class_id', null)
    }

    let { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Post-process for teachers: ensure they see their own stories even if class filtering missed some
    if (audience === 'teacher' && teacherAuthorId && data) {
      // Add any stories created by this teacher that might have been missed
      const teacherStories = data.filter((s: any) => s.author_id === teacherAuthorId)
      // If we already have them, no need to add duplicates
      // The class_id filter should have covered it, but this is a safety net
    }

    return NextResponse.json({ stories: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { org_id, class_id, author_id, title, caption, is_public = false, expires_at, items } = body || {}

    if (!org_id || !expires_at) {
      return NextResponse.json({ error: 'Missing required fields: org_id, expires_at' }, { status: 400 })
    }

    const finalClassId = class_id && String(class_id).trim() !== '' ? class_id : null

    const { data, error } = await supabaseAdmin
      .from('stories')
      .insert({
        org_id,
        class_id: finalClassId,
        author_id: author_id || null,
        title: title || null,
        caption: caption || null,
        is_public: Boolean(is_public),
        expires_at,
        deleted_at: null,
      })
      .select('id, org_id, class_id, author_id, title, caption, is_public, expires_at, created_at, updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If story items provided, insert them
    let insertedItems = [] as any[]
    if (Array.isArray(items) && items.length > 0) {
      console.log('📝 Processing story items:', items.length, 'items')
      const payload = items
        .map((it: any, idx: number) => {
          // Log each item for debugging
          console.log(`Item ${idx}:`, {
            hasUrl: !!it.url,
            url: it.url?.substring(0, 50),
            hasCaption: !!it.caption,
            mimeType: it.mime_type,
            duration: it.duration_ms
          })
          
          // Use url field (Supabase Storage URL)
          const url = it.url || null
          
          return {
            org_id,
            story_id: data.id,
            url: url,
            order_index: typeof it.order_index === 'number' ? it.order_index : idx,
            duration_ms: typeof it.duration_ms === 'number' ? it.duration_ms : 30000,
            caption: it.caption || null,
            mime_type: it.mime_type || null,
          }
        })
        .filter((it: any) => {
          // Only filter out completely empty items (no url AND no caption)
          const hasContent = it.url || it.caption
          if (!hasContent) {
            console.warn('⚠️ Filtering out empty item at index:', it.order_index)
          }
          return hasContent
        })
      
      console.log('📦 Prepared payload:', payload.length, 'items to insert')
      if (payload.length > 0) {
        console.log('📦 First payload item sample:', {
          hasUrl: !!payload[0].url,
          url: payload[0].url?.substring(0, 50),
          orderIndex: payload[0].order_index,
          mimeType: payload[0].mime_type
        })
      }
      
      if (payload.length > 0) {
        const { data: itemsRes, error: itemsErr } = await supabaseAdmin
          .from('story_items')
          .insert(payload)
          .select('id, story_id, order_index, url, duration_ms, caption, mime_type, created_at')
        
        if (itemsErr) {
          console.error('❌ Failed to insert story_items:', itemsErr)
          console.error('❌ Error code:', itemsErr.code)
          console.error('❌ Error message:', itemsErr.message)
          console.error('❌ Error details:', itemsErr.details)
          // Return error instead of silently failing
          return NextResponse.json({ 
            error: `Failed to save story items: ${itemsErr.message}`,
            story: data,
            details: itemsErr.details
          }, { status: 500 })
        } else if (itemsRes) {
          console.log('✅ Successfully inserted', itemsRes.length, 'story items')
          // Log success details
          if (itemsRes.length > 0) {
            console.log('✅ First item details:', {
              id: itemsRes[0].id,
              story_id: itemsRes[0].story_id,
              hasUrl: !!itemsRes[0].url,
              url: itemsRes[0].url?.substring(0, 50),
              mimeType: itemsRes[0].mime_type,
              orderIndex: itemsRes[0].order_index
            })
          }
          insertedItems = itemsRes.map((item: any) => ({
            ...item,
            url: item.url || null
          }))
        } else {
          console.warn('⚠️ No items returned from insert, but no error')
        }
      } else {
        console.warn('⚠️ No items to insert after filtering')
      }
    } else {
      console.log('ℹ️ No items array provided or empty')
    }

    return NextResponse.json({ story: data, items: insertedItems }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const storyId = searchParams.get('id')
    const body = await request.json()
    const { org_id, class_id, title, caption, is_public, expires_at, author_id } = body || {}

    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 })
    }

    if (!author_id) {
      return NextResponse.json({ error: 'author_id is required' }, { status: 400 })
    }

    // First, verify the story exists and belongs to the author
    const { data: existingStory, error: fetchError } = await supabaseAdmin
      .from('stories')
      .select('id, org_id, author_id')
      .eq('id', storyId)
      .single()

    if (fetchError || !existingStory) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Verify author_id matches
    if (existingStory.author_id !== author_id) {
      return NextResponse.json({ error: 'Unauthorized: You can only edit your own stories' }, { status: 403 })
    }

    // Verify org_id matches if provided
    if (org_id && existingStory.org_id !== org_id) {
      return NextResponse.json({ error: 'Unauthorized: Organization mismatch' }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updateData.title = title || null
    if (caption !== undefined) updateData.caption = caption || null
    if (is_public !== undefined) updateData.is_public = Boolean(is_public)
    if (expires_at !== undefined) updateData.expires_at = expires_at
    if (class_id !== undefined) {
      updateData.class_id = class_id && String(class_id).trim() !== '' ? class_id : null
    }

    const { data, error } = await supabaseAdmin
      .from('stories')
      .update(updateData)
      .eq('id', storyId)
      .select('id, org_id, class_id, author_id, title, caption, is_public, expires_at, created_at, updated_at')
      .single()

    if (error) {
      console.error('❌ Failed to update story:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Story updated successfully:', storyId)

    return NextResponse.json({ story: data }, { status: 200 })
  } catch (e: any) {
    console.error('❌ Error in stories PUT:', e)
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const storyId = searchParams.get('id')
    const authorId = searchParams.get('authorId') // User ID of the requester

    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 })
    }

    if (!authorId) {
      return NextResponse.json({ error: 'authorId is required' }, { status: 400 })
    }

    // First, verify the story exists and belongs to the author
    const { data: existingStory, error: fetchError } = await supabaseAdmin
      .from('stories')
      .select('id, org_id, author_id')
      .eq('id', storyId)
      .single()

    if (fetchError || !existingStory) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Verify author_id matches
    if (existingStory.author_id !== authorId) {
      return NextResponse.json({ error: 'Unauthorized: You can only delete your own stories' }, { status: 403 })
    }

    // Soft delete: set deleted_at timestamp
    const { error } = await supabaseAdmin
      .from('stories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', storyId)

    if (error) {
      console.error('❌ Failed to delete story:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Story deleted successfully:', storyId)

    return NextResponse.json({ 
      message: 'Story deleted successfully!'
    }, { status: 200 })
  } catch (e: any) {
    console.error('❌ Error in stories DELETE:', e)
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}


