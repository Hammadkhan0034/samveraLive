import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getStableDataCacheHeaders } from '@/lib/cacheConfig';
import {
  validateQuery,
  validateBody,
  classIdSchema,
  userIdSchema,
  titleSchema,
  captionSchema,
  futureDateSchema,
  uuidSchema,
  storyIdSchema,
  isoDateTimeSchema,
  positiveNumberSchema,
} from '@/lib/validation';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

// GET query parameter schema
const getStoriesQuerySchema = z.object({
  classId: classIdSchema.optional(),
  includeDeleted: z.coerce.boolean().optional(),
  onlyPublic: z.coerce.boolean().optional(),
  audience: z.enum(['principal', 'teacher', 'parent']).optional(),
  teacherClassId: uuidSchema.nullable().optional(),
  teacherClassIds: z.string().optional(), // comma-separated class ids
  teacherAuthorId: userIdSchema.optional(),
  parentClassIds: z.string().optional(), // comma-separated class ids
  principalAuthorId: userIdSchema.optional(),
}).refine((data) => {
  // If audience is teacher, either teacherClassIds or teacherAuthorId should be provided
  if (data.audience === 'teacher' && !data.teacherClassIds && !data.teacherAuthorId) {
    return false;
  }
  return true;
}, { message: 'For teacher audience, either teacherClassIds or teacherAuthorId must be provided' });

