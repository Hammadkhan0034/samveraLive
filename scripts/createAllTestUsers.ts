#!/usr/bin/env npx tsx

import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

import {
  createAdminUser,
  createTeacherUser,
  createPrincipalUser,
  createParentUser,
  TEST_USERS,
} from '../lib/createTestUser';

async function main() {
  try {
    console.log('Creating admin:', TEST_USERS.admin);
    const a = await createAdminUser();
    if ((a as any)?.error) throw (a as any).error;
    console.log('Admin created');

    console.log('Creating teacher:', TEST_USERS.teacher);
    const t = await createTeacherUser();
    if ((t as any)?.error) throw (t as any).error;
    console.log('Teacher created');

    console.log('Creating principal:', TEST_USERS.principal);
    const p = await createPrincipalUser();
    if ((p as any)?.error) throw (p as any).error;
    console.log('Principal created');

    console.log('Creating parent:', TEST_USERS.parent);
    const pa = await createParentUser();
    if ((pa as any)?.error) throw (pa as any).error;
    console.log('Parent created');

    console.log('✅ All test users created');
  } catch (err) {
    console.error('❌ Failed creating test users:', err);
    process.exit(1);
  }
}

main();


