'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MessageItem, MessageThreadWithParticipants, MessageParticipant } from '@/lib/types/messages';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseMessagesRealtimeOptions {
  threadIds: string[];
  onNewMessage?: (message: MessageItem) => void;
  onUpdatedParticipant?: (participant: MessageParticipant) => void;
  onNewThread?: (thread: MessageThreadWithParticipants) => void;
  onUpdatedThread?: (thread: MessageThreadWithParticipants) => void;
}

export function useMessagesRealtime({
  threadIds,
  onNewMessage,
  onUpdatedParticipant,
  onNewThread,
  onUpdatedThread,
}: UseMessagesRealtimeOptions) {
  const channelRef = useRef<any>(null);
  // Convert ref to state to avoid accessing refs during render
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsSubscribed(false);
    }
  }, []);

  // Fetch userId and orgId from server endpoint
  useEffect(() => {
    async function fetchUserContext() {
      try {
        const response = await fetch('/api/auth/user-context', { cache: 'no-store' });
        if (!response.ok) {
          console.error('Failed to fetch user context:', response.statusText);
          return;
        }
        const data = await response.json();
        if (data.userId && data.orgId) {
          setUserId(data.userId);
          setOrgId(data.orgId);
        }
      } catch (error) {
        console.error('Error fetching user context:', error);
      }
    }

    fetchUserContext();
  }, []);

  useEffect(() => {
    if (!userId || !orgId || threadIds.length === 0) {
      return;
    }

    // Cleanup existing subscription if any - wrap in requestAnimationFrame to avoid synchronous setState
    const cleanupId = requestAnimationFrame(() => {
      cleanup();
    });

    // Create a unique channel name for this user
    const channelName = `messages:${userId}:${orgId}`;
    const channel = supabase.channel(channelName);

    // Subscribe to message_items INSERT events (new messages)
    if (onNewMessage) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_items',
          filter: `org_id=eq.${orgId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const newMessage = payload.new as MessageItem;
          // Only handle messages from threads the user is part of
          if (threadIds.includes(newMessage.message_id) && newMessage.deleted_at === null) {
            onNewMessage(newMessage);
          }
        }
      );
    }

    // Subscribe to message_participants UPDATE events (unread status changes)
    if (onUpdatedParticipant) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_participants',
          filter: `org_id=eq.${orgId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const updatedParticipant = payload.new as MessageParticipant;
          // Only handle updates for this user's participants
          if (updatedParticipant.user_id === userId && threadIds.includes(updatedParticipant.message_id)) {
            onUpdatedParticipant(updatedParticipant);
          }
        }
      );
    }

    // Subscribe to messages INSERT events (new threads)
    if (onNewThread) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `org_id=eq.${orgId}`,
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          const newMessage = payload.new;
          // Check if user is a participant in this new thread
          const { data: participant } = await supabase
            .from('message_participants')
            .select('*, users!inner(id, first_name, last_name, email, role)')
            .eq('message_id', newMessage.id)
            .eq('user_id', userId)
            .eq('org_id', orgId)
            .maybeSingle();

          if (participant) {
            // User is a participant, fetch full thread data
            const { data: threadParticipants } = await supabase
              .from('message_participants')
              .select('*, users!inner(id, first_name, last_name, email, role)')
              .eq('message_id', newMessage.id)
              .eq('org_id', orgId);

            const otherParticipant = threadParticipants?.find((p: any) => p.user_id !== userId);
            const otherParticipantData = otherParticipant?.users
              ? Array.isArray(otherParticipant.users)
                ? otherParticipant.users[0]
                : otherParticipant.users
              : null;

            const thread: MessageThreadWithParticipants = {
              ...newMessage,
              unread: participant.unread,
              unread_count: participant.unread ? 1 : 0,
              latest_item: null,
              other_participant: otherParticipantData
                ? {
                    id: otherParticipantData.id,
                    first_name: otherParticipantData.first_name,
                    last_name: otherParticipantData.last_name,
                    email: otherParticipantData.email,
                    role: otherParticipantData.role || (otherParticipant ? otherParticipant.role : null),
                  }
                : null,
            };

            onNewThread(thread);
          }
        }
      );
    }

    // Subscribe to messages UPDATE events (thread updates)
    if (onUpdatedThread) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `org_id=eq.${orgId}`,
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          const updatedMessage = payload.new;
          // Only handle updates for threads the user is part of
          if (threadIds.includes(updatedMessage.id)) {
            const { data: participant } = await supabase
              .from('message_participants')
              .select('*, users!inner(id, first_name, last_name, email, role)')
              .eq('message_id', updatedMessage.id)
              .eq('user_id', userId)
              .eq('org_id', orgId)
              .maybeSingle();

            if (participant) {
              const { data: latestItem } = await supabase
                .from('message_items')
                .select('*')
                .eq('message_id', updatedMessage.id)
                .eq('org_id', orgId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              const { data: threadParticipants } = await supabase
                .from('message_participants')
                .select('*, users!inner(id, first_name, last_name, email, role)')
                .eq('message_id', updatedMessage.id)
                .eq('org_id', orgId);

              const otherParticipant = threadParticipants?.find((p: any) => p.user_id !== userId);
              const otherParticipantData = otherParticipant?.users
                ? Array.isArray(otherParticipant.users)
                  ? otherParticipant.users[0]
                  : otherParticipant.users
                : null;

              const thread: MessageThreadWithParticipants = {
                ...updatedMessage,
                unread: participant.unread,
                unread_count: participant.unread ? 1 : 0,
                latest_item: latestItem || null,
                other_participant: otherParticipantData
                  ? {
                      id: otherParticipantData.id,
                      first_name: otherParticipantData.first_name,
                      last_name: otherParticipantData.last_name,
                      email: otherParticipantData.email,
                      role: otherParticipantData.role || (otherParticipant ? otherParticipant.role : null),
                    }
                  : null,
              };

              onUpdatedThread(thread);
            }
          }
        }
      );
    }

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsSubscribed(true);
        console.log('✅ Realtime messages subscription active');
      } else if (status === 'CHANNEL_ERROR') {
        setIsSubscribed(false);
        console.error('❌ Realtime channel error');
      } else if (status === 'TIMED_OUT') {
        setIsSubscribed(false);
        console.warn('⚠️ Realtime subscription timed out');
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(cleanupId);
      cleanup();
    };
  }, [userId, orgId, threadIds.join(','), onNewMessage, onUpdatedParticipant, onNewThread, onUpdatedThread, cleanup]);

  return {
    isSubscribed,
    cleanup,
  };
}

