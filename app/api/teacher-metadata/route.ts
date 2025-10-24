import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    
    if (!user_id) {
      return NextResponse.json({ 
        error: 'user_id is required' 
      }, { status: 400 })
    }

    console.log('🔍 Looking up user:', user_id);

    // Get user's org_id and class_id from the database
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('org_id, metadata')
      .eq('id', user_id)
      .single()

    console.log('📊 User data result:', { userData, userError });

    if (userError) {
      console.error('❌ Database error:', userError);
      return NextResponse.json({ 
        error: `Failed to get user data: ${userError.message}` 
      }, { status: 500 })
    }

    if (!userData) {
      console.log('⚠️ No user data found, creating default values');
      return NextResponse.json({ 
        org_id: process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'default-org',
        class_id: 'default-class'
      })
    }

    return NextResponse.json({ 
      org_id: userData.org_id,
      class_id: userData.metadata?.class_id || null
    })

  } catch (err: any) {
    console.error('💥 API Error:', err);
    return NextResponse.json({ 
      error: err.message || 'Unknown error' 
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user_id, org_id, class_id } = await request.json()
    
    console.log('📝 Updating user metadata:', { user_id, org_id, class_id });
    
    if (!user_id || !org_id) {
      return NextResponse.json({ 
        error: 'user_id and org_id are required' 
      }, { status: 400 })
    }

    // Get current user metadata
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id)
    
    if (userError) {
      console.error('❌ Failed to get user:', userError);
      return NextResponse.json({ 
        error: `Failed to get user: ${userError.message}` 
      }, { status: 500 })
    }

    console.log('👤 Current user metadata:', user.user.user_metadata);

    // Update user metadata with org_id and class_id
    const updatedMetadata = {
      ...user.user.user_metadata,
      org_id: org_id,
      ...(class_id ? { class_id: class_id } : {})
    }

    console.log('🔄 Updated metadata:', updatedMetadata);

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: updatedMetadata
    })

    if (updateError) {
      console.error('❌ Failed to update auth metadata:', updateError);
      return NextResponse.json({ 
        error: `Failed to update user metadata: ${updateError.message}` 
      }, { status: 500 })
    }

    console.log('✅ Auth metadata updated successfully');

    // Also update the public.users table
    const { error: publicUpdateError } = await supabaseAdmin
      .from('users')
      .upsert({ 
        id: user_id,
        org_id: org_id,
        metadata: updatedMetadata
      }, { onConflict: 'id' })

    if (publicUpdateError) {
      console.error('⚠️ Failed to update public user (non-critical):', publicUpdateError)
    } else {
      console.log('✅ Public user table updated successfully');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'User metadata updated successfully',
      metadata: updatedMetadata
    })

  } catch (err: any) {
    console.error('💥 POST API Error:', err);
    return NextResponse.json({ 
      error: err.message || 'Unknown error' 
    }, { status: 500 })
  }
}
