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
const removeTeacherClassBodySchema = z.object({
  userId: userIdSchema,
  classId: classIdSchema,
});

export async function handleRemoveTeacherClass(
  request: Request,
  _user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const body = await request.json();
    const bodyValidation = validateBody(removeTeacherClassBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { userId, classId } = bodyValidation.data;

    console.log('🔧 Removing teacher from class:', { userId, classId });

    // Remove membership from class_memberships table
    const { error } = await adminClient
      .from('class_memberships')
      .delete()
      .eq('user_id', userId)
      .eq('class_id', classId);

    if (error) {
      console.error('❌ Error removing class membership:', error);
      return NextResponse.json(
        { error: 'Failed to remove teacher from class' },
        { status: 500 },
      );
    }

    console.log('✅ Teacher removed from class successfully');
    return NextResponse.json({
      success: true,
      message: 'Teacher removed from class successfully',
    });
  } catch (error) {
    console.error('💥 Error in remove-teacher-class handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

