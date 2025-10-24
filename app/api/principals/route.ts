import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { createUserAuthEntry } from 'app/core/createAuthEntry'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// principals are domain users with role_id = 30 (example); adjust to your roles table value
const PRINCIPAL_ROLE_ID = 30

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId') || undefined
    
    let q = supabaseAdmin
      .from('users')
      .select('id,email,phone,full_name,org_id,role_id,is_active,metadata,created_at,updated_at,deleted_at')
      .eq('role_id', PRINCIPAL_ROLE_ID)
      .is('deleted_at', null) // Only get non-deleted principals
      .order('created_at', { ascending: false })
      
    if (orgId) q = q.eq('org_id', orgId)
    
    const { data, error } = await q
    
    if (error) {
      console.error('❌ Error fetching principals:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log('✅ Fetched principals:', data?.length || 0)
    
    const principals = (data || []).map((u: any) => ({
      id: u.id,
      full_name: u.full_name,
      org_id: u.org_id,
      email: u.email,
      phone: u.phone,
      role: 'principal',
      role_id: u.role_id,
      is_active: u.is_active,
      metadata: u.metadata || {},
      created_at: u.created_at,
      updated_at: u.updated_at,
      deleted_at: u.deleted_at
    }))
    
    return NextResponse.json({ principals }, { status: 200 })
  } catch (err: any) {
    console.error('💥 Error in principals GET:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const body = await request.json()
    const { 
      id, 
      email, 
      phone, 
      full_name, 
      org_id, 
      metadata, 
      is_active,
      created_by 
    } = body || {}
    
    if (!org_id || !full_name) {
      return NextResponse.json({ error: 'full_name and org_id are required' }, { status: 400 })
    }

    // Create user auth entry
    const { data: authData, error: authError } = await createUserAuthEntry(email, "test123456", 'principal', full_name)
    if (authError) {
      console.error('❌ Error creating user auth entry:', authError)
      const errorMessage = (authError as any)?.message || 'Failed to create user auth entry'
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
    
    // Generate UUID if not provided
    if (!authData?.user?.id) {
      return NextResponse.json({ error: 'Failed to create user - no user data returned' }, { status: 500 })
    }
    const principalId = authData.user.id
    
    // Prepare metadata with role and creation info
    const principalMetadata = {
      role: 'principal',
      created_by: created_by || 'admin',
      created_at: new Date().toISOString(),
      ...metadata
    }
    
    // Prepare the principal data with all required fields
    const principalData = {
      id: principalId,
      email: email || null,
      phone: phone || null,
      full_name,
      org_id,
      role_id: PRINCIPAL_ROLE_ID,
      is_active: is_active !== undefined ? is_active : true,
      metadata: principalMetadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    }
    
    console.log('🔧 Creating principal with data:', principalData)
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert(principalData, { onConflict: 'id' })
      .select('id,email,phone,full_name,org_id,role_id,is_active,metadata,created_at,updated_at,deleted_at')
      .single()
      
    if (error) {
      console.error('❌ Error creating principal:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log('✅ Principal created successfully:', data)
    
    const principal = {
      id: data.id,
      full_name: data.full_name,
      org_id: data.org_id,
      email: data.email,
      phone: data.phone,
      role: 'principal',
      role_id: data.role_id,
      is_active: data.is_active,
      metadata: data.metadata || {},
      created_at: data.created_at,
      updated_at: data.updated_at,
      deleted_at: data.deleted_at
    }
    
    return NextResponse.json({ 
      principal,
      message: 'Principal created successfully'
    }, { status: 201 })
  } catch (err: any) {
    console.error('💥 Error in principal creation:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const body = await request.json()
    const { id, full_name, org_id, is_active, email, phone, metadata } = body || {}
    
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    
    const patch: any = {
      updated_at: new Date().toISOString()
    }
    
    if (full_name !== undefined) patch.full_name = full_name
    if (org_id !== undefined) patch.org_id = org_id
    if (is_active !== undefined) patch.is_active = is_active
    if (email !== undefined) patch.email = email
    if (phone !== undefined) patch.phone = phone
    if (metadata !== undefined) patch.metadata = metadata
    
    console.log('🔧 Updating principal with data:', patch)
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(patch)
      .eq('id', id)
      .eq('role_id', PRINCIPAL_ROLE_ID)
      .select('id,email,phone,full_name,org_id,role_id,is_active,metadata,created_at,updated_at,deleted_at')
      .single()
      
    if (error) {
      console.error('❌ Error updating principal:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log('✅ Principal updated successfully:', data)
    
    const principal = {
      id: data.id,
      full_name: data.full_name,
      org_id: data.org_id,
      email: data.email,
      phone: data.phone,
      role: 'principal',
      role_id: data.role_id,
      is_active: data.is_active,
      metadata: data.metadata || {},
      created_at: data.created_at,
      updated_at: data.updated_at,
      deleted_at: data.deleted_at
    }
    
    return NextResponse.json({ 
      principal,
      message: 'Principal updated successfully'
    }, { status: 200 })
  } catch (err: any) {
    console.error('💥 Error in principal update:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    
    console.log('🗑️ Soft deleting principal:', id)
    
    // Soft delete - set deleted_at timestamp
    const { error } = await supabaseAdmin
      .from('users')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('role_id', PRINCIPAL_ROLE_ID)
      
    if (error) {
      console.error('❌ Error deleting principal:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log('✅ Principal soft deleted successfully')
    
    return NextResponse.json({ 
      success: true,
      message: 'Principal deleted successfully'
    }, { status: 200 })
  } catch (err: any) {
    console.error('💥 Error in principal deletion:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}


