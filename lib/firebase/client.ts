'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

let firebaseApp: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

/**
 * Initialize Firebase client-side app
 * Requires Firebase web app configuration
 */
export function getFirebaseClientApp(): FirebaseApp | null {
  // Return existing instance if already initialized
  if (firebaseApp) {
    return firebaseApp;
  }

  // Check if Firebase is enabled
  const firebaseEnabled = process.env.NEXT_PUBLIC_FIREBASE_ENABLED === 'true';
  if (!firebaseEnabled) {
    console.log('Firebase client is disabled (NEXT_PUBLIC_FIREBASE_ENABLED !== true)');
    return null;
  }

  // Check for required environment variables
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    console.warn(
      'Firebase client not initialized: Missing required environment variables. ' +
      'Required: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, ' +
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID'
    );
    return null;
  }

  try {
    // Check if app already exists
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseApp = existingApps[0];
    } else {
      // Initialize Firebase
      firebaseApp = initializeApp({
        apiKey,
        authDomain,
        projectId,
        storageBucket: storageBucket || `${projectId}.appspot.com`,
        messagingSenderId,
        appId,
      });
    }

    console.log('Firebase client initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase client:', error);
    return null;
  }
}

/**
 * Get Firebase Messaging instance
 */
export function getFirebaseMessaging(): Messaging | null {
  if (messagingInstance) {
    return messagingInstance;
  }

  if (typeof window === 'undefined') {
    // Server-side, return null
    return null;
  }

  const app = getFirebaseClientApp();
  if (!app) {
    return null;
  }

  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (error) {
    console.error('Failed to get Firebase Messaging:', error);
    return null;
  }
}

/**
 * Get FCM token for the current device
 */
export async function getFCMToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn('Firebase Messaging not available');
    return null;
  }

  try {
    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    // Get FCM token
    // Firebase will automatically register the service worker at /firebase-messaging-sw.js
    // which is rewritten to /api/firebase-messaging-sw.js via next.config.js
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    if (!token) {
      console.warn('No FCM token available');
      return null;
    }

    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Listen for foreground push notifications
 */
export function onForegroundMessage(
  callback: (payload: any) => void
): (() => void) | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return null;
  }

  try {
    return onMessage(messaging, callback);
  } catch (error) {
    console.error('Error setting up foreground message listener:', error);
    return null;
  }
}

/**
 * Check if Firebase client is enabled and configured
 */
export function isFirebaseClientEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_ENABLED === 'true' &&
    !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  );
}

