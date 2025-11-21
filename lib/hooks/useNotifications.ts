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
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const lastUserIdOrgIdRef = useRef<string>('');

  // Fetch notifications from the server
  const fetchNotifications = useCallback(async (showLoading = false) => {
    if (!userId || !orgId || !enabled) {
      setLoading(false);
      return;
    }

    try {
      // Only show loading if explicitly requested (initial load or user/org change)
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      // Fetch notifications and unread count in parallel
      const [notificationsResult, unreadCountResult] = await Promise.all([
        // Fetch notifications
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(limit),
        // Fetch actual unread count (not limited)
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('org_id', orgId)
          .eq('is_read', false)
      ]);

      if (notificationsResult.error) {
        throw new Error(notificationsResult.error.message);
      }

      if (unreadCountResult.error) {
        console.error('Error fetching unread count:', unreadCountResult.error);
        // Don't throw, just use fallback
      }

      const fetchedNotifications = (notificationsResult.data || []) as Notification[];
      setNotifications(fetchedNotifications);

      // Use actual unread count from database
      const actualUnreadCount = unreadCountResult.count || 0;
      setUnreadCount(actualUnreadCount);
      // Track that we've loaded for this userId/orgId combination
      lastUserIdOrgIdRef.current = `${userId}:${orgId}`;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch notifications');
      setError(error);
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, orgId, enabled, limit]);

  // Initial fetch and refetch when userId/orgId changes (e.g., on navigation)
  useEffect(() => {
    if (userId && orgId && enabled) {
      // Check if this is a new userId/orgId combination
      const currentKey = `${userId}:${orgId}`;
      const isNewUserOrOrg = lastUserIdOrgIdRef.current !== currentKey;
      
      // Only show loading for new user/org combinations or if we haven't loaded yet
      fetchNotifications(isNewUserOrOrg || lastUserIdOrgIdRef.current === '');
    } else {
      // If userId/orgId not available, set loading to false immediately
      setLoading(false);
    }
  }, [userId, orgId, enabled, fetchNotifications]);

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

    // Create a unique channel name for this user and org
    const channelName = `notifications:${userId}:${orgId}`;
    const channel = supabase.channel(channelName);

    // Subscribe to INSERT events (new notifications)
    // Note: Supabase real-time filters may not support complex AND conditions,
    // so we filter by user_id at the database level and check org_id in the handler
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        try {
          const newNotification = payload.new as Notification;
          // Only handle notifications for this user and org
          if (newNotification.user_id === userId && newNotification.org_id === orgId) {
            console.log('🔔 New notification received via real-time:', newNotification.id);
            setNotifications(prev => {
              // Check if notification already exists (avoid duplicates)
              if (prev.some(n => n.id === newNotification.id)) {
                console.log('⚠️ Duplicate notification ignored:', newNotification.id);
                return prev;
              }
              // Add new notification at the beginning (limit to keep list size manageable)
              const updated = [newNotification, ...prev].slice(0, limit);
              return updated;
            });
            // Update unread count if notification is unread
            if (!newNotification.is_read) {
              setUnreadCount(prev => {
                const newCount = prev + 1;
                console.log('📊 Unread count updated:', newCount);
                return newCount;
              });
            }
          } else {
            // Log when notification is filtered out (different org)
            console.log('ℹ️ Notification filtered (different org):', {
              notificationOrgId: newNotification.org_id,
              currentOrgId: orgId,
            });
          }
        } catch (err) {
          console.error('❌ Error handling INSERT notification:', err);
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
        try {
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
        } catch (err) {
          console.error('❌ Error handling UPDATE notification:', err);
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
        try {
          const deletedNotification = payload.old as Notification;
          // Only handle deletions for this user and org
          if (deletedNotification.user_id === userId && deletedNotification.org_id === orgId) {
            setNotifications(prev => prev.filter(n => n.id !== deletedNotification.id));
            // Update unread count if deleted notification was unread
            if (!deletedNotification.is_read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        } catch (err) {
          console.error('❌ Error handling DELETE notification:', err);
        }
      }
    );

    // Subscribe to the channel with better error handling
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsSubscribed(true);
        setRealtimeError(null); // Clear error on successful subscription
        console.log('✅ Realtime notifications subscription active for user:', userId, 'org:', orgId);
      } else if (status === 'CHANNEL_ERROR') {
        setIsSubscribed(false);
        const errorMessage = 'Realtime notifications channel error - falling back to polling';
        console.error('❌', errorMessage);
        setRealtimeError(errorMessage);
        // Fallback: refetch notifications periodically if real-time fails
        const fallbackInterval = setInterval(() => {
          console.log('🔄 Fallback: Refetching notifications due to real-time failure');
          fetchNotifications(false);
        }, 10000); // Poll every 10 seconds as fallback
        
        // Store interval for cleanup
        (channelRef.current as any).fallbackInterval = fallbackInterval;
      } else if (status === 'TIMED_OUT') {
        setIsSubscribed(false);
        console.warn('⚠️ Realtime notifications subscription timed out - will retry on next mount');
        // Trigger a refetch to ensure we have current data
        fetchNotifications(false);
      } else if (status === 'CLOSED') {
        setIsSubscribed(false);
        console.warn('⚠️ Realtime notifications channel closed');
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      // Clear any fallback intervals
      if ((channelRef.current as any)?.fallbackInterval) {
        clearInterval((channelRef.current as any).fallbackInterval);
      }
      cleanup();
      setRealtimeError(null); // Clear error on cleanup
    };
  }, [userId, orgId, enabled, limit, fetchNotifications]);

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
      // Refetch on error to ensure consistency (silent refetch, no loading)
      fetchNotifications(false);
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
      // Refetch on error to ensure consistency (silent refetch, no loading)
      fetchNotifications(false);
    }
  }, [userId, orgId, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    realtimeError,
    isSubscribed,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}

