import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

let messagingInstance: Messaging | null = null;
let firebaseApp: App | null = null;

/**
 * Initialize Firebase Admin SDK
 * Uses service account credentials from environment variables
 */
export function getFirebaseAdmin(): Messaging | null {
  // Return existing instance if already initialized
  if (messagingInstance) {
    return messagingInstance;
  }

  // Check if Firebase is enabled
  const firebaseEnabled = process.env.FIREBASE_ENABLED === 'true';
  if (!firebaseEnabled) {
    console.log('Firebase push notifications are disabled (FIREBASE_ENABLED !== true)');
    return null;
  }

  // Check for required environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.warn(
      'Firebase Admin SDK not initialized: Missing required environment variables. ' +
      'Required: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL'
    );
    return null;
  }

  try {
    // Check if app already exists
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseApp = existingApps[0];
    } else {
      // Initialize Firebase Admin
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          privateKey,
          clientEmail,
        }),
      });
    }

    // Get messaging instance
    messagingInstance = getMessaging(firebaseApp);
    console.log('Firebase Admin SDK initialized successfully');
    return messagingInstance;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    return null;
  }
}

/**
 * Check if Firebase is available and configured
 */
export function isFirebaseEnabled(): boolean {
  return process.env.FIREBASE_ENABLED === 'true' && 
         !!process.env.FIREBASE_PROJECT_ID && 
         !!process.env.FIREBASE_PRIVATE_KEY && 
         !!process.env.FIREBASE_CLIENT_EMAIL;
}

