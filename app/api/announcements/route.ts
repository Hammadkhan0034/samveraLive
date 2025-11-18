import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getStableDataCacheHeaders } from '@/lib/cacheConfig'
import { requireServerAuth } from '@/lib/supabaseServer'
import { z } from 'zod'
import { validateQuery, validateBody, uuidSchema, classIdSchema, userIdSchema, titleSchema, notesSchema, orgIdSchema } from '@/lib/validation'

export async function GET(request: Request) {
  try {
    await requireServerAuth()
  } catch (authError: any) {
    if (authError.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    throw authError
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    // GET query parameter schema
    const getAnnouncementsQuerySchema = z.object({
      id: uuidSchema.optional(),
      classId: classIdSchema.optional(),
      teacherClassIds: z.string().optional(), // comma-separated
      limit: z.preprocess(
        (val) => {
          if (val === undefined || val === null) return 10;
          const num = Number(val);
          return isNaN(num) ? 10 : num;
        },
        z.number()
      ),
      userId: userIdSchema.optional(),
      userRole: z.enum(['parent', 'guardian', 'teacher', 'principal', 'admin']).optional(),
    });
    
    const queryValidation = validateQuery(getAnnouncementsQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { id, classId, teacherClassIds, limit: limitParam, userId, userRole } = queryValidation.data;
    
    // If id is provided, fetch single announcement
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('announcements')
        .select('id,title,body,created_at,author_id,class_id,classes(id,name)')
        .eq('id', id)
        .eq('is_public', true)
        .single()
      
      if (error || !data) {
        return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
      }
      
      const classData = Array.isArray(data.classes) && data.classes.length > 0 
        ? data.classes[0] 
        : (data.classes && !Array.isArray(data.classes) ? data.classes : null)
      
      const transformed = {
        id: data.id,
        title: data.title,
        body: data.body,
        created_at: data.created_at,
        author_id: data.author_id,
        class_id: data.class_id,
        class_name: classData?.name || null,
      }
      
      return NextResponse.json({ announcement: transformed }, {
        status: 200,
        headers: getStableDataCacheHeaders()
      })
    }
    
    const teacherClassIdsCsv = teacherClassIds // comma-separated class IDs for teacher
    const limit = (limitParam ?? 10) as number

    // For guardians: get their children's class IDs
    let guardianClassIds: string[] = []
    let isGuardian = false
    let principalIdsSet = new Set<string>() // For use in post-processing
    let finalTeacherIds: string[] = [] // For use in post-processing
    
    if (userId && (userRole === 'parent' || userRole === 'guardian')) {
      isGuardian = true
      try {
        // Get all students linked to this guardian
        const { data: relationships, error: relError } = await supabaseAdmin
          .from('guardian_students')
          .select('student_id')
          .eq('guardian_id', userId)
        
        if (!relError && relationships && relationships.length > 0) {
          const studentIds = relationships.map(r => r.student_id).filter(Boolean)
          
          if (studentIds.length > 0) {
            // Get class_ids for these students
            const { data: students, error: studentsError } = await supabaseAdmin
              .from('students')
              .select('class_id')
              .in('id', studentIds)
              .not('class_id', 'is', null)
            
            if (!studentsError && students) {
              guardianClassIds = students
                .map(s => s.class_id)
                .filter((id): id is string => !!id && typeof id === 'string')
                // Remove duplicates
                .filter((id, index, self) => self.indexOf(id) === index)
            }
          }
        }
      } catch (e) {
        console.error('Error fetching guardian class IDs:', e)
      }
    }

    // Include class name in query
    let query = supabaseAdmin
      .from('announcements')
      .select('id,title,body,created_at,author_id,class_id,classes(id,name)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    // For guardians: filter by their children's classes only
    if (isGuardian && guardianClassIds.length > 0) {
      // Show announcements for guardian's children's classes
      // Include: teacher announcements for those classes AND principal's org-wide announcements
      
      // Get teacher user IDs from multiple sources
      const teacherIdsSet = new Set<string>()
      
      // Method 1: Check users table with role = 'teacher'
      try {
        const { data: roleBasedTeachers } = await supabaseAdmin
          .from('users')
          .select('id')
          .in('role', ['teacher'])
        
        if (roleBasedTeachers) {
          roleBasedTeachers.forEach(u => {
            if (u.id) teacherIdsSet.add(u.id)
          })
        }
      } catch (e) {
        console.warn('Could not fetch teachers by role column:', e)
      }
      
      // Method 2: Check class_memberships with membership_role = 'teacher'
      try {
        const { data: membershipTeachers } = await supabaseAdmin
          .from('class_memberships')
          .select('user_id')
          .eq('membership_role', 'teacher')
        
        if (membershipTeachers) {
          membershipTeachers.forEach(m => {
            if (m.user_id) teacherIdsSet.add(m.user_id)
          })
        }
      } catch (e) {
        console.warn('Could not fetch teachers from class_memberships:', e)
      }
      
      // Method 3: Check users with metadata->>roles containing 'teacher'
      try {
        const { data: metadataTeachers } = await supabaseAdmin
          .from('users')
          .select('id')
          .contains('metadata', { roles: ['teacher'] })
        
        if (metadataTeachers) {
          metadataTeachers.forEach(u => {
            if (u.id) teacherIdsSet.add(u.id)
          })
        }
      } catch (e) {
        // Try alternative JSON query
        try {
          const { data: altTeachers } = await supabaseAdmin
            .from('users')
            .select('id, metadata')
          
          if (altTeachers) {
            altTeachers.forEach(u => {
              const roles = (u.metadata as any)?.roles
              if (Array.isArray(roles) && roles.includes('teacher') && u.id) {
                teacherIdsSet.add(u.id)
              }
            })
          }
        } catch (e2) {
          console.warn('Could not fetch teachers from metadata:', e2)
        }
      }
      
      const teacherIds = Array.from(teacherIdsSet)
      
      // Get principal user IDs to include their org-wide announcements
      // Check multiple sources to identify principals
      principalIdsSet = new Set<string>()
      
      // Method 1: Check users table with role = 'principal' or 'admin'
      try {
        const { data: roleBasedPrincipals } = await supabaseAdmin
          .from('users')
          .select('id')
          .in('role', ['principal', 'admin'])
        
        if (roleBasedPrincipals) {
          roleBasedPrincipals.forEach(p => {
            if (p.id) principalIdsSet.add(p.id)
          })
        }
      } catch (e) {
        console.warn('Could not fetch principals by role column:', e)
      }
      
      // Method 2: Check users with metadata->>activeRole = 'principal' or metadata->>roles containing 'principal'
      try {
        const { data: metadataPrincipals } = await supabaseAdmin
          .from('users')
          .select('id, metadata')
        
        if (metadataPrincipals) {
          metadataPrincipals.forEach(u => {
            const metadata = u.metadata as any
            const activeRole = metadata?.activeRole
            const roles = metadata?.roles
            if ((activeRole === 'principal' || activeRole === 'admin') && u.id) {
              principalIdsSet.add(u.id)
            } else if (Array.isArray(roles) && (roles.includes('principal') || roles.includes('admin')) && u.id) {
              principalIdsSet.add(u.id)
            }
          })
        }
      } catch (e) {
        console.warn('Could not fetch principals from metadata:', e)
      }
      
      // Filter out principal IDs from teacher IDs (for class-specific filtering)
      finalTeacherIds = teacherIds.filter(id => !principalIdsSet.has(id))
      
      // For guardians: we need to fetch and filter in post-processing
      // Because Supabase OR syntax is complex for this case
      // We'll fetch all relevant announcements and filter them
      const principalIds = Array.from(principalIdsSet)
      
      // Always fetch org-wide announcements (for principals) and class-specific announcements
      // We'll filter in post-processing
      // Fetch: org-wide announcements OR class-specific announcements for guardian's children
      if (guardianClassIds.length > 0) {
        // Fetch both org-wide and class-specific
        query = query.or(`class_id.in.(${guardianClassIds.join(',')}),class_id.is.null`)
      } else {
        // If no class IDs, still fetch org-wide announcements (principal announcements)
        // This ensures parents see principal announcements even if they have no linked students
        query = query.is('class_id', null)
      }
    } else if (userRole === 'principal' || userRole === 'admin') {
      // For principals: only show org-wide announcements (class_id is null) OR their own announcements
      // Exclude teacher's class-specific announcements
      // Query: org-wide (class_id is null) OR principal's own (author_id = userId)
      query = query.or(`and(class_id.is.null),and(author_id.eq.${userId})`)
    } else if (userRole === 'teacher') {
      // For teachers: show principal's org-wide announcements AND class-specific announcements for ALL their assigned classes
      // Principal announcements are org-wide (class_id is null) and show to everyone
      const teacherClassIds = teacherClassIdsCsv 
        ? teacherClassIdsCsv.split(',').map(s => s.trim()).filter(Boolean)
        : (classId ? [classId] : []);
      
      if (teacherClassIds.length > 0) {
        // Show org-wide announcements OR announcements for any of the teacher's assigned classes
        query = query.or(`class_id.is.null,class_id.in.(${teacherClassIds.join(',')})`)
      } else if (classId) {
        query = query.or(`class_id.is.null,class_id.eq.${classId}`)
      } else {
        // If no classId, show org-wide announcements only (principal announcements)
        query = query.is('class_id', null)
      }
    } else if (classId) {
      // Regular filtering for others with classId
      // Show: org-wide announcements (class_id is null) OR class-specific announcements
      // Principal announcements are org-wide and show to everyone
      query = query.or(`class_id.is.null,class_id.eq.${classId}`)
    } else {
      // Default: show org-wide announcements only (principal announcements)
      // Principal announcements are org-wide and show to everyone
      query = query.is('class_id', null)
    }

    let { data, error } = await query
    
    // Post-process for guardians: filter to show only teacher class announcements + principal org-wide
    if (!error && data && isGuardian) {
      const principalIds = Array.from(principalIdsSet)
      
      console.log('🔍 Guardian filtering:', {
        totalAnnouncements: data.length,
        principalIdsCount: principalIds.length,
        guardianClassIdsCount: guardianClassIds.length,
        finalTeacherIdsCount: finalTeacherIds.length,
        principalIds: principalIds.slice(0, 5) // Log first 5 for debugging
      })
      
      data = data.filter((ann: any) => {
        // Always include principal's org-wide announcements (class_id is null AND author is principal)
        // This is the key fix: show ALL org-wide announcements, not just those by identified principals
        // Because principal identification might miss some, we show all org-wide announcements
        if (!ann.class_id) {
          // If it's org-wide and author is in principalIds, definitely include
          if (principalIds.length > 0 && principalIds.includes(ann.author_id)) {
            return true
          }
          // Also include org-wide announcements even if we couldn't identify the author as principal
          // This is a safety net - org-wide announcements should be visible to all
          // (We'll let the main query filter handle this, but be permissive here)
          return true
        }
        // Include teacher announcements for guardian's children's classes (if any)
        if (guardianClassIds.length > 0 && ann.class_id) {
          if (guardianClassIds.includes(ann.class_id) && finalTeacherIds.length > 0 && finalTeacherIds.includes(ann.author_id)) {
            return true
          }
        }
        // Exclude everything else
        return false
      })
      
      // If no guardian class IDs but we have principal announcements, show those
      if (guardianClassIds.length === 0) {
        // Show all org-wide announcements (principal announcements)
        data = data.filter((ann: any) => {
          return !ann.class_id
        })
      }
      
      console.log('✅ Guardian filtering result:', {
        filteredAnnouncements: data.length,
        orgWideCount: data.filter((a: any) => !a.class_id).length,
        classSpecificCount: data.filter((a: any) => a.class_id).length
      })
    }
    
    // Post-process for principals: filter out teacher's class-specific announcements
    if (!error && data && userId && (userRole === 'principal' || userRole === 'admin')) {
      const teacherIdsSet = new Set<string>()
      
      // Get teacher IDs from multiple sources
      try {
        const { data: membershipTeachers } = await supabaseAdmin
          .from('class_memberships')
          .select('user_id')
          .eq('membership_role', 'teacher')
        
        if (membershipTeachers) {
          membershipTeachers.forEach(m => {
            if (m.user_id) teacherIdsSet.add(m.user_id)
          })
        }
      } catch (e) {
        console.warn('Could not fetch teachers from class_memberships:', e)
      }
      
      try {
        const { data: roleBasedTeachers } = await supabaseAdmin
          .from('users')
          .select('id')
          .in('role', ['teacher'])
        
        if (roleBasedTeachers) {
          roleBasedTeachers.forEach(u => {
            if (u.id) teacherIdsSet.add(u.id)
          })
        }
      } catch (e) {
        console.warn('Could not fetch teachers by role:', e)
      }
      
      const teacherIds = Array.from(teacherIdsSet)
      
      // Filter: keep only org-wide (class_id is null) OR principal's own announcements
      // Exclude teacher's class-specific announcements (class_id is not null AND author is teacher)
      data = data.filter((ann: any) => {
        // Keep org-wide announcements (visible to all)
        if (!ann.class_id) return true
        // Keep principal's own announcements
        if (ann.author_id === userId) return true
        // Exclude teacher's class-specific announcements
        if (teacherIds.length > 0 && teacherIds.includes(ann.author_id)) {
          return false // Teacher's class-specific announcement - exclude
        }
        // Keep other non-teacher announcements (if any)
        return true
      })
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform data to include class name
    const transformedData = (data || []).map((ann: any) => {
      const classData = Array.isArray(ann.classes) && ann.classes.length > 0 
        ? ann.classes[0] 
        : (ann.classes && !Array.isArray(ann.classes) ? ann.classes : null)
      
      return {
        id: ann.id,
        title: ann.title,
        body: ann.body,
        created_at: ann.created_at,
        author_id: ann.author_id,
        class_id: ann.class_id,
        class_name: classData?.name || null,
      }
    })

    return NextResponse.json({ announcements: transformedData }, {
      status: 200,
      headers: getStableDataCacheHeaders()
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}


