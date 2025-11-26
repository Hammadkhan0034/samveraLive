import { NextResponse } from 'next/server'

import { getNoCacheHeaders } from '@/lib/cacheConfig'
import { getAuthUserWithOrg, mapAuthErrorToResponse } from '@/lib/server-helpers'
import { validateBody, validateQuery } from '@/lib/validation'
import {
  deleteAttendanceQuerySchema,
  getAttendanceQuerySchema,
  postAttendanceBodySchema,
  putAttendanceBodySchema,
  type DeleteAttendanceQueryParams,
  type GetAttendanceQueryParams,
  type PostAttendanceBody,
  type PutAttendanceBody,
} from '@/lib/validation/attendance'
import {
  AttendanceServiceError,
  deleteAttendanceById,
  fetchAttendanceByFilters,
  upsertAttendance,
  updateAttendance,
} from '@/lib/services/attendance'

/**
 * Attendance API route
 *
 * This handler has been refactored to:
 * - Delegate Supabase access and domain logic to `lib/services/attendance`
 * - Centralize validation in `lib/validation/attendance`
 * - Tighten error handling and avoid leaking low-level error details
 * - Keep the public request/response surface and shapes compatible
 */

export async function GET(request: Request) {
  // Authenticate user and derive orgId from server-side context
  let orgId: string
  try {
    const { orgId: resolvedOrgId } = await getAuthUserWithOrg()
    orgId = resolvedOrgId
  } catch (err: unknown) {
    return mapAuthErrorToResponse(err)
  }

  const { searchParams } = new URL(request.url)
  const queryValidation = validateQuery<GetAttendanceQueryParams>(
    getAttendanceQuerySchema,
    searchParams,
  )
  if (!queryValidation.success) {
    return queryValidation.error
  }
  const { classId, studentId, date } = queryValidation.data

  try {
    const attendance = await fetchAttendanceByFilters({
      orgId,
      classId,
      studentId,
      date,
    })

    return NextResponse.json(
      {
        attendance,
        total: attendance.length,
      },
      {
        status: 200,
        headers: getNoCacheHeaders(),
      },
    )
  } catch (err: unknown) {
    console.error('Error fetching attendance records', err)
    const isServiceError = err instanceof AttendanceServiceError
    return NextResponse.json(
      {
        error: isServiceError
          ? 'Failed to fetch attendance'
          : 'Unexpected error while fetching attendance',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  // Authenticate user and derive orgId from server-side context
  let orgId: string
  let userId: string
  try {
    const { user, orgId: resolvedOrgId } = await getAuthUserWithOrg()
    userId = user.id
    orgId = resolvedOrgId
  } catch (err: unknown) {
    return mapAuthErrorToResponse(err)
  }

  const rawBody = await request.json()
  const bodyValidation = validateBody<PostAttendanceBody>(
    postAttendanceBodySchema,
    rawBody,
  )
  if (!bodyValidation.success) {
    return bodyValidation.error
  }

  try {
    const attendance = await upsertAttendance({
      orgId,
      userId,
      payload: bodyValidation.data,
    })

    return NextResponse.json(
      {
        attendance,
        message: 'Attendance saved successfully!',
      },
      { status: 201 },
    )
  } catch (err: unknown) {
    console.error('Error saving attendance record', err)
    const isServiceError = err instanceof AttendanceServiceError
    return NextResponse.json(
      {
        error: isServiceError
          ? 'Failed to save attendance'
          : 'Unexpected error while saving attendance',
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  // Authenticate user (used to ensure only authenticated users can update attendance)
  let userId: string
  try {
    const { user } = await getAuthUserWithOrg()
    userId = user.id
  } catch (err: unknown) {
    return mapAuthErrorToResponse(err)
  }

  const rawBody = await request.json()

  const bodyValidation = validateBody<PutAttendanceBody>(
    putAttendanceBodySchema,
    rawBody,
  )
  if (!bodyValidation.success) {
    return bodyValidation.error
  }

  try {
    const attendance = await updateAttendance({
      userId,
      payload: bodyValidation.data,
    })

    return NextResponse.json(
      {
        attendance,
        message: 'Attendance updated successfully!',
      },
      { status: 200 },
    )
  } catch (err: unknown) {
    console.error('Error updating attendance record', err)
    const isServiceError = err instanceof AttendanceServiceError
    return NextResponse.json(
      {
        error: isServiceError
          ? 'Failed to update attendance'
          : 'Unexpected error while updating attendance',
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  // Authenticate user and derive orgId to scope deletion
  let orgId: string
  try {
    const { orgId: resolvedOrgId } = await getAuthUserWithOrg()
    orgId = resolvedOrgId
  } catch (err: unknown) {
    return mapAuthErrorToResponse(err)
  }

  const { searchParams } = new URL(request.url)
  const queryValidation = validateQuery<DeleteAttendanceQueryParams>(
    deleteAttendanceQuerySchema,
    searchParams,
  )
  if (!queryValidation.success) {
    return queryValidation.error
  }

  const { id } = queryValidation.data

  try {
    await deleteAttendanceById({
      orgId,
      id,
    })

    return NextResponse.json(
      {
        message: 'Attendance deleted successfully!',
      },
      { status: 200 },
    )
  } catch (err: unknown) {
    console.error('Error deleting attendance record', err)
    const isServiceError = err instanceof AttendanceServiceError
    return NextResponse.json(
      {
        error: isServiceError
          ? 'Failed to delete attendance'
          : 'Unexpected error while deleting attendance',
      },
      { status: 500 },
    )
  }
}
