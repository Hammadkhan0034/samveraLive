import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { createUserAuthEntry } from 'app/core/createAuthEntry'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Guardian role ID
const GUARDIAN_ROLE_ID = 10

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    
    // Resolve org_id if it's "1" to a proper UUID
    let actualOrgId = orgId;
    if (orgId === "1") {
      const { data: firstOrg } = await supabaseAdmin
        .from('orgs')
        .select('id')
        .limit(1)
        .single();
      
      if (firstOrg?.id) {
        actualOrgId = firstOrg.id;
      } else {
        actualOrgId = '00000000-0000-0000-0000-000000000001'; // Default UUID for testing
      }
    }

    // Final query: guardians for this org
    const { data: guardians, error } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,full_name,org_id,role_id,is_active,created_at,metadata')
      .eq('role_id', GUARDIAN_ROLE_ID)
      .eq('org_id', actualOrgId)
      .order('created_at', { ascending: false })
    

    // If no guardians found for this org, let's also check the default org
    if ((!guardians || guardians.length === 0) && actualOrgId !== '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7') {
      const { data: defaultGuardians, error: defaultError } = await supabaseAdmin
        .from('users')
        .select('id,email,phone,full_name,org_id,role_id,is_active,created_at,metadata')
        .eq('org_id', '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7')
        .eq('role_id', GUARDIAN_ROLE_ID)
        .order('created_at', { ascending: false });
      
      
      if (defaultGuardians && defaultGuardians.length > 0) {
        return NextResponse.json({ 
          guardians: defaultGuardians,
          total_guardians: defaultGuardians.length
        }, { status: 200 });
      }
    }

    // Let's also try a simple query without filters to see what's in the database
    const { data: allUsersSimple, error: allUsersSimpleError } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,full_name,org_id,role_id,is_active,created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    

    // Let's specifically check for the guardian we just created
    const { data: specificGuardian, error: specificError } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,full_name,org_id,role_id,is_active,created_at')
      .eq('role_id', GUARDIAN_ROLE_ID)
      .order('created_at', { ascending: false });
    

    // Let's also check if there are any users with the specific org_id we're looking for
    const { data: orgUsers, error: orgError } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,full_name,org_id,role_id,is_active,created_at')
      .eq('org_id', actualOrgId);
    

    if (error) {
      console.error('❌ Error fetching guardians:', error);
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      guardians: guardians || [],
      total_guardians: guardians?.length || 0
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { name, full_name, email, phone, org_id, created_by } = body || {}
    
    // Use full_name if provided, otherwise use name
    const guardianName = full_name || name;
    
    if (!email || !guardianName) {
      return NextResponse.json({ 
        error: `Missing required fields: ${!email ? 'email' : ''} ${!guardianName ? 'name' : ''}`.trim()
      }, { status: 400 })
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        error: 'Please enter a valid email address' 
      }, { status: 400 })
    }
    
    // Resolve org_id if it's "1" to a proper UUID
    let actualOrgId = org_id;
    if (org_id === "1") {
      const { data: firstOrg } = await supabaseAdmin
        .from('orgs')
        .select('id')
        .limit(1)
        .single();
      
      if (firstOrg?.id) {
        actualOrgId = firstOrg.id;
      } else {
        actualOrgId = '00000000-0000-0000-0000-000000000001'; // Default UUID for testing
      }
    }
    

    // Create user auth entry
    const { data: authData, error: authError } = await createUserAuthEntry(email, "test123456", 'parent', guardianName)
    if (authError) {
      console.error('❌ Error creating user auth entry:', authError)
      const errorMessage = (authError as any)?.message || 'Failed to create user auth entry'
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }

    // Generate a simple UUID for the guardian
    if (!authData?.user?.id) {
      return NextResponse.json({ error: 'Failed to create user - no user data returned' }, { status: 500 })
    }
    const guardianId = authData.user.id
    
    // Create simple guardian record in users table
    const userData = {
      id: guardianId,
      email: email,
      phone: phone || null,
      full_name: guardianName,
      role_id: GUARDIAN_ROLE_ID,
      org_id: actualOrgId,
      is_active: true,
      metadata: {
        role: 'parent',
        org_id: actualOrgId,
        phone: phone || null
      }
    };
    
    
    
    const { error: publicUserError } = await supabaseAdmin
      .from('users')
      .insert(userData)

    if (publicUserError) {
      console.error('❌ Failed to create guardian:', publicUserError)
      return NextResponse.json({ error: `Failed to create guardian: ${publicUserError.message}` }, { status: 500 })
    }


    // Let's verify the guardian was actually created by querying it back
    const { data: verifyGuardian, error: verifyError } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,full_name,org_id,role_id,is_active,created_at')
      .eq('id', guardianId)
      .single();
    


    return NextResponse.json({ 
      guardian: {
        id: guardianId,
        email: email,
        full_name: guardianName,
        org_id: actualOrgId,
        role_id: GUARDIAN_ROLE_ID
      },
      message: 'Guardian created successfully!',
      verification: verifyGuardian
    }, { status: 201 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Delete guardian from users table
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id)
      .eq('role_id', GUARDIAN_ROLE_ID)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}