import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getNoCacheHeaders } from '@/lib/cacheConfig';
import { getAuthUserWithOrg, MissingOrgIdError, mapAuthErrorToResponse } from '@/lib/server-helpers';
import { getEvents } from '@/lib/server-actions';

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured');
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    // Get authenticated user and orgId from server-side auth (no query params needed)
    let user, orgId: string;
    try {
      const authContext = await getAuthUserWithOrg();
      user = authContext.user;
      orgId = authContext.orgId;
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return mapAuthErrorToResponse(err);
      }
      const message = err instanceof Error ? err.message : 'Authentication required';
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const userId = user.id;

    // Check if user has principal or admin role
    const userRoles = user.user_metadata?.roles || [];
    const hasAccess = userRoles.some((role: string) => ['principal', 'admin'].includes(role));
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied. Principal or admin role required.' 
      }, { status: 403 });
    }

    // Calculate current month for calendar events
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();

    // Fetch all metrics in parallel using Promise.allSettled
    const [
      studentsResult,
      staffResult,
      classesResult,
      guardiansResult,
      menusResult,
      storiesResult,
      announcementsResult,
      messagesResult,
      photosResult,
      calendarEventsResult
    ] = await Promise.allSettled([
      // 1. Students count: Count from students table filtered by org_id, excluding deleted
      (async () => {
        try {
          const { count, error } = await supabaseAdmin
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
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

      // 2. Staff count: Count from staff table joined with users table, filtered by org_id and active status
      (async () => {
        try {
          const { data: staffData, error: staffErr } = await supabaseAdmin
            .from('staff')
            .select(`
              id,
              users!inner(id,is_active,deleted_at)
            `)
            .eq('org_id', orgId);
          
          if (staffErr) {
            console.error('Error fetching staff count:', staffErr);
            return 0;
          }
          
          // Filter to only active and non-deleted staff
          const activeStaff = (staffData || []).filter((s: any) => 
            s.users?.is_active === true && !s.users?.deleted_at
          );
          
          return activeStaff.length;
        } catch (err) {
          console.error('Error loading staff count:', err);
          return 0;
        }
      })(),

      // 3. Classes count: Count from classes table filtered by org_id, excluding deleted
      (async () => {
        try {
          const { count, error } = await supabaseAdmin
            .from('classes')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .is('deleted_at', null);
          
          if (error) {
            console.error('Error fetching classes count:', error);
            return 0;
          }
          
          return count || 0;
        } catch (err) {
          console.error('Error loading classes count:', err);
          return 0;
        }
      })(),

      // 4. Guardians count: Count from users table where role is 'guardian' or 'parent', filtered by org_id, excluding deleted
      (async () => {
        try {
          // Try role column first
          let query = supabaseAdmin
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .is('deleted_at', null);
          
          // Filter by role - guardians can be 'guardian' or 'parent'
          const { count, error } = await query
            .in('role', ['guardian', 'parent']);
          
          if (error) {
            // If role column doesn't work, try role_id
            const { count: countByRoleId, error: roleIdError } = await supabaseAdmin
              .from('users')
              .select('id', { count: 'exact', head: true })
              .eq('org_id', orgId)
              .in('role_id', [10]) // GUARDIAN_ROLE_ID
              .is('deleted_at', null);
            
            if (roleIdError) {
              console.error('Error fetching guardians count:', roleIdError);
              return 0;
            }
            
            return countByRoleId || 0;
          }
          
          return count || 0;
        } catch (err) {
          console.error('Error loading guardians count:', err);
          return 0;
        }
      })(),

      // 5. Menus count: Count from menus table filtered by org_id, excluding deleted
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

      // 6. Stories count: Count from stories table filtered by org_id, excluding deleted and expired
      (async () => {
        try {
          const { count, error } = await supabaseAdmin
            .from('stories')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .gt('expires_at', new Date().toISOString())
            .is('deleted_at', null);
          
          if (error) {
            console.error('Error fetching stories count:', error);
            return 0;
          }
          
          return count || 0;
        } catch (err) {
          console.error('Error loading stories count:', err);
          return 0;
        }
      })(),

      // 7. Announcements count: Count from announcements table filtered by org_id and is_public=true, excluding deleted
      (async () => {
        try {
          // Principals see all org-wide announcements (class_id is null) and any class-specific announcements
          const { count, error } = await supabaseAdmin
            .from('announcements')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .eq('is_public', true)
            .is('deleted_at', null);
          
          if (error) {
            console.error('Error fetching announcements count:', error);
            return 0;
          }
          
          return count || 0;
        } catch (err) {
          console.error('Error loading announcements count:', err);
          return 0;
        }
      })(),

      // 8. Messages count: Count unread message threads from message_participants table for the user, filtered by org_id
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
          const unreadCount = participants.filter((p: any) => 
            p.unread && messages?.some((m: any) => m.id === p.message_id)
          ).length;
          
          return unreadCount;
        } catch (err) {
          console.error('Error loading messages count:', err);
          return 0;
        }
      })(),

      // 9. Photos count: Count from photos table filtered by org_id, excluding deleted
      (async () => {
        try {
          const { count, error } = await supabaseAdmin
            .from('photos')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .is('deleted_at', null);
          
          if (error) {
            console.error('Error fetching photos count:', error);
            return 0;
          }
          
          return count || 0;
        } catch (err) {
          console.error('Error loading photos count:', err);
          return 0;
        }
      })(),

      // 10. Calendar events count: Use getEvents() to fetch events, then filter for current month
      (async () => {
        try {
          const events = await getEvents(orgId, {
            userRole: 'principal',
            userId: userId,
            startDate: startOfMonth,
            endDate: endOfMonth,
          });
          
          if (Array.isArray(events)) {
            // Filter for current month events
            const currentMonthEvents = events.filter((event: any) => {
              const eventDate = new Date(event.start_at);
              return eventDate.getMonth() === currentMonth && 
                     eventDate.getFullYear() === currentYear;
            });
            return currentMonthEvents.length;
          }
          
          return 0;
        } catch (err) {
          console.error('Error loading calendar events count:', err);
          return 0;
        }
      })(),
    ]);

    // Extract results, defaulting to 0 on failure
    const studentsCount = studentsResult.status === 'fulfilled' ? studentsResult.value : 0;
    const staffCount = staffResult.status === 'fulfilled' ? staffResult.value : 0;
    const classesCount = classesResult.status === 'fulfilled' ? classesResult.value : 0;
    const guardiansCount = guardiansResult.status === 'fulfilled' ? guardiansResult.value : 0;
    const menusCount = menusResult.status === 'fulfilled' ? menusResult.value : 0;
    const storiesCount = storiesResult.status === 'fulfilled' ? storiesResult.value : 0;
    const announcementsCount = announcementsResult.status === 'fulfilled' ? announcementsResult.value : 0;
    const messagesCount = messagesResult.status === 'fulfilled' ? messagesResult.value : 0;
    const photosCount = photosResult.status === 'fulfilled' ? photosResult.value : 0;
    const calendarEventsCount = calendarEventsResult.status === 'fulfilled' ? calendarEventsResult.value : 0;

    // Log any failures for debugging
    if (studentsResult.status === 'rejected') {
      console.error('Students count failed:', studentsResult.reason);
    }
    if (staffResult.status === 'rejected') {
      console.error('Staff count failed:', staffResult.reason);
    }
    if (classesResult.status === 'rejected') {
      console.error('Classes count failed:', classesResult.reason);
    }
    if (guardiansResult.status === 'rejected') {
      console.error('Guardians count failed:', guardiansResult.reason);
    }
    if (menusResult.status === 'rejected') {
      console.error('Menus count failed:', menusResult.reason);
    }
    if (storiesResult.status === 'rejected') {
      console.error('Stories count failed:', storiesResult.reason);
    }
    if (announcementsResult.status === 'rejected') {
      console.error('Announcements count failed:', announcementsResult.reason);
    }
    if (messagesResult.status === 'rejected') {
      console.error('Messages count failed:', messagesResult.reason);
    }
    if (photosResult.status === 'rejected') {
      console.error('Photos count failed:', photosResult.reason);
    }
    if (calendarEventsResult.status === 'rejected') {
      console.error('Calendar events count failed:', calendarEventsResult.reason);
    }

    return NextResponse.json({
      studentsCount,
      staffCount,
      classesCount,
      guardiansCount,
      menusCount,
      storiesCount,
      announcementsCount,
      messagesCount,
      photosCount,
      calendarEventsCount,
    }, {
      status: 200,
      headers: getNoCacheHeaders()
    });
  } catch (err: any) {
    console.error('❌ Error in principal-dashboard-metrics GET:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

