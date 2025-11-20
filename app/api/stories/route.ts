import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getStableDataCacheHeaders } from '@/lib/cacheConfig'
import { requireServerAuth } from '@/lib/supabaseServer'
import { z } from 'zod'
import { validateQuery, validateBody, orgIdSchema, classIdSchema, userIdSchema, titleSchema, captionSchema, futureDateSchema, uuidSchema, storyIdSchema, isoDateTimeSchema, positiveNumberSchema } from '@/lib/validation'

// GET query parameter schema
const getStoriesQuerySchema = z.object({
  orgId: orgIdSchema,
  classId: classIdSchema.optional(),
  includeDeleted: z.coerce.boolean().optional(),
  onlyPublic: z.coerce.boolean().optional(),
  audience: z.enum(['principal', 'teacher', 'parent']).optional(),
  teacherClassId: uuidSchema.nullable().optional(),
  teacherClassIds: z.string().optional(), // comma-separated class ids
  teacherAuthorId: userIdSchema.optional(),
  parentClassIds: z.string().optional(), // comma-separated class ids
  parentUserId: userIdSchema.optional(),
  principalAuthorId: userIdSchema.optional(),
}).refine((data) => {
  // If audience is teacher, either teacherClassIds or teacherAuthorId should be provided
  if (data.audience === 'teacher' && !data.teacherClassIds && !data.teacherAuthorId) {
    return false;
  }
  return true;
}, { message: 'For teacher audience, either teacherClassIds or teacherAuthorId must be provided' });

