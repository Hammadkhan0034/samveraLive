/**
 * Test script to verify Firebase Admin SDK initialization
 * Run with: npx tsx lib/testFirebaseConnection.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getFirebaseAdmin, isFirebaseEnabled } from './firebase/admin';

async function testFirebaseConnection() {
  console.log('🔍 Testing Firebase Configuration...\n');

  // Check if Firebase is enabled
  const enabled = isFirebaseEnabled();
  console.log(`Firebase Enabled: ${enabled ? '✅' : '❌'}`);

  if (!enabled) {
    console.log('\n⚠️  Firebase is not enabled or missing required environment variables.');
    console.log('Required variables:');
    console.log('  - FIREBASE_ENABLED=true');
    console.log('  - FIREBASE_PROJECT_ID');
    console.log('  - FIREBASE_PRIVATE_KEY');
    console.log('  - FIREBASE_CLIENT_EMAIL');
    process.exit(1);
  }

  // Check environment variables
  console.log('\n📋 Environment Variables:');
  console.log(`  FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`  FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing'}`);
  console.log(`  FIREBASE_PRIVATE_KEY: ${process.env.FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Missing'}`);

  // Try to initialize Firebase Admin
  console.log('\n🚀 Initializing Firebase Admin SDK...');
  try {
    const messaging = getFirebaseAdmin();
    
    if (messaging) {
      console.log('✅ Firebase Admin SDK initialized successfully!');
      console.log('✅ Push notifications are ready to use.');
      process.exit(0);
    } else {
      console.log('❌ Failed to initialize Firebase Admin SDK');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testFirebaseConnection();

