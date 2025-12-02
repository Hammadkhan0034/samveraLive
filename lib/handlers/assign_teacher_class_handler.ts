import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  validateBody,
  userIdSchema,
  classIdSchema,
} from '@/lib/validation';
import type { AuthUser } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

// POST body schema
const assignTeacherClassBodySchema = z.object({
  userId: userIdSchema,
  classId: classIdSchema,
});

export async function handleAssignTeacherClass(
  request: Request,
  _user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const body = await request.json();
    const bodyValidation = validateBody(assignTeacherClassBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { userId, classId } = bodyValidation.data;

    console.log('🔧 Assigning teacher to class:', { userId, classId });

    // Get org_id from the class
    const { data: classData, error: classError } = await adminClient
      .from('classes')
      .select('org_id')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      console.error('❌ Error fetching class:', classError);
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 },
      );
    }

    const orgId = classData.org_id;

    // First, remove any existing memberships for this user and class
    const { error: deleteError } = await adminClient
      .from('class_memberships')
      .delete()
      .eq('user_id', userId)
      .eq('class_id', classId);

    if (deleteError) {
      console.error('❌ Error removing existing memberships:', deleteError);
    }

    // Add new membership using class_memberships table
    const { data, error } = await adminClient
      .from('class_memberships')
      .insert({
        org_id: orgId,
        user_id: userId,
        class_id: classId,
        membership_role: 'teacher',
      })
      .select();

    if (error) {
      console.error('❌ Error creating class membership:', error);
      return NextResponse.json(
        { error: 'Failed to assign class to teacher' },
        { status: 500 },
      );
    }

    console.log('✅ Teacher assigned to class successfully:', data);
    return NextResponse.json({
      success: true,
      message: 'Teacher assigned to class successfully',
      membership: data?.[0] ?? null,
    });
  } catch (error) {
    console.error('💥 Error in assign-teacher-class handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}


