import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getUserDataCacheHeaders } from '@/lib/cacheConfig'

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
    
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    // Query guardians for this specific org only
    const { data: guardians, error } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at')
      .eq('role', 'guardian')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching guardians:', error);
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      guardians: guardians || [],
      total_guardians: guardians?.length || 0
    }, {
      status: 200,
      headers: getUserDataCacheHeaders()
    })

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
    const { first_name, last_name, email, phone, ssn, address, org_id, student_id } = body || {}
    
    if (!email || !first_name) {
      return NextResponse.json({ 
        error: `Missing required fields: ${!email ? 'email' : ''} ${!first_name ? 'first_name' : ''}`.trim()
      }, { status: 400 })
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        error: 'Please enter a valid email address' 
      }, { status: 400 })
    }
    
    // Use the provided org_id or reject if not provided
    let actualOrgId = org_id;
    if (!org_id || org_id === "1") {
      return NextResponse.json({ 
        error: 'Organization ID is required for guardian creation' 
      }, { status: 400 })
    }

    // Check if user already exists in public.users table
    const { data: existingPublicUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (existingPublicUser) {
      return NextResponse.json({
        error: 'This email is already being used by another user'
      }, { status: 400 })
    }

    // Create auth user with default password
    console.log('👤 Checking if auth user exists...')
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingAuthUsers?.users.find(u => u.email === email)

    let authUser = existingAuthUser

    // Create auth user if it doesn't exist
    if (!existingAuthUser) {
      console.log('📝 Creating new auth user with default password...')
      const defaultPassword = 'test123456'
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          roles: ['parent'],
          activeRole: 'parent',
          role: 'parent',
          org_id: actualOrgId,
          first_name: (first_name || '').trim(),
          last_name: (last_name || '').trim() || null,
          ...(student_id ? { student_id } : {}),
        }
      })

      if (createError) {
        console.error('❌ Failed to create auth user:', createError)
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      if (!newAuthUser?.user) {
        return NextResponse.json({ error: 'Auth user not created' }, { status: 500 })
      }

      authUser = newAuthUser.user
      console.log('✅ Auth user created successfully')
    } else {
      console.log('ℹ️ Auth user already exists, using existing user')
    }

    // Ensure authUser is defined before proceeding
    if (!authUser) {
      return NextResponse.json({ error: 'Auth user not found or created' }, { status: 500 })
    }

    const guardianId = authUser.id
    
    // Create simple guardian record in users table
    const userData = {
      id: guardianId,
      email: email,
      phone: phone || null,
      first_name: first_name,
      last_name: last_name || null,
      role: 'guardian' as any,
      org_id: actualOrgId,
      is_active: true,
      ssn: ssn || null,
      address: address || null,
    };
    
    
    
    const { error: publicUserError } = await supabaseAdmin
      .from('users')
      .insert(userData)

    if (publicUserError) {
      console.error('❌ Failed to create guardian:', publicUserError)
      return NextResponse.json({ error: `Failed to create guardian: ${publicUserError.message}` }, { status: 500 })
    }
    // Optionally link to a specific student
    let createdRelationship: any = null
    let studentClassId: string | null = null
    if (student_id) {
      const { data: relationship, error: linkError } = await supabaseAdmin
        .from('guardian_students')
        .insert({ guardian_id: guardianId, student_id, relation: 'parent', org_id })
        .select('id')
        .single()
      if (!linkError) createdRelationship = relationship

      const { data: studentRow } = await supabaseAdmin
        .from('students')
        .select('class_id')
        .eq('id', student_id)
        .maybeSingle()
      studentClassId = studentRow?.class_id ?? null
    }

    // Update auth user metadata with org and class scope
    try {
      await supabaseAdmin.auth.admin.updateUserById(guardianId, {
        user_metadata: {
          roles: ['parent'],
          activeRole: 'parent',
          org_id: actualOrgId,
          ...(studentClassId ? { class_id: studentClassId } : {}),
          ...(student_id ? { student_id } : {}),
        },
      })
    } catch (e) {
      console.warn('Unable to update guardian auth metadata', e)
    }

    // Let's verify the guardian was actually created by querying it back
    const { data: verifyGuardian, error: verifyError } = await supabaseAdmin
      .from('users')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at,ssn,address')
      .eq('id', guardianId)
      .single();
    


    return NextResponse.json({ 
      guardian: {
        id: guardianId,
        email: email,
        first_name: first_name,
        last_name: last_name || null,
        org_id: actualOrgId,
        role: 'guardian',
        ssn: ssn || null,
        address: address || null,
      },
      message: 'Guardian account created successfully with default password.',
      verification: verifyGuardian,
      relationship: createdRelationship
    }, { status: 201 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { id, first_name, last_name, email, phone, ssn, address, org_id, is_active } = body || {}
    
    if (!id || !email || !first_name) {
      return NextResponse.json({ 
        error: `Missing required fields: ${!id ? 'id' : ''} ${!email ? 'email' : ''} ${!first_name ? 'first_name' : ''}`.trim()
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
    
    // Update guardian record in users table
    const { data: updatedGuardian, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        email: email,
        phone: phone || null,
        first_name: first_name,
        last_name: last_name || null,
        org_id: actualOrgId,
        is_active: is_active !== undefined ? is_active : true,
        role: 'guardian' as any,
        ssn: ssn || null,
        address: address || null,
      })
      .eq('id', id)
      .eq('role', 'guardian')
      .select('id,email,phone,first_name,last_name,org_id,role,is_active,created_at,ssn,address')
      .single()

    if (updateError) {
      console.error('❌ Failed to update guardian:', updateError)
      return NextResponse.json({ error: `Failed to update guardian: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ 
      guardian: updatedGuardian,
      message: 'Guardian updated successfully!'
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in guardians PUT:', err)
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
      .eq('role', 'guardian')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}