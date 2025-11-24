import { getFirebaseAdmin, isFirebaseEnabled } from '@/lib/firebase/admin';
import {
  getUserDeviceTokens,
  removeDeviceToken,
  type DeviceTokenProvider,
} from '@/lib/services/deviceTokens';
import type { Notification } from '@/lib/services/notifications';

export interface PushNotificationResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  errors: Array<{ userId: string; error: string }>;
}

/**
 * Send push notification to a single user
 */
export async function sendPushNotification(
  userId: string,
  notification: Notification,
  provider: DeviceTokenProvider = 'fcm'
): Promise<PushNotificationResult> {
  // Check if Firebase is enabled
  if (!isFirebaseEnabled()) {
    console.log('Firebase push notifications are disabled');
    return {
      success: false,
      sentCount: 0,
      failedCount: 0,
      errors: [{ userId, error: 'Firebase is not enabled' }],
    };
  }

  const messaging = getFirebaseAdmin();
  if (!messaging) {
    return {
      success: false,
      sentCount: 0,
      failedCount: 0,
      errors: [{ userId, error: 'Firebase Admin not initialized' }],
    };
  }

  // Get user's device tokens
  const deviceTokens = await getUserDeviceTokens(userId, provider);
  
  if (deviceTokens.length === 0) {
    return {
      success: true,
      sentCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  // Prepare FCM message
  const androidPriority: 'high' | 'normal' = notification.priority === 'high' ? 'high' : 'normal';
  const message = {
    notification: {
      title: notification.title,
      body: notification.body || '',
    },
    data: {
      notificationId: notification.id,
      type: notification.type,
      orgId: notification.org_id,
      userId: notification.user_id,
      priority: notification.priority,
      ...notification.data,
    },
    android: {
      priority: androidPriority,
    },
    apns: {
      headers: {
        'apns-priority': notification.priority === 'high' ? '10' : '5',
      },
    },
  };

  const results: PushNotificationResult = {
    success: true,
    sentCount: 0,
    failedCount: 0,
    errors: [],
  };

  // Send to all device tokens for this user
  const sendPromises = deviceTokens.map(async (deviceToken) => {
    try {
      await messaging.send({
        ...message,
        token: deviceToken.token,
      });
      results.sentCount++;
    } catch (error: any) {
      results.failedCount++;
      const errorMessage = error?.message || 'Unknown error';
      results.errors.push({
        userId,
        error: `Token ${deviceToken.token.substring(0, 10)}...: ${errorMessage}`,
      });

      // Handle invalid token errors
      if (
        error?.code === 'messaging/invalid-registration-token' ||
        error?.code === 'messaging/registration-token-not-registered'
      ) {
        // Remove invalid token
        try {
          await removeDeviceToken(userId, deviceToken.token, provider);
          console.log(`Removed invalid device token for user ${userId}`);
        } catch (removeError) {
          console.error('Failed to remove invalid token:', removeError);
        }
      }
    }
  });

  await Promise.all(sendPromises);

  return results;
}

/**
 * Send push notifications to multiple users in bulk
 * Uses Firebase batch messaging for efficiency
 */
export async function sendBulkPushNotifications(
  userIds: string[],
  notification: Notification,
  provider: DeviceTokenProvider = 'fcm'
): Promise<PushNotificationResult> {
  // Check if Firebase is enabled
  if (!isFirebaseEnabled()) {
    console.log('Firebase push notifications are disabled');
    return {
      success: false,
      sentCount: 0,
      failedCount: userIds.length,
      errors: userIds.map((userId) => ({
        userId,
        error: 'Firebase is not enabled',
      })),
    };
  }

  const messaging = getFirebaseAdmin();
  if (!messaging) {
    return {
      success: false,
      sentCount: 0,
      failedCount: userIds.length,
      errors: userIds.map((userId) => ({
        userId,
        error: 'Firebase Admin not initialized',
      })),
    };
  }

  if (userIds.length === 0) {
    return {
      success: true,
      sentCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  // Get all device tokens for all users
  const allDeviceTokens: Array<{ userId: string; token: string }> = [];
  
  for (const userId of userIds) {
    const tokens = await getUserDeviceTokens(userId, provider);
    for (const tokenData of tokens) {
      allDeviceTokens.push({
        userId,
        token: tokenData.token,
      });
    }
  }

  if (allDeviceTokens.length === 0) {
    return {
      success: true,
      sentCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  // Prepare FCM message
  const androidPriority: 'high' | 'normal' = notification.priority === 'high' ? 'high' : 'normal';
  const baseMessage = {
    notification: {
      title: notification.title,
      body: notification.body || '',
    },
    data: {
      notificationId: notification.id,
      type: notification.type,
      orgId: notification.org_id,
      userId: notification.user_id,
      priority: notification.priority,
      ...notification.data,
    },
    android: {
      priority: androidPriority,
    },
    apns: {
      headers: {
        'apns-priority': notification.priority === 'high' ? '10' : '5',
      },
    },
  };

  const results: PushNotificationResult = {
    success: true,
    sentCount: 0,
    failedCount: 0,
    errors: [],
  };

  // Firebase supports sending to up to 500 tokens at once
  // Split into batches of 500
  const batchSize = 500;
  for (let i = 0; i < allDeviceTokens.length; i += batchSize) {
    const batch = allDeviceTokens.slice(i, i + batchSize);
    const tokens = batch.map((b) => b.token);

    try {
      // Use sendEach for batch sending
      const messages = tokens.map((token) => ({
        ...baseMessage,
        token,
      }));

      const batchResponse = await messaging.sendEach(messages);
      
      // Process results
      batch.forEach((deviceToken, index) => {
        const response = batchResponse.responses[index];
        if (response.success) {
          results.sentCount++;
        } else {
          results.failedCount++;
          const error = response.error;
          results.errors.push({
            userId: deviceToken.userId,
            error: error?.message || 'Unknown error',
          });

          // Handle invalid token errors
          if (
            error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered'
          ) {
            // Remove invalid token
            removeDeviceToken(deviceToken.userId, deviceToken.token, provider).catch(
              (removeError) => {
                console.error('Failed to remove invalid token:', removeError);
              }
            );
          }
        }
      });
    } catch (error: any) {
      // If batch fails, try individual sends
      console.warn('Batch send failed, falling back to individual sends:', error);
      
      for (const deviceToken of batch) {
        try {
          await messaging.send({
            ...baseMessage,
            token: deviceToken.token,
          });
          results.sentCount++;
        } catch (individualError: any) {
          results.failedCount++;
          results.errors.push({
            userId: deviceToken.userId,
            error: individualError?.message || 'Unknown error',
          });

          // Handle invalid token errors
          if (
            individualError?.code === 'messaging/invalid-registration-token' ||
            individualError?.code === 'messaging/registration-token-not-registered'
          ) {
            removeDeviceToken(deviceToken.userId, deviceToken.token, provider).catch(
              (removeError) => {
                console.error('Failed to remove invalid token:', removeError);
              }
            );
          }
        }
      }
    }
  }

  return results;
}

