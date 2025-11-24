'use client';

import { useDeviceToken } from '@/lib/hooks/useDeviceToken';

/**
 * Component to manage device token registration
 * Automatically registers device token when user is logged in
 */
export function DeviceTokenManager() {
  useDeviceToken({
    enabled: true,
    autoRegister: true,
  });

  return null; // This component doesn't render anything
}

