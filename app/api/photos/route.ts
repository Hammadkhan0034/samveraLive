import { NextResponse } from 'next/server';
import { requireServerAuth } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getNoCacheHeaders } from '@/lib/cacheConfig';
import { z } from 'zod';
import { validateQuery } from '@/lib/validation';
import { getAuthUserWithOrg, MissingOrgIdError, mapAuthErrorToResponse } from '@/lib/server-helpers';

// GET query parameter schema - orgId removed, now fetched server-side
const getPhotosQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export async function GET(request: Request) {
  try {
    // Get authenticated user and orgId from server-side auth (no query params needed)
    let user, orgId: string;
    try {
      const authContext = await getAuthUserWithOrg();
      user = authContext.user;
      orgId = authContext.orgId;
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return mapAuthErrorToResponse(err);
      }
      const message = err instanceof Error ? err.message : 'Authentication required';
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(getPhotosQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { classId, studentId, limit, offset } = queryValidation.data;

    // Build query - start with basic photo data
    let query = supabaseAdmin
      .from('photos')
      .select(`
        id,
        org_id,
        class_id,
        student_id,
        upload_id,
        author_id,
        caption,
        is_public,
        created_at,
        updated_at
      `)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset || 0, (offset || 0) + (limit || 50) - 1);

    if (classId) {
      query = query.eq('class_id', classId);
    }

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data: photos, error } = await query;

    if (error) {
      console.error('Error fetching photos:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch photos',
        details: error.message 
      }, { status: 500 });
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { photos: [], count: 0 },
        { headers: getNoCacheHeaders() }
      );
    }

    // Fetch upload records and related data
    const uploadIds = photos.map((p: any) => p.upload_id).filter(Boolean);
    const authorIds = photos.map((p: any) => p.author_id).filter(Boolean);
    const classIds = photos.map((p: any) => p.class_id).filter(Boolean);
    const studentIds = photos.map((p: any) => p.student_id).filter(Boolean);

    // Fetch uploads
    const { data: uploads } = uploadIds.length > 0
      ? await supabaseAdmin
          .from('uploads')
          .select('id, bucket, path, filename, mime_type, size_bytes, width, height')
          .in('id', uploadIds)
      : { data: [] };

    // Fetch users
    const { data: users } = authorIds.length > 0
      ? await supabaseAdmin
          .from('users')
          .select('id, first_name, last_name')
          .in('id', authorIds)
      : { data: [] };

    // Fetch classes
    const { data: classes } = classIds.length > 0
      ? await supabaseAdmin
          .from('classes')
          .select('id, name')
          .in('id', classIds)
      : { data: [] };

    // Fetch students to get their user_ids
    const { data: studentsData } = studentIds.length > 0
      ? await supabaseAdmin
          .from('students')
          .select('id, user_id')
          .in('id', studentIds)
      : { data: [] };

    // Get user_ids from students
    const studentUserIds = (studentsData || [])
      .map((s: any) => s.user_id)
      .filter(Boolean);

    // Fetch student users
    const { data: studentUsers } = studentUserIds.length > 0
      ? await supabaseAdmin
          .from('users')
          .select('id, first_name, last_name')
          .in('id', studentUserIds)
      : { data: [] };

    // Create map of user_id -> user data
    const studentUsersMap = new Map((studentUsers || []).map((u: any) => [u.id, u]));

    // Transform students data to match expected format
    const students = (studentsData || []).map((s: any) => {
      const user = s.user_id ? studentUsersMap.get(s.user_id) : null;
      return {
        id: s.id,
        first_name: user?.first_name || null,
        last_name: user?.last_name || null,
      };
    });

    // Create lookup maps
    const uploadsMap = new Map((uploads || []).map((u: any) => [u.id, u]));
    const usersMap = new Map((users || []).map((u: any) => [u.id, u]));
    const classesMap = new Map((classes || []).map((c: any) => [c.id, c]));
    const studentsMap = new Map((students || []).map((s: any) => [s.id, s]));

    // Transform data to include public URLs and related data
    const photosWithUrls = await Promise.all(
      photos.map(async (photo: any) => {
        const upload = uploadsMap.get(photo.upload_id);
        let url: string | null = null;

        if (upload) {
          // Get public URL from storage
          const { data: urlData } = supabaseAdmin!.storage
            .from('photos')
            .getPublicUrl(upload.path);
          url = urlData?.publicUrl || null;
        }

        return {
          ...photo,
          url,
          uploads: upload || null,
          users: photo.author_id ? usersMap.get(photo.author_id) || null : null,
          classes: photo.class_id ? classesMap.get(photo.class_id) || null : null,
          students: photo.student_id ? studentsMap.get(photo.student_id) || null : null,
        };
      })
    );

    return NextResponse.json(
      { photos: photosWithUrls, count: photosWithUrls.length },
      { headers: getNoCacheHeaders() }
    );
  } catch (err: any) {
    if (err.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('Error in GET /api/photos:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Get authenticated user and orgId from server-side auth
    let user, orgId: string;
    try {
      const authContext = await getAuthUserWithOrg();
      user = authContext.user;
      orgId = authContext.orgId;
    } catch (err) {
      if (err instanceof MissingOrgIdError) {
        return mapAuthErrorToResponse(err);
      }
      const message = err instanceof Error ? err.message : 'Authentication required';
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    // Parse FormData
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const classId = formData.get('class_id') as string | null;
    const studentId = formData.get('student_id') as string | null;
    const caption = formData.get('caption') as string | null;
    const isPublic = formData.get('is_public') === 'true';
    
    // Use authenticated user's ID as authorId
    const authorId = user.id;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Validate file types and sizes
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: `File ${file.name} is not an image` }, { status: 400 });
      }
      if (file.size > maxFileSize) {
        return NextResponse.json({ error: `File ${file.name} is too large (max 10MB)` }, { status: 400 });
      }
    }

    // Process each file
    const uploadedPhotos = [];

    for (const file of files) {
      try {
        // Generate unique filename
        const fileExt = file.name.split('.').pop() || 'jpg';
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const fileName = `${timestamp}_${randomId}.${fileExt}`;
        const filePath = `${orgId}/${fileName}`;

        // Convert File to ArrayBuffer for upload
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('photos')
          .upload(filePath, buffer, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }

        // Get image dimensions (optional, can be done client-side or skipped)
        let width: number | null = null;
        let height: number | null = null;

        // Create uploads record
        const { data: uploadRecord, error: uploadRecordError } = await supabaseAdmin
          .from('uploads')
          .insert({
            org_id: orgId,
            bucket: 'photos',
            path: filePath,
            filename: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            width,
            height,
            created_by: authorId,
          })
          .select()
          .single();

        if (uploadRecordError || !uploadRecord) {
          console.error('Error creating upload record:', uploadRecordError);
          // Try to delete the uploaded file
          await supabaseAdmin.storage.from('photos').remove([filePath]);
          throw new Error(`Failed to create upload record for ${file.name}`);
        }

        // Create photos record
        const { data: photoRecord, error: photoRecordError } = await supabaseAdmin
          .from('photos')
          .insert({
            org_id: orgId,
            class_id: classId || null,
            student_id: studentId || null,
            upload_id: uploadRecord.id,
            author_id: authorId,
            caption: caption || null,
            is_public: isPublic,
          })
          .select()
          .single();

        if (photoRecordError || !photoRecord) {
          console.error('Error creating photo record:', photoRecordError);
          // Try to delete the uploaded file and upload record
          await supabaseAdmin.storage.from('photos').remove([filePath]);
          await supabaseAdmin.from('uploads').delete().eq('id', uploadRecord.id);
          throw new Error(`Failed to create photo record for ${file.name}`);
        }

        uploadedPhotos.push(photoRecord);
      } catch (fileError: any) {
        console.error(`Error processing file ${file.name}:`, fileError);
        // Continue with other files, but log the error
        // In production, you might want to collect all errors and return them
      }
    }

    if (uploadedPhotos.length === 0) {
      return NextResponse.json({ error: 'Failed to upload any photos' }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        photos: uploadedPhotos,
        count: uploadedPhotos.length,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err instanceof MissingOrgIdError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Error in POST /api/photos:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireServerAuth();

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get('photoId');

    if (!photoId) {
      return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 });
    }

    // Get photo record to verify ownership and get upload info
    const { data: photo, error: photoError } = await supabaseAdmin
      .from('photos')
      .select('id, org_id, upload_id')
      .eq('id', photoId)
      .is('deleted_at', null)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify user has access to this org
    const userOrgId = await getCurrentUserOrgId(user);
    if (userOrgId !== photo.org_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get upload record to get file path
    const { data: upload } = photo.upload_id
      ? await supabaseAdmin
          .from('uploads')
          .select('path')
          .eq('id', photo.upload_id)
          .single()
      : { data: null };

    // Soft delete the photo (set deleted_at)
    const { error: deleteError } = await supabaseAdmin
      .from('photos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', photoId);

    if (deleteError) {
      console.error('Error deleting photo:', deleteError);
      return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
    }

    // Optionally delete the file from storage (or keep it for recovery)
    // For now, we'll keep the file in storage but mark the photo as deleted
    // Uncomment below if you want to delete the file too:
    // if (upload?.path) {
    //   await supabaseAdmin.storage.from('photos').remove([upload.path]);
    // }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    if (err.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err instanceof MissingOrgIdError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Error in DELETE /api/photos:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

