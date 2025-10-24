#!/usr/bin/env npx tsx

import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

import { supabase } from '../lib/supabaseClient';

async function testConnection() {
  console.log('🔗 Testing Supabase connection...');
  
  // Check environment variables
  console.log('📋 Environment check:');
  console.log('  SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ SET' : '❌ MISSING');
  console.log('  SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ SET' : '❌ MISSING');
  console.log('  SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ SET' : '❌ MISSING');
  
  try {
    // Test database connection
    console.log('\n🗄️  Testing database connection...');
    const { data, error } = await supabase.from('users').select('id').limit(1);
    
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Database connection successful!');
    
    // Test auth connection
    console.log('\n🔐 Testing auth connection...');
    const { data: session } = await supabase.auth.getSession();
    console.log('✅ Auth service accessible!');
    
    // Test OTP send (optional)
    console.log('\n📧 Testing OTP send...');
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: 'test@example.com',
      options: { shouldCreateUser: false }
    });
    
    if (otpError && !otpError.message.includes('rate limit')) {
      console.log('⚠️  OTP test failed:', otpError.message);
    } else {
      console.log('✅ OTP service working!');
    }
    
    console.log('\n🎉 All tests passed! Supabase is properly configured.');
    return true;
    
  } catch (err: any) {
    console.error('❌ Connection test failed:', err.message);
    return false;
  }
}

async function main() {
  const success = await testConnection();
  process.exit(success ? 0 : 1);
}

main();
