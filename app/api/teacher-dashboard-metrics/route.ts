import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getNoCacheHeaders } from '@/lib/cacheConfig';
import { z } from 'zod';
import { validateQuery } from '@/lib/validation';
import { type UserMetadata } from '@/lib/types/auth';

import { getCurrentUserOrgId, MissingOrgIdError, mapAuthErrorToResponse } from '@/lib/server-helpers';

// GET query parameter schema
const getMetricsQuerySchema = z.object({
  userRole: z.enum(['parent', 'guardian', 'teacher', 'principal', 'admin']).optional(),
});

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured');
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    // Authenticate user using server client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // The `setAll` method was called from a Route Handler.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // Handle network errors gracefully
    if (authError) {
      const isNetworkError = authError.message?.includes('fetch failed') || 
                            authError.message?.includes('timeout') ||
                            authError.name === 'AuthRetryableFetchError' ||
                            authError.status === 0;
      
      if (isNetworkError) {
        console.error('❌ Network error during authentication:', authError);
        return NextResponse.json({ 
          error: 'Database connection failed. Please check your connection and try again.',
          retryable: true
        }, { status: 503 });
      }
      
      console.error('❌ Authentication error:', authError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user has a valid role
    const userRoles = user.user_metadata?.roles || [];
    const hasAccess = userRoles.some((role: string) => ['principal', 'admin', 'teacher', 'parent', 'guardian'].includes(role));
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied. Valid role required.' 
      }, { status: 403 });
    }

    // Get userId from authenticated session
    const userId = user.id;
    
    // Get orgId from authenticated user
    let orgId: string;
    try {
      orgId = await getCurrentUserOrgId(user);
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return mapAuthErrorToResponse(err);
      }
      throw err;
    }
    
    // Get teacher's classes from class_memberships
    const { data: teacherMemberships, error: membershipError } = await supabaseAdmin
      .from('class_memberships')
      .select('class_id')
      .eq('user_id', userId)
      .eq('org_id', orgId);
    
    if (membershipError) {
      console.error('Error fetching teacher memberships:', membershipError);
      return NextResponse.json({ error: 'Failed to fetch teacher classes' }, { status: 500 });
    }
    
    // Get validated class IDs from memberships
    const validatedClassIds = (teacherMemberships || []).map(m => m.class_id);

    // Get userRole from query params or user metadata
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(getMetricsQuerySchema, searchParams);
    const userRole = queryValidation.success ? queryValidation.data.userRole : undefined;
    const finalUserRole = userRole || (user.user_metadata as UserMetadata | undefined)?.activeRole || (user.user_metadata as UserMetadata | undefined)?.roles?.[0] || 'teacher';

    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Fetch all metrics in parallel using Promise.allSettled
    const [
      attendanceResult,
      studentsResult,
      messagesResult,
      storiesResult,
      announcementsResult,
      menusResult
    ] = await Promise.allSettled([
      // 1. Attendance count: Sum of attendance records for today across all classes
      (async () => {
        if (validatedClassIds.length === 0) return 0;
        
        try {
          const fetchPromises = validatedClassIds.map(async (classId) => {
            try {
              if (!supabaseAdmin) return 0;
              const { count, error } = await supabaseAdmin
                .from('attendance')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', orgId)
                .eq('class_id', classId)
                .eq('date', today);
              
              if (error) {
                console.error(`Error fetching attendance for class ${classId}:`, error);
                return 0;
              }
              
              return count || 0;
            } catch (err) {
              console.error(`Error in attendance fetch for class ${classId}:`, err);
              return 0;
            }
          });

          const results = await Promise.allSettled(fetchPromises);
          return results.reduce((sum, result) => {
            return sum + (result.status === 'fulfilled' ? result.value : 0);
          }, 0);
        } catch (err) {
          console.error('Error loading attendance count:', err);
          return 0;
        }
      })(),

      // 2. Students count: Total students from all teacher's classes
      (async () => {
        if (validatedClassIds.length === 0) return 0;
        
        try {
          const { count, error } = await supabaseAdmin
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .in('class_id', validatedClassIds)
            .is('deleted_at', null);
          
          if (error) {
            console.error('Error fetching students count:', error);
            return 0;
          }
          
          return count || 0;
        } catch (err) {
          console.error('Error loading students count:', err);
          return 0;
        }
      })(),

      // 3. Messages count: Unread message threads count
      (async () => {
        try {
          const { data: participants, error: participantsError } = await supabaseAdmin
            .from('message_participants')
            .select('message_id, unread, org_id')
            .eq('user_id', userId)
            .eq('org_id', orgId);
          
          if (participantsError) {
            console.error('Error fetching message participants:', participantsError);
            return 0;
          }
          
          if (!participants || participants.length === 0) {
            return 0;
          }
          
          const messageIds = Array.from(new Set(participants.map((p: any) => p.message_id)));
          
          const { data: messages, error: messagesError } = await supabaseAdmin
            .from('messages')
            .select('id')
            .in('id', messageIds)
            .eq('org_id', orgId)
            .is('deleted_at', null);
          
          if (messagesError) {
            console.error('Error fetching messages:', messagesError);
            return 0;
          }
          
          // Count unread threads
          const unreadCount = participants.filter((p: any) => p.unread && messages?.some((m: any) => m.id === p.message_id)).length;
          return unreadCount;
        } catch (err) {
          console.error('Error loading messages count:', err);
          return 0;
        }
      })(),

      // 4. Stories count: Stories from last 24 hours
      (async () => {
        try {
          // Build query similar to stories endpoint
          let query = supabaseAdmin
            .from('stories')
            .select('id, created_at, updated_at, class_id')
            .eq('org_id', orgId)
            .gt('expires_at', new Date().toISOString())
            .is('deleted_at', null);
          
          // Filter for teacher's classes or org-wide
          if (validatedClassIds.length > 0) {
            query = query.or(`class_id.is.null,class_id.in.(${validatedClassIds.join(',')})`);
          } else {
            query = query.is('class_id', null);
          }
          
          const { data: stories, error } = await query;
          
          if (error) {
            console.error('Error fetching stories:', error);
            return 0;
          }
          
          // Filter stories from last 24 hours
          const recentStories = (stories || []).filter((story: any) => {
            const storyDate = new Date(story.created_at || story.updated_at).getTime();
            return storyDate >= oneDayAgo;
          });
          
          return recentStories.length;
        } catch (err) {
          console.error('Error loading stories count:', err);
          return 0;
        }
      })(),

      // 5. Announcements count: Total announcements for the teacher
      (async () => {
        try {
          let query = supabaseAdmin
            .from('announcements')
            .select('id')
            .eq('is_public', true);
          
          // Apply same filtering logic as announcements endpoint
          if (finalUserRole === 'teacher' && validatedClassIds.length > 0) {
            query = query.or(`class_id.is.null,class_id.in.(${validatedClassIds.join(',')})`);
          } else if (finalUserRole === 'teacher' && validatedClassIds.length === 0) {
            query = query.is('class_id', null);
          } else {
            query = query.is('class_id', null);
          }
          
          const { data: announcements, error } = await query;
          
          if (error) {
            console.error('Error fetching announcements:', error);
            return 0;
          }
          
          return announcements?.length || 0;
        } catch (err) {
          console.error('Error loading announcements count:', err);
          return 0;
        }
      })(),

      // 6. Menus count: Total menus for the organization
      (async () => {
        try {
          const { count, error } = await supabaseAdmin
            .from('menus')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .is('deleted_at', null);
          
          if (error) {
            console.error('Error fetching menus count:', error);
            return 0;
          }
          
          return count || 0;
        } catch (err) {
          console.error('Error loading menus count:', err);
          return 0;
        }
      })(),
    ]);

    // Extract results, defaulting to 0 on failure
    const attendanceCount = attendanceResult.status === 'fulfilled' ? attendanceResult.value : 0;
    const studentsCount = studentsResult.status === 'fulfilled' ? studentsResult.value : 0;
    const messagesCount = messagesResult.status === 'fulfilled' ? messagesResult.value : 0;
    const storiesCount = storiesResult.status === 'fulfilled' ? storiesResult.value : 0;
    const announcementsCount = announcementsResult.status === 'fulfilled' ? announcementsResult.value : 0;
    const menusCount = menusResult.status === 'fulfilled' ? menusResult.value : 0;

    // Log any failures for debugging
    if (attendanceResult.status === 'rejected') {
      console.error('Attendance count failed:', attendanceResult.reason);
    }
    if (studentsResult.status === 'rejected') {
      console.error('Students count failed:', studentsResult.reason);
    }
    if (messagesResult.status === 'rejected') {
      console.error('Messages count failed:', messagesResult.reason);
    }
    if (storiesResult.status === 'rejected') {
      console.error('Stories count failed:', storiesResult.reason);
    }
    if (announcementsResult.status === 'rejected') {
      console.error('Announcements count failed:', announcementsResult.reason);
    }
    if (menusResult.status === 'rejected') {
      console.error('Menus count failed:', menusResult.reason);
    }

    return NextResponse.json({
      attendanceCount,
      studentsCount,
      messagesCount,
      storiesCount,
      announcementsCount,
      menusCount,
    }, {
      status: 200,
      headers: getNoCacheHeaders()
    });
  } catch (err: any) {
    console.error('❌ Error in teacher-dashboard-metrics GET:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

