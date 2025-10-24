/**
 * Manual test script to check invitation acceptance
 * Run: npx tsx scripts/test-invitation-acceptance.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInvitationAcceptance() {
  const testEmail = 'hammadbd08@gmail.com';
  
  console.log('\n🔍 Checking invitation status for:', testEmail);
  
  // Get the invitation
  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('email', testEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !invitation) {
    console.log('❌ No invitation found for this email');
    return;
  }
  
  console.log('\n📋 Invitation Details:');
  console.log('   ID:', invitation.id);
  console.log('   Email:', invitation.email);
  console.log('   Token:', invitation.token);
  console.log('   Created:', invitation.created_at);
  console.log('   Expires:', invitation.expires_at);
  console.log('   accepted_by:', invitation.accepted_by || '❌ NULL');
  console.log('   accepted_at:', invitation.accepted_at || '❌ NULL');
  
  if (invitation.accepted_by && invitation.accepted_at) {
    console.log('\n✅ Invitation is ACCEPTED!');
    
    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', invitation.accepted_by)
      .single();
    
    if (user) {
      console.log('\n👤 User Details:');
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Name:', user.full_name);
      console.log('   org_id:', user.org_id);
      console.log('   role_id:', user.role_id);
      console.log('   is_active:', user.is_active);
    }
  } else {
    console.log('\n⚠️  Invitation is PENDING (not yet accepted)');
    console.log('\n📧 Invitation Link:');
    console.log('   http://localhost:3000/auth/callback-staff?token=' + invitation.token + '&org_id=YOUR_ORG_ID');
  }
  
  // Check expiration
  const now = new Date();
  const expires = new Date(invitation.expires_at);
  if (expires < now) {
    console.log('\n❌ WARNING: Invitation has EXPIRED!');
    console.log('   Expired on:', expires.toLocaleString());
  } else {
    const hoursLeft = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60));
    console.log('\n⏰ Invitation expires in:', hoursLeft, 'hours');
  }
}

testInvitationAcceptance()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

