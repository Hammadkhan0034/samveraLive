import { NextResponse } from 'next/server';
import { getNoCacheHeaders } from '@/lib/cacheConfig';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleGetGuardianDashboardMetrics(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata | undefined;
  const orgId = metadata?.org_id;
  const guardianId = user.id;

  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not found for user' },
      { status: 400 },
    );
  }

  // Fetch all metrics in parallel using Promise.allSettled
  const [
    linkedStudentsResult,
    messagesResult,
    photosResult,
    healthLogsResult
  ] = await Promise.allSettled([
    // 1. Linked students count: Count from guardian_students table
    (async () => {
      try {
        const { count, error } = await adminClient
          .from('guardian_students')
          .select('*', { count: 'exact', head: true })
          .eq('guardian_id', guardianId)
          .eq('org_id', orgId);
        
        if (error) {
          console.error('Error fetching linked students count:', error);
          return 0;
        }
        
        return count || 0;
      } catch (err) {
        console.error('Error loading linked students count:', err);
        return 0;
      }
    })(),

    // 2. Unread messages count: Count unread message participants
    (async () => {
      try {
        const { data: participants, error: participantsError } = await adminClient
          .from('message_participants')
          .select('message_id, unread, org_id')
          .eq('user_id', guardianId)
          .eq('org_id', orgId)
          .eq('unread', true);
        
        if (participantsError) {
          console.error('Error fetching message participants:', participantsError);
          return 0;
        }
        
        if (!participants || participants.length === 0) {
          return 0;
        }
        
        const messageIds = Array.from(new Set(participants.map((p: any) => p.message_id)));
        
        const { data: messages, error: messagesError } = await adminClient
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
          messages?.some((m: any) => m.id === p.message_id)
        ).length;
        
        return unreadCount;
      } catch (err) {
        console.error('Error loading messages count:', err);
        return 0;
      }
    })(),

    // 3. Recent photos count: Count photos from last 7 days for linked students
    (async () => {
      try {
        // First, get linked student IDs
        const { data: relationships, error: relError } = await adminClient
          .from('guardian_students')
          .select('student_id')
          .eq('guardian_id', guardianId)
          .eq('org_id', orgId);
        
        if (relError || !relationships || relationships.length === 0) {
          return 0;
        }
        
        const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);
        
        if (studentIds.length === 0) {
          return 0;
        }
        
        // Get photos from last 7 days for linked students
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { count, error } = await adminClient
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('student_id', studentIds)
          .gte('created_at', sevenDaysAgo.toISOString())
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

    // 4. Health logs count: Count health logs from last 7 days for linked students
    (async () => {
      try {
        // First, get linked student IDs
        const { data: relationships, error: relError } = await adminClient
          .from('guardian_students')
          .select('student_id')
          .eq('guardian_id', guardianId)
          .eq('org_id', orgId);
        
        if (relError || !relationships || relationships.length === 0) {
          return 0;
        }
        
        const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);
        
        if (studentIds.length === 0) {
          return 0;
        }
        
        // Get health logs from last 7 days for linked students
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { count, error } = await adminClient
          .from('health_logs')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('student_id', studentIds)
          .gte('created_at', sevenDaysAgo.toISOString())
          .is('deleted_at', null);
        
        if (error) {
          console.error('Error fetching health logs count:', error);
          return 0;
        }
        
        return count || 0;
      } catch (err) {
        console.error('Error loading health logs count:', err);
        return 0;
      }
    })(),

  ]);

  // Extract results, defaulting to 0 on failure
  const linkedStudentsCount = linkedStudentsResult.status === 'fulfilled' ? linkedStudentsResult.value : 0;
  const messagesCount = messagesResult.status === 'fulfilled' ? messagesResult.value : 0;
  const photosCount = photosResult.status === 'fulfilled' ? photosResult.value : 0;
  const healthLogsCount = healthLogsResult.status === 'fulfilled' ? healthLogsResult.value : 0;

  // Log any failures for debugging
  if (linkedStudentsResult.status === 'rejected') {
    console.error('Linked students count failed:', linkedStudentsResult.reason);
  }
  if (messagesResult.status === 'rejected') {
    console.error('Messages count failed:', messagesResult.reason);
  }
  if (photosResult.status === 'rejected') {
    console.error('Photos count failed:', photosResult.reason);
  }
  if (healthLogsResult.status === 'rejected') {
    console.error('Health logs count failed:', healthLogsResult.reason);
  }

  return NextResponse.json({
    linkedStudentsCount,
    messagesCount,
    photosCount,
    healthLogsCount,
  }, {
    status: 200,
    headers: getNoCacheHeaders()
  });
}