export async function handleGetStories(
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

  try {
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(getStoriesQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { classId, includeDeleted, onlyPublic, audience, teacherClassIds, teacherAuthorId, parentClassIds, principalAuthorId } = queryValidation.data;

    // Use authenticated user's ID for parentUserId and principalAuthorId if not provided
    const parentUserId = user.id; // Always use authenticated user
    const finalPrincipalAuthorId = principalAuthorId || user.id; // Use provided or authenticated user

    // Validate finalPrincipalAuthorId
    if (!finalPrincipalAuthorId) {
      console.error('❌ Stories API: finalPrincipalAuthorId is null or undefined', {
        principalAuthorId,
        userId: user.id
      });
      return NextResponse.json({ error: 'Invalid author ID' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    let query = adminClient
      .from('stories')
      .select('id, org_id, class_id, author_id, title, caption, is_public, expires_at, created_at, updated_at, deleted_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    if (!includeDeleted) query = query.is('deleted_at', null);
    // Hide expired stories
    query = query.gt('expires_at', nowIso);

    if (onlyPublic) query = query.eq('is_public', true);

    // Audience-specific filters
    if (audience === 'teacher') {
      // Teachers should see:
      // 1. ALL org-wide stories (principal's stories) - class_id is null
      // 2. Class-specific stories ONLY for their assigned classes (strict filtering)
      const teacherClassIdsArray = (teacherClassIds || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      console.log('🔍 Teacher story filtering:', {
        teacherClassIds,
        teacherClassIdsArray,
        teacherAuthorId
      });

      if (teacherClassIdsArray.length > 0) {
        // Show org-wide stories (class_id is null) OR stories for teacher's assigned classes only
        // Strict filtering: only show class-specific stories if teacher is assigned to that class
        // Using Supabase PostgREST filter syntax: class_id.is.null,class_id.in.(id1,id2,...)
        const filterString = `class_id.is.null,class_id.in.(${teacherClassIdsArray.join(',')})`;
        console.log('📝 Applying teacher filter:', filterString);
        query = query.or(filterString);
      } else {
        // Fallback: if no class IDs provided, show org-wide only (principal's stories)
        // This ensures teachers without assigned classes only see org-wide stories
        console.log('⚠️ No teacher class IDs provided, showing org-wide stories only');
        query = query.is('class_id', null);
      }
    } else if (audience === 'parent') {
      // Parents should see:
      // 1. ALL org-wide stories (principal's stories) - not just public ones
      // 2. Class-specific stories for their children (teacher's class stories)
      let parentClassIdsArray: string[] = [];

      // First try to get from query params (from frontend metadata)
      if (parentClassIds) {
        parentClassIdsArray = parentClassIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }

      // If no class IDs from params, fetch from database using authenticated user
      if (parentClassIdsArray.length === 0) {
        try {
          // Get all students linked to this guardian
          const { data: relationships, error: relError } = await adminClient
            .from('guardian_students')
            .select('student_id')
            .eq('guardian_id', user.id);

          if (!relError && relationships && relationships.length > 0) {
            const studentIds = relationships.map(r => r.student_id).filter(Boolean);

            if (studentIds.length > 0) {
              // Get class_ids for these students
              const { data: students, error: studentsError } = await adminClient
                .from('students')
                .select('class_id')
                .in('id', studentIds)
                .not('class_id', 'is', null);

              if (!studentsError && students) {
                parentClassIdsArray = students
                  .map(s => s.class_id)
                  .filter((id): id is string => !!id && typeof id === 'string')
                  // Remove duplicates
                  .filter((id, index, self) => self.indexOf(id) === index);
              }
            }
          }
        } catch (e) {
          console.error('Error fetching parent class IDs:', e);
        }
      }

      if (parentClassIdsArray.length > 0) {
        // Show ALL org-wide stories (class_id is null) OR class-specific stories for their children
        query = query.or(`class_id.is.null,class_id.in.(${parentClassIdsArray.join(',')})`);
      } else {
        // If we don't know class ids, show all org-wide stories (principal's stories)
        query = query.is('class_id', null);
      }
    } else if (audience === 'principal') {
      // Principals should see:
      // 1. All org-wide stories they created (class_id is null)
      // 2. All class-specific stories they created (for any class)
      // Use authenticated user's ID or provided principalAuthorId
      if (!finalPrincipalAuthorId) {
        console.error('❌ Stories API: Cannot filter by principal - finalPrincipalAuthorId is null', {
          principalAuthorId,
          userId: user.id
        });
        return NextResponse.json({ error: 'Invalid principal author ID' }, { status: 400 });
      }
      console.log('🔍 Principal story filtering:', {
        finalPrincipalAuthorId,
        userId: user.id,
        principalAuthorId
      });
      query = query.eq('author_id', finalPrincipalAuthorId);
    }

    // Note: Organization-wide stories (class_id is null) are visible to:
    // - Principal (who created them)
    // - All Teachers (via audience=teacher filter)
    // - All Parents (via audience=parent filter)
    //
    // Class-specific stories are visible to:
    // - Principal (who created them, via principalAuthorId filter)
    // - Teachers of that class (via teacherClassIds filter)
    // - Guardians of students in that class (via parentClassIds filter)

    let { data, error } = await query;
    if (error) {
      console.error('❌ Error fetching stories:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        audience,
        orgId,
        userId: user.id,
        finalPrincipalAuthorId: audience === 'principal' ? (principalAuthorId || user.id) : undefined
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Post-process for teachers: STRICT filtering to ensure only assigned class stories are shown
    if (audience === 'teacher' && data) {
      const teacherClassIdsArray = (teacherClassIds || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      console.log('🔍 Post-processing teacher stories:', {
        teacherClassIds,
        teacherClassIdsArray,
        totalStoriesBeforeFilter: data.length,
        storiesBeforeFilter: data.map((s: any) => ({
          id: s.id,
          class_id: s.class_id,
          title: s.title
        }))
      });

      if (teacherClassIdsArray.length > 0) {
        // STRICTLY filter: only show org-wide stories OR stories from teacher's assigned classes
        // This is a double-check to ensure no stories from unassigned classes slip through
        const filteredStories = data.filter((story: any) => {
          // Show org-wide stories (class_id is null or empty)
          if (!story.class_id || story.class_id === null || story.class_id === '') {
            return true;
          }
          // STRICT: Only show class-specific stories if teacher is EXACTLY assigned to that class
          // Use strict equality check to ensure exact match
          const isAssigned = teacherClassIdsArray.some(classId => classId === story.class_id);

          if (!isAssigned) {
            console.log('❌ Filtering out story - teacher not assigned to class:', {
              storyId: story.id,
              storyClassId: story.class_id,
              teacherClassIdsArray,
              title: story.title
            });
          }

          return isAssigned;
        });

        console.log('✅ Teacher story filtering result:', {
          totalStoriesBefore: data.length,
          filteredStories: filteredStories.length,
          teacherClassIdsArray,
          storiesAfterFilter: filteredStories.map((s: any) => ({
            id: s.id,
            class_id: s.class_id,
            title: s.title
          }))
        });

        // Final validation: Double-check that no stories from unassigned classes are included
        const validatedStories = filteredStories.filter((story: any) => {
          // Org-wide stories are always valid
          if (!story.class_id || story.class_id === null || story.class_id === '') {
            return true;
          }
          // Verify class_id is in teacher's assigned classes
          const isValid = teacherClassIdsArray.includes(story.class_id);
          if (!isValid) {
            console.error('❌ VALIDATION FAILED: Story from unassigned class found:', {
              storyId: story.id,
              storyClassId: story.class_id,
              teacherClassIdsArray,
              title: story.title
            });
          }
          return isValid;
        });

        if (validatedStories.length !== filteredStories.length) {
          console.error('⚠️ Validation removed stories:', {
            before: filteredStories.length,
            after: validatedStories.length
          });
        }

        data = validatedStories;
      } else {
        // If no class IDs, only show org-wide stories (strictly filter out all class-specific stories)
        const orgWideStories = data.filter((story: any) => !story.class_id || story.class_id === null || story.class_id === '');
        console.log('✅ Teacher with no classes - showing org-wide stories only:', {
          totalStories: data.length,
          orgWideStories: orgWideStories.length
        });
        data = orgWideStories;
      }
    }

    return NextResponse.json({ stories: data || [] }, {
      headers: getStableDataCacheHeaders()
    });
  } catch (e: any) {
    console.error('❌ Stories API: Unexpected error in GET handler', {
      message: e.message,
      stack: e.stack,
      error: e
    });
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

// POST body schema
const postStoryBodySchema = z.object({
  class_id: classIdSchema.optional(),
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

export async function handlePostStory(
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

  try {
    const body = await request.json();
    const bodyValidation = validateBody(postStoryBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { class_id, title, caption, is_public, expires_at, items } = bodyValidation.data;

    const finalClassId = class_id && String(class_id).trim() !== '' ? class_id : null;

    const { data, error } = await adminClient
      .from('stories')
      .insert({
        org_id: orgId,
        class_id: finalClassId,
        author_id: user.id,
        title: title || null,
        caption: caption || null,
        is_public: Boolean(is_public),
        expires_at,
        deleted_at: null,
      })
      .select('id, org_id, class_id, author_id, title, caption, is_public, expires_at, created_at, updated_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If story items provided, insert them
    let insertedItems = [] as any[];
    if (Array.isArray(items) && items.length > 0) {
      console.log('📝 Processing story items:', items.length, 'items');
      const payload = items
        .map((it: any, idx: number) => {
          // Log each item for debugging
          console.log(`Item ${idx}:`, {
            hasUrl: !!it.url,
            url: it.url?.substring(0, 50),
            hasCaption: !!it.caption,
            mimeType: it.mime_type,
            duration: it.duration_ms
          });

          // Use url field (Supabase Storage URL)
          const url = it.url || null;

          return {
            org_id: orgId,
            story_id: data.id,
            url: url,
            order_index: typeof it.order_index === 'number' ? it.order_index : idx,
            duration_ms: typeof it.duration_ms === 'number' ? it.duration_ms : 30000,
            caption: it.caption || null,
            mime_type: it.mime_type || null,
          };
        })
        .filter((it: any) => {
          // Only filter out completely empty items (no url AND no caption)
          const hasContent = it.url || it.caption;
          if (!hasContent) {
            console.warn('⚠️ Filtering out empty item at index:', it.order_index);
          }
          return hasContent;
        });

      console.log('📦 Prepared payload:', payload.length, 'items to insert');
      if (payload.length > 0) {
        console.log('📦 First payload item sample:', {
          hasUrl: !!payload[0].url,
          url: payload[0].url?.substring(0, 50),
          orderIndex: payload[0].order_index,
          mimeType: payload[0].mime_type
        });
      }

      if (payload.length > 0) {
        const { data: itemsRes, error: itemsErr } = await adminClient
          .from('story_items')
          .insert(payload)
          .select('id, story_id, order_index, url, duration_ms, caption, mime_type, created_at');

        if (itemsErr) {
          console.error('❌ Failed to insert story_items:', itemsErr);
          console.error('❌ Error code:', itemsErr.code);
          console.error('❌ Error message:', itemsErr.message);
          console.error('❌ Error details:', itemsErr.details);
          // Return error instead of silently failing
          return NextResponse.json({
            error: `Failed to save story items: ${itemsErr.message}`,
            story: data,
            details: itemsErr.details
          }, { status: 500 });
        } else if (itemsRes) {
          console.log('✅ Successfully inserted', itemsRes.length, 'story items');
          // Log success details
          if (itemsRes.length > 0) {
            console.log('✅ First item details:', {
              id: itemsRes[0].id,
              story_id: itemsRes[0].story_id,
              hasUrl: !!itemsRes[0].url,
              url: itemsRes[0].url?.substring(0, 50),
              mimeType: itemsRes[0].mime_type,
              orderIndex: itemsRes[0].order_index
            });
          }
          insertedItems = itemsRes.map((item: any) => ({
            ...item,
            url: item.url || null
          }));
        } else {
          console.warn('⚠️ No items returned from insert, but no error');
        }
      } else {
        console.warn('⚠️ No items to insert after filtering');
      }
    } else {
      console.log('ℹ️ No items array provided or empty');
    }

    // Create notifications for target users (similar to announcements)
    try {
      const { createBulkNotifications, getClassNotificationTargets, getOrgNotificationTargets } = await import('@/lib/services/notifications');

      let targetUserIds: string[] = [];
      let notificationType: 'story_class' | 'story_org';

      if (finalClassId) {
        // Class-specific story: notify students and their parents
        notificationType = 'story_class';
        targetUserIds = await getClassNotificationTargets(finalClassId, orgId);
      } else {
        // Organization-wide story: notify all teachers and all parents
        notificationType = 'story_org';
        targetUserIds = await getOrgNotificationTargets(orgId);
      }

      // Exclude the author from receiving notifications about their own story
      if (user.id) {
        targetUserIds = targetUserIds.filter(id => id !== user.id);
      }

      // Only create notifications if there are target users
      if (targetUserIds.length > 0 && data) {
        await createBulkNotifications(
          orgId,
          targetUserIds,
          notificationType,
          title || 'New story',
          caption,
          {
            story_id: data.id,
            class_id: finalClassId,
            author_id: user.id || null,
          }
        );
      }
    } catch (notificationError) {
      // Log error but don't fail the story creation
      console.error('Failed to create notifications for story:', notificationError);
    }

    return NextResponse.json({ story: data, items: insertedItems }, { status: 201 });
  } catch (e: any) {
    console.error('❌ Stories API: Unexpected error in POST handler', {
      message: e.message,
      stack: e.stack,
      error: e
    });
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

// PUT query parameter schema
const putStoryQuerySchema = z.object({
  id: storyIdSchema,
});

// PUT body schema
const putStoryBodySchema = z.object({
  class_id: classIdSchema.optional(),
  title: titleSchema,
  caption: captionSchema,
  is_public: z.boolean().optional(),
  expires_at: isoDateTimeSchema.optional(),
});

export async function handlePutStory(
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

  try {
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(putStoryQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { id: storyId } = queryValidation.data;

    const body = await request.json();
    const bodyValidation = validateBody(putStoryBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { class_id, title, caption, is_public, expires_at } = bodyValidation.data;

    // First, verify the story exists and belongs to the author
    const { data: existingStory, error: fetchError } = await adminClient
      .from('stories')
      .select('id, org_id, author_id')
      .eq('id', storyId)
      .single();

    if (fetchError || !existingStory) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Verify author_id matches authenticated user
    if (existingStory.author_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized: You can only edit your own stories' }, { status: 403 });
    }

    // Verify org_id matches authenticated user's org
    if (existingStory.org_id !== orgId) {
      return NextResponse.json({ error: 'Unauthorized: Organization mismatch' }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title || null;
    if (caption !== undefined) updateData.caption = caption || null;
    if (is_public !== undefined) updateData.is_public = Boolean(is_public);
    if (expires_at !== undefined) updateData.expires_at = expires_at;
    if (class_id !== undefined) {
      updateData.class_id = class_id && String(class_id).trim() !== '' ? class_id : null;
    }

    const { data, error } = await adminClient
      .from('stories')
      .update(updateData)
      .eq('id', storyId)
      .select('id, org_id, class_id, author_id, title, caption, is_public, expires_at, created_at, updated_at')
      .single();

    if (error) {
      console.error('❌ Failed to update story:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Story updated successfully:', storyId);

    return NextResponse.json({ story: data }, { status: 200 });
  } catch (e: any) {
    console.error('❌ Error in stories PUT:', e);
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

// DELETE query parameter schema - removed authorId, will use authenticated user
const deleteStoryQuerySchema = z.object({
  id: storyIdSchema,
});

export async function handleDeleteStory(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(deleteStoryQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { id: storyId } = queryValidation.data;

    // First, verify the story exists and belongs to the author
    const { data: existingStory, error: fetchError } = await adminClient
      .from('stories')
      .select('id, org_id, author_id')
      .eq('id', storyId)
      .single();

    if (fetchError || !existingStory) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Verify author_id matches authenticated user
    if (existingStory.author_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized: You can only delete your own stories' }, { status: 403 });
    }

    // Soft delete: set deleted_at timestamp
    const { error } = await adminClient
      .from('stories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', storyId);

    if (error) {
      console.error('❌ Failed to delete story:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Story deleted successfully:', storyId);

    return NextResponse.json({
      message: 'Story deleted successfully!'
    }, { status: 200 });
  } catch (e: any) {
    console.error('❌ Error in stories DELETE:', e);
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

export async function handleGetStory(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
  storyId: string,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  try {

    // Fetch story
    const { data: story, error: storyError } = await adminClient
      .from('stories')
      .select('id, org_id, class_id, author_id, title, caption, is_public, expires_at, created_at, updated_at, deleted_at')
      .eq('id', storyId)
      .single();

    if (storyError || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Check if story is deleted
    if (story.deleted_at) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Verify org_id matches authenticated user's org
    if (story.org_id !== orgId) {
      return NextResponse.json({ error: 'Unauthorized: Organization mismatch' }, { status: 403 });
    }

    // Fetch story items
    const { data: items, error: itemsError } = await adminClient
      .from('story_items')
      .select('id, story_id, order_index, url, duration_ms, caption, mime_type, created_at')
      .eq('story_id', storyId)
      .order('order_index', { ascending: true });

    if (itemsError) {
      console.error('❌ Error fetching story items:', itemsError);
      // Return story even if items fail to load
    }

    return NextResponse.json({
      story,
      items: items || []
    }, {
      status: 200,
      headers: getStableDataCacheHeaders()
    });
  } catch (e: any) {
    console.error('❌ Exception in GET /api/stories/[storyId]:', e);
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

// POST body schema
const postStoryItemsBodySchema = z.object({
  items: z.array(z.object({
    url: z.string().url().nullable().optional(),
    order_index: z.number().int().nonnegative().optional(),
    duration_ms: z.number().int().positive().optional(),
    caption: captionSchema,
    mime_type: z.string().nullable().optional(),
  })).min(1, { message: 'At least one item is required' }),
});

export async function handlePostStoryItems(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
  storyId: string,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  try {

    const body = await request.json();
    const bodyValidation = validateBody(postStoryItemsBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { items } = bodyValidation.data;

    // Verify story exists and get org_id
    const { data: story, error: storyError } = await adminClient
      .from('stories')
      .select('id, org_id')
      .eq('id', storyId)
      .single();

    if (storyError || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Verify story belongs to user's org
    if (story.org_id !== orgId) {
      return NextResponse.json({ error: 'Unauthorized: Organization mismatch' }, { status: 403 });
    }

    const story_org_id = story.org_id;

    // Process items: use url field instead of image_data
    const payload = items
      .map((it: any, idx: number) => {
        return {
          org_id: story_org_id,
          story_id: storyId,
          url: it.url || null,
          order_index: typeof it.order_index === 'number' ? it.order_index : idx,
          duration_ms: typeof it.duration_ms === 'number' ? it.duration_ms : 30000,
          caption: it.caption || null,
          mime_type: it.mime_type || null,
        };
      })
      .filter((it: any) => {
        // Filter out completely empty items (no url AND no caption)
        const hasContent = it.url || it.caption;
        if (!hasContent) {
          console.warn('⚠️ Filtering out empty item at index:', it.order_index);
        }
        return hasContent;
      });

    if (payload.length === 0) {
      return NextResponse.json({ error: 'No valid items to insert' }, { status: 400 });
    }

    const { data: insertedItems, error: itemsError } = await adminClient
      .from('story_items')
      .insert(payload)
      .select('id, story_id, order_index, url, duration_ms, caption, mime_type, created_at');

    if (itemsError) {
      console.error('❌ Failed to insert story_items:', itemsError);
      return NextResponse.json({
        error: `Failed to save story items: ${itemsError.message}`,
        details: itemsError.details
      }, { status: 500 });
    }

    console.log('✅ Successfully inserted', insertedItems?.length || 0, 'story items');

    return NextResponse.json({ items: insertedItems || [] }, { status: 201 });
  } catch (e: any) {
    console.error('❌ Exception in POST /api/stories/[storyId]/items:', e);
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

export async function handleDeleteStoryItems(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
  storyId: string,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  try {

    // Verify story exists and belongs to user's org
    const { data: story, error: storyError } = await adminClient
      .from('stories')
      .select('id, org_id')
      .eq('id', storyId)
      .single();

    if (storyError || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Verify story belongs to user's org
    if (story.org_id !== orgId) {
      return NextResponse.json({ error: 'Unauthorized: Organization mismatch' }, { status: 403 });
    }

    // Delete all items for this story
    const { error: deleteError } = await adminClient
      .from('story_items')
      .delete()
      .eq('story_id', storyId);

    if (deleteError) {
      console.error('❌ Failed to delete story items:', deleteError);
      return NextResponse.json({
        error: `Failed to delete story items: ${deleteError.message}`
      }, { status: 500 });
    }

    console.log('✅ Successfully deleted story items for story:', storyId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    console.error('❌ Exception in DELETE /api/stories/[storyId]/items:', e);
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

