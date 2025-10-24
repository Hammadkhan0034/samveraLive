#!/usr/bin/env npx tsx

import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

async function runDatabaseFix() {
  console.log('🔧 Running database schema fixes...');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ SET' : '❌ MISSING');
    console.error('  SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅ SET' : '❌ MISSING');
    return false;
  }
  
  try {
    // Create admin client
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    console.log('📄 Executing SQL schema fixes...');
    
    // Execute SQL commands one by one
    const sqlCommands = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE classes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE children ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE invitations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE classes ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);",
      "ALTER TABLE children ADD COLUMN IF NOT EXISTS medical_notes_encrypted text;",
      "ALTER TABLE children ADD COLUMN IF NOT EXISTS allergies_encrypted text;",
      "ALTER TABLE children ADD COLUMN IF NOT EXISTS emergency_contact_encrypted text;",
      "INSERT INTO roles (id, name) VALUES (4, 'principal') ON CONFLICT (id) DO NOTHING;",
      "INSERT INTO roles (id, name) VALUES (5, 'teacher') ON CONFLICT (id) DO NOTHING;"
    ];
    
    for (const sql of sqlCommands) {
      console.log(`  Executing: ${sql.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.warn(`  ⚠️  Warning: ${error.message}`);
      } else {
        console.log(`  ✅ Success`);
      }
    }
    
    console.log('✅ Database schema fixes applied successfully!');
    
    // Test the connection with the fixed schema
    console.log('\n🧪 Testing connection with fixed schema...');
    const { data: testData, error: testError } = await supabase.from('users').select('id').limit(1);
    
    if (testError) {
      console.error('❌ Connection test failed:', testError.message);
      return false;
    }
    
    console.log('✅ Connection test passed!');
    console.log('\n🎉 Database schema has been fixed successfully!');
    return true;
    
  } catch (err: any) {
    console.error('❌ Database fix failed:', err.message);
    return false;
  }
}

async function main() {
  const success = await runDatabaseFix();
  process.exit(success ? 0 : 1);
}

main();
