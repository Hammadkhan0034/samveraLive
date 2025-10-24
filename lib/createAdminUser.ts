// Script to create admin user
// Run this with: npx tsx lib/createAdminUser.ts

import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminUser, TEST_USERS } from './createTestUser';

async function main() {
  console.log('Creating admin user...');
  console.log('Credentials:', TEST_USERS.admin);

  const result = await createAdminUser();
  
  if (result.error) {
    console.error('Failed to create admin user:', result.error);
    process.exit(1);
  }

  console.log('Admin user created successfully!');
  console.log('You can now login with:');
  console.log(`Email: ${TEST_USERS.admin.email}`);
  console.log(`Password: ${TEST_USERS.admin.password}`);
  console.log('Or visit: /signin?role=admin');
}

main().catch(console.error);
