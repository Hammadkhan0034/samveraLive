'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Notification } from '@/lib/services/notifications';
import { useFirebasePushNotifications } from '@/lib/hooks/useFirebasePushNotifications';

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

  // Handle new notification from Firebase push
  const handleNewNotification = useCallback((newNotification: Notification) => {
    // Only handle notifications for this user and org
    if (newNotification.user_id === userId && newNotification.org_id === orgId) {
      console.log('🔔 New notification received via Firebase push:', newNotification.id);
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
      // Refetch to ensure we have the latest data from database
      fetchNotifications(false);
    }
  }, [userId, orgId, limit, fetchNotifications]);

  // Set up Firebase push notification listener
  useFirebasePushNotifications({
    onNotification: handleNewNotification,
    enabled: enabled && !!userId && !!orgId,
  });

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
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}