export async function GET(request: Request) {
  try {
    const { user } = await requireServerAuth()
    
    // Check if user has a valid role (principal, admin, teacher, or parent)
    const userRoles = user.user_metadata?.roles || [];
    const hasAccess = userRoles.some((role: string) => ['principal', 'admin', 'teacher', 'parent'].includes(role));
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied. Valid role required.' 
      }, { status: 403 });
    }
  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    throw authError
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(getStoriesQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { orgId, classId, includeDeleted, onlyPublic, audience, teacherClassIds, teacherAuthorId, parentClassIds, parentUserId, principalAuthorId } = queryValidation.data

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
      // 1. ALL org-wide stories (principal's stories) - class_id is null
      // 2. Class-specific stories ONLY for their assigned classes (strict filtering)
      const teacherClassIdsArray = (teacherClassIds || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      
      console.log('🔍 Teacher story filtering:', {
        teacherClassIds,
        teacherClassIdsArray,
        teacherAuthorId
      })
      
      if (teacherClassIdsArray.length > 0) {
        // Show org-wide stories (class_id is null) OR stories for teacher's assigned classes only
        // Strict filtering: only show class-specific stories if teacher is assigned to that class
        // Using Supabase PostgREST filter syntax: class_id.is.null,class_id.in.(id1,id2,...)
        const filterString = `class_id.is.null,class_id.in.(${teacherClassIdsArray.join(',')})`
        console.log('📝 Applying teacher filter:', filterString)
        query = query.or(filterString)
      } else {
        // Fallback: if no class IDs provided, show org-wide only (principal's stories)
        // This ensures teachers without assigned classes only see org-wide stories
        console.log('⚠️ No teacher class IDs provided, showing org-wide stories only')
        query = query.is('class_id', null)
      }
    } else if (audience === 'parent') {
      // Parents should see:
      // 1. ALL org-wide stories (principal's stories) - not just public ones
      // 2. Class-specific stories for their children (teacher's class stories)
      let parentClassIdsArray: string[] = []
      
      // First try to get from query params (from frontend metadata)
      if (parentClassIds) {
        parentClassIdsArray = parentClassIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      }
      
      // If no class IDs from params but we have parentUserId, fetch from database
      if (parentClassIdsArray.length === 0 && parentUserId) {
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
                parentClassIdsArray = students
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
      
      if (parentClassIdsArray.length > 0) {
        // Show ALL org-wide stories (class_id is null) OR class-specific stories for their children
        query = query.or(`class_id.is.null,class_id.in.(${parentClassIdsArray.join(',')})`)
      } else {
        // If we don't know class ids, show all org-wide stories (principal's stories)
        query = query.is('class_id', null)
      }
    } else if (audience === 'principal') {
      // Principals should see:
      // 1. All org-wide stories they created (class_id is null)
      // 2. All class-specific stories they created (for any class)
      // Get principal's user ID from request if available
      if (principalAuthorId) {
        // Show all stories created by this principal (both org-wide and class-specific)
        query = query.eq('author_id', principalAuthorId)
      } else {
        // If no author ID, show all org-wide stories (fallback)
        query = query.is('class_id', null)
      }
    }
    
    // Note: Organization-wide stories (class_id is null) are visible to:
    // - Principal (who created them)
    // - All Teachers (via audience=teacher filter)
    // - All Parents (via audience=parent filter)
    
    // Class-specific stories are visible to:
    // - Principal (who created them, via principalAuthorId filter)
    // - Teachers of that class (via teacherClassIds filter)
    // - Guardians of students in that class (via parentClassIds filter)

    let { data, error } = await query
    if (error) {
      console.error('❌ Error fetching stories:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Post-process for teachers: STRICT filtering to ensure only assigned class stories are shown
    if (audience === 'teacher' && data) {
      const teacherClassIdsArray = (teacherClassIds || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      
      console.log('🔍 Post-processing teacher stories:', {
        teacherClassIds,
        teacherClassIdsArray,
        totalStoriesBeforeFilter: data.length,
        storiesBeforeFilter: data.map((s: any) => ({
          id: s.id,
          class_id: s.class_id,
          title: s.title
        }))
      })
      
      if (teacherClassIdsArray.length > 0) {
        // STRICTLY filter: only show org-wide stories OR stories from teacher's assigned classes
        // This is a double-check to ensure no stories from unassigned classes slip through
        const filteredStories = data.filter((story: any) => {
          // Show org-wide stories (class_id is null or empty)
          if (!story.class_id || story.class_id === null || story.class_id === '') {
            return true
          }
          // STRICT: Only show class-specific stories if teacher is EXACTLY assigned to that class
          // Use strict equality check to ensure exact match
          const isAssigned = teacherClassIdsArray.some(classId => classId === story.class_id)
          
          if (!isAssigned) {
            console.log('❌ Filtering out story - teacher not assigned to class:', {
              storyId: story.id,
              storyClassId: story.class_id,
              teacherClassIdsArray,
              title: story.title
            })
          }
          
          return isAssigned
        })
        
        console.log('✅ Teacher story filtering result:', {
          totalStoriesBefore: data.length,
          filteredStories: filteredStories.length,
          teacherClassIdsArray,
          storiesAfterFilter: filteredStories.map((s: any) => ({
            id: s.id,
            class_id: s.class_id,
            title: s.title
          }))
        })
        
        // Final validation: Double-check that no stories from unassigned classes are included
        const validatedStories = filteredStories.filter((story: any) => {
          // Org-wide stories are always valid
          if (!story.class_id || story.class_id === null || story.class_id === '') {
            return true
          }
          // Verify class_id is in teacher's assigned classes
          const isValid = teacherClassIdsArray.includes(story.class_id)
          if (!isValid) {
            console.error('❌ VALIDATION FAILED: Story from unassigned class found:', {
              storyId: story.id,
              storyClassId: story.class_id,
              teacherClassIdsArray,
              title: story.title
            })
          }
          return isValid
        })
        
        if (validatedStories.length !== filteredStories.length) {
          console.error('⚠️ Validation removed stories:', {
            before: filteredStories.length,
            after: validatedStories.length
          })
        }
        
        data = validatedStories
      } else {
        // If no class IDs, only show org-wide stories (strictly filter out all class-specific stories)
        const orgWideStories = data.filter((story: any) => !story.class_id || story.class_id === null || story.class_id === '')
        console.log('✅ Teacher with no classes - showing org-wide stories only:', {
          totalStories: data.length,
          orgWideStories: orgWideStories.length
        })
        data = orgWideStories
      }
    }

    return NextResponse.json({ stories: data || [] }, {
      headers: getStableDataCacheHeaders()
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}

// POST body schema
const postStoryBodySchema = z.object({
  org_id: orgIdSchema,
  class_id: classIdSchema.optional(),
  author_id: userIdSchema.nullable().optional(),
  title: titleSchema,
  caption: captionSchema,
  is_public: z.boolean().default(false),
  expires_at: futureDateSchema,
  items: z.array(z.object({
    url: z.string().url().nullable().optional(),
    order_index: z.number().int().nonnegative().optional(),
    duration_ms: positiveNumberSchema.optional(),
    caption: captionSchema,
    mime_type: z.string().max(100).nullable().optional(),
  })).optional().default([]),
});

export async function POST(request: Request) {
  try {
    await requireServerAuth()
  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    throw authError
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const body = await request.json()
    const bodyValidation = validateBody(postStoryBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { org_id, class_id, author_id, title, caption, is_public, expires_at, items } = bodyValidation.data

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

    // Create notifications for target users (similar to announcements)
    try {
      const { createBulkNotifications, getClassNotificationTargets, getOrgNotificationTargets } = await import('@/lib/services/notifications');
      
      let targetUserIds: string[] = [];
      let notificationType: 'story_class' | 'story_org';
      
      if (finalClassId) {
        // Class-specific story: notify students and their parents
        notificationType = 'story_class';
        targetUserIds = await getClassNotificationTargets(finalClassId, org_id);
      } else {
        // Organization-wide story: notify all teachers and all parents
        notificationType = 'story_org';
        targetUserIds = await getOrgNotificationTargets(org_id);
      }
      
      // Exclude the author from receiving notifications about their own story
      if (author_id) {
        targetUserIds = targetUserIds.filter(id => id !== author_id);
      }
      
      // Only create notifications if there are target users
      if (targetUserIds.length > 0 && data) {
        await createBulkNotifications(
          org_id,
          targetUserIds,
          notificationType,
          title || 'New story',
          caption,
          {
            story_id: data.id,
            class_id: finalClassId,
            author_id: author_id || null,
          }
        );
      }
    } catch (notificationError) {
      // Log error but don't fail the story creation
      console.error('Failed to create notifications for story:', notificationError);
    }

    return NextResponse.json({ story: data, items: insertedItems }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}

// PUT query parameter schema
const putStoryQuerySchema = z.object({
  id: storyIdSchema,
});

// PUT body schema
const putStoryBodySchema = z.object({
  org_id: orgIdSchema.optional(),
  class_id: classIdSchema.optional(),
  title: titleSchema,
  caption: captionSchema,
  is_public: z.boolean().optional(),
  expires_at: isoDateTimeSchema.optional(),
  author_id: userIdSchema,
});

export async function PUT(request: Request) {
  try {
    await requireServerAuth()
  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    throw authError
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(putStoryQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { id: storyId } = queryValidation.data

    const body = await request.json()
    const bodyValidation = validateBody(putStoryBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { org_id, class_id, title, caption, is_public, expires_at, author_id } = bodyValidation.data

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

// DELETE query parameter schema
const deleteStoryQuerySchema = z.object({
  id: storyIdSchema,
  authorId: userIdSchema,
});

export async function DELETE(request: Request) {
  try {
    await requireServerAuth()
  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    throw authError
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const queryValidation = validateQuery(deleteStoryQuerySchema, searchParams)
    if (!queryValidation.success) {
      return queryValidation.error
    }
    const { id: storyId, authorId } = queryValidation.data

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


