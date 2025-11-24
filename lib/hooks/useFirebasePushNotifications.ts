'use client';

import { useEffect, useCallback } from 'react';
import { onForegroundMessage, isFirebaseClientEnabled } from '@/lib/firebase/client';
import type { Notification } from '@/lib/services/notifications';

interface UseFirebasePushNotificationsOptions {
  onNotification?: (notification: Notification) => void;
  enabled?: boolean;
}

/**
 * Hook to listen for Firebase push notifications and update UI instantly
 */
export function useFirebasePushNotifications(
  options: UseFirebasePushNotificationsOptions = {}
): { isListening: boolean } {
  const { onNotification, enabled = true } = options;

  // Set up foreground message listener
  useEffect(() => {
    if (!enabled || !isFirebaseClientEnabled()) {
      return;
    }

    if (!onNotification) {
      return;
    }

    // Listen for foreground messages
    const unsubscribe = onForegroundMessage((payload) => {
      try {
        console.log('🔔 Foreground push notification received:', payload);

        // Extract notification data from payload
        const notificationData = payload.data;
        if (!notificationData) {
          console.warn('No notification data in payload');
          return;
        }

        // Convert payload data to Notification object
        const notification: Notification = {
          id: notificationData.notificationId || '',
          org_id: notificationData.orgId || '',
          user_id: notificationData.userId || '',
          type: notificationData.type || '',
          title: payload.notification?.title || notificationData.title || '',
          body: payload.notification?.body || notificationData.body || null,
          data: notificationData,
          is_read: false,
          read_at: null,
          priority: notificationData.priority || 'normal',
          expires_at: notificationData.expiresAt || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Call the callback to update UI
        onNotification(notification);
      } catch (error) {
        console.error('Error handling foreground push notification:', error);
      }
    });

    // Cleanup on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [enabled, onNotification]);

  return {
    isListening: enabled && isFirebaseClientEnabled(),
  };
}

