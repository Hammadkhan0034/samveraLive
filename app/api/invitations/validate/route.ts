import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Get invitation details
    const { data: invitation, error } = await supabaseAdmin
      .from('invitations')
      .select('id,email,role_id,expires_at,accepted_at,deleted_at')
      .eq('token', token)
      .is('deleted_at', null)
      .single()

    if (error || !invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
    }

    // Check if invitation is expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
    }

    // Check if invitation is already accepted
    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'Invitation has already been accepted' }, { status: 400 })
    }

    return NextResponse.json({ 
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role_id: invitation.role_id,
        expires_at: invitation.expires_at
      }
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
