'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Notification } from '@/lib/services/notifications';

interface UseNotificationsOptions {
  userId: string | null;
  orgId: string | null;
  enabled?: boolean;
  limit?: number;
}

export function useNotifications({
  userId,
  orgId,
  enabled = true,
  limit = 50,
}: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Fetch notifications from the server
  const fetchNotifications = useCallback(async () => {
    if (!userId || !orgId || !enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (notificationsError) {
        throw new Error(notificationsError.message);
      }

      const fetchedNotifications = (notificationsData || []) as Notification[];
      setNotifications(fetchedNotifications);

      // Calculate unread count
      const unread = fetchedNotifications.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch notifications');
      setError(error);
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, orgId, enabled, limit]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Set up real-time subscription
  useEffect(() => {
    if (!userId || !orgId || !enabled) {
      return;
    }

    // Cleanup existing subscription
    const cleanup = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsSubscribed(false);
      }
    };

    // Create a unique channel name for this user
    const channelName = `notifications:${userId}:${orgId}`;
    const channel = supabase.channel(channelName);

    // Subscribe to INSERT events (new notifications)
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        const newNotification = payload.new as Notification;
        // Only handle notifications for this user and org
        if (newNotification.user_id === userId && newNotification.org_id === orgId) {
          setNotifications(prev => {
            // Check if notification already exists (avoid duplicates)
            if (prev.some(n => n.id === newNotification.id)) {
              return prev;
            }
            // Add new notification at the beginning
            return [newNotification, ...prev];
          });
          // Update unread count if notification is unread
          if (!newNotification.is_read) {
            setUnreadCount(prev => prev + 1);
          }
        }
      }
    );

    // Subscribe to UPDATE events (mark as read, etc.)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        const updatedNotification = payload.new as Notification;
        // Only handle notifications for this user and org
        if (updatedNotification.user_id === userId && updatedNotification.org_id === orgId) {
          setNotifications(currentNotifications => {
            const wasRead = currentNotifications.find((n: Notification) => n.id === updatedNotification.id)?.is_read;
            
            // Update unread count
            if (updatedNotification.is_read && !wasRead) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            } else if (!updatedNotification.is_read && wasRead) {
              // If somehow marked as unread again, increment count
              setUnreadCount(prev => prev + 1);
            }
            
            return currentNotifications.map((n: Notification) =>
              n.id === updatedNotification.id ? updatedNotification : n
            );
          });
        }
      }
    );

    // Subscribe to DELETE events (if notifications are deleted)
    channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        const deletedNotification = payload.old as Notification;
        setNotifications(prev => prev.filter(n => n.id !== deletedNotification.id));
        // Update unread count if deleted notification was unread
        if (!deletedNotification.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    );

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsSubscribed(true);
        console.log('✅ Realtime notifications subscription active');
      } else if (status === 'CHANNEL_ERROR') {
        setIsSubscribed(false);
        console.error('❌ Realtime notifications channel error');
      } else if (status === 'TIMED_OUT') {
        setIsSubscribed(false);
        console.warn('⚠️ Realtime notifications subscription timed out');
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, [userId, orgId, enabled]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId || !orgId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .eq('org_id', orgId);

      if (error) {
        throw error;
      }

      // Optimistically update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // Refetch on error to ensure consistency
      fetchNotifications();
    }
  }, [userId, orgId, fetchNotifications]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!userId || !orgId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .eq('is_read', false);

      if (error) {
        throw error;
      }

      // Optimistically update local state
      setNotifications((prevNotifications) =>
        prevNotifications.map((n: Notification) => ({
          ...n,
          is_read: true,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      // Refetch on error to ensure consistency
      fetchNotifications();
    }
  }, [userId, orgId, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    isSubscribed,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}

