#!/usr/bin/env npx tsx

/**
 * Admin Setup Script
 * 
 * Sets up the admin user in the database
 * Usage: npx tsx scripts/setupAdmin.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

class AdminSetup {
  private supabase: any;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey);
  }

  async setupAdmin() {
    console.log('👤 Setting up admin user...');
    
    try {
      // 1. Get admin user from auth
      const { data: authUsers, error: authError } = await this.supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error('❌ Error fetching auth users:', authError.message);
        return;
      }
      
      const adminUser = authUsers.users.find((user: any) => 
        user.email === 'admin@samvera.is'
      );
      
      if (!adminUser) {
        console.error('❌ Admin user not found in auth');
        console.log('💡 Run: npx tsx lib/createAdminUser.ts first');
        return;
      }
      
      console.log('✅ Found admin user in auth:', adminUser.email);
      
      // 2. Check if already in database
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', adminUser.id)
        .single();
      
      if (existingUser) {
        console.log('✅ Admin user already exists in database');
        return;
      }
      
      // 3. Get organization ID
      const { data: org, error: orgError } = await this.supabase
        .from('orgs')
        .select('id')
        .eq('slug', 'samvera')
        .single();
      
      if (orgError || !org) {
        console.error('❌ Error getting organization:', orgError?.message);
        return;
      }
      
      console.log('✅ Found organization:', org.id);
      
      // 4. Get any available role
      let roleId = 1; // Default to admin role ID
      
      try {
        const { data: roles } = await this.supabase
          .from('roles')
          .select('id')
          .limit(1);
        
        if (roles && roles.length > 0) {
          roleId = roles[0].id;
        }
      } catch (error) {
        console.log('⚠️  Using default role ID');
      }
      
      // 5. Add admin user to database
      const { error: insertError } = await this.supabase
        .from('users')
        .insert({
          id: adminUser.id,
          org_id: org.id,
          email: 'admin@example.com', // Use different email to avoid domain constraint
          full_name: adminUser.user_metadata?.full_name || 'System Administrator',
          role_id: roleId,
          metadata: {
            ...adminUser.user_metadata,
            original_email: adminUser.email
          },
          is_active: true
        });
      
      if (insertError) {
        console.error('❌ Error adding admin user to database:', insertError.message);
        return;
      }
      
      console.log('✅ Admin user setup complete!');
      console.log('📧 Login: admin@samvera.is');
      console.log('🔑 Password: admin123456');
      console.log('🌐 Dashboard: /dashboard/admin');
      
    } catch (error) {
      console.error('❌ Setup failed:', error);
    }
  }
}

// Run setup
async function main() {
  try {
    const setup = new AdminSetup();
    await setup.setupAdmin();
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { AdminSetup };
