/**
 * Script to fix principal's org_id in user metadata
 * Run this if org_id is undefined in Principal Dashboard
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixPrincipalOrgId() {
  console.log('🔍 Finding principal without org_id...\n');

  // Get all users with principal role (role_id = 30)
  const { data: principals, error: fetchError } = await supabase
    .from('users')
    .select('id, email, full_name, org_id, role_id')
    .eq('role_id', 30);

  if (fetchError) {
    console.error('❌ Error fetching principals:', fetchError);
    return;
  }

  if (!principals || principals.length === 0) {
    console.log('No principals found in the database.');
    return;
  }

  console.log(`Found ${principals.length} principal(s):\n`);
  
  for (const principal of principals) {
    console.log(`📋 Principal: ${principal.full_name || principal.email}`);
    console.log(`   ID: ${principal.id}`);
    console.log(`   Email: ${principal.email}`);
    console.log(`   org_id: ${principal.org_id || 'NOT SET'}`);

    if (principal.org_id) {
      console.log('   ✅ org_id already set\n');
      
      // Update auth metadata to match
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        principal.id,
        {
          user_metadata: {
            org_id: principal.org_id,
            role: 'principal',
            roles: ['principal']
          }
        }
      );

      if (updateError) {
        console.error('   ❌ Failed to update auth metadata:', updateError);
      } else {
        console.log('   ✅ Updated auth metadata\n');
      }
    } else {
      console.log('   ⚠️  org_id is missing!\n');
      
      // Try to find or create an org for this principal
      const { data: orgs } = await supabase
        .from('orgs')
        .select('id, name')
        .limit(1);

      if (orgs && orgs.length > 0) {
        const orgId = orgs[0].id;
        console.log(`   🔧 Setting org_id to: ${orgId} (${orgs[0].name})`);

        // Update users table
        const { error: updateUsersError } = await supabase
          .from('users')
          .update({ org_id: orgId })
          .eq('id', principal.id);

        if (updateUsersError) {
          console.error('   ❌ Failed to update users table:', updateUsersError);
        } else {
          console.log('   ✅ Updated users table');
        }

        // Update auth metadata
        const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
          principal.id,
          {
            user_metadata: {
              org_id: orgId,
              role: 'principal',
              roles: ['principal']
            }
          }
        );

        if (updateAuthError) {
          console.error('   ❌ Failed to update auth metadata:', updateAuthError);
        } else {
          console.log('   ✅ Updated auth metadata\n');
        }
      } else {
        console.log('   ⚠️  No organizations found. Create one first.\n');
      }
    }
  }

  console.log('\n✅ Done! Please refresh your browser and log in again.');
}

fixPrincipalOrgId().catch(console.error);

