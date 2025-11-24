'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getFCMToken, isFirebaseClientEnabled } from '@/lib/firebase/client';
import { registerDeviceTokenAction, unregisterDeviceTokenAction } from '@/lib/server-actions';

interface UseDeviceTokenOptions {
  enabled?: boolean;
  autoRegister?: boolean;
}

interface UseDeviceTokenReturn {
  token: string | null;
  isRegistering: boolean;
  isRegistered: boolean;
  error: Error | null;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
}

/**
 * Hook to manage device token registration for push notifications
 */
export function useDeviceToken(
  options: UseDeviceTokenOptions = {}
): UseDeviceTokenReturn {
  const { enabled = true, autoRegister = true } = options;
  const { user, session } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Register device token
  const register = useCallback(async () => {
    if (!user || !session) {
      setError(new Error('User not authenticated'));
      return;
    }

    if (!isFirebaseClientEnabled()) {
      console.log('Firebase client not enabled, skipping device token registration');
      return;
    }

    try {
      setIsRegistering(true);
      setError(null);

      // Get FCM token
      const fcmToken = await getFCMToken();
      if (!fcmToken) {
        throw new Error('Failed to get FCM token');
      }

      setToken(fcmToken);

      // Register token on server
      await registerDeviceTokenAction(fcmToken, 'fcm');
      setIsRegistered(true);
      console.log('✅ Device token registered successfully');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to register device token');
      setError(error);
      console.error('❌ Error registering device token:', error);
    } finally {
      setIsRegistering(false);
    }
  }, [user, session]);

  // Unregister device token
  const unregister = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setError(null);
      await unregisterDeviceTokenAction(token, 'fcm');
      setToken(null);
      setIsRegistered(false);
      console.log('✅ Device token unregistered successfully');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to unregister device token');
      setError(error);
      console.error('❌ Error unregistering device token:', error);
    }
  }, [token]);

  // Auto-register on mount if user is logged in
  useEffect(() => {
    if (!enabled || !autoRegister) {
      return;
    }

    if (!user || !session) {
      return;
    }

    // Only register if we don't have a token yet
    if (!token && !isRegistering) {
      register();
    }
  }, [enabled, autoRegister, user, session, token, isRegistering, register]);

  // Unregister on logout
  useEffect(() => {
    if (!user && token) {
      unregister();
    }
  }, [user, token, unregister]);

  return {
    token,
    isRegistering,
    isRegistered,
    error,
    register,
    unregister,
  };
}

