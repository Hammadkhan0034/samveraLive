import { z } from 'zod';

import {
  attendanceStatusSchema,
  classIdSchema,
  dateSchema,
  notesSchema,
  studentIdSchema,
  uuidSchema,
} from '@/lib/validation';

/**
 * Query parameters for GET /api/attendance
 */
export const getAttendanceQuerySchema = z.object({
  classId: classIdSchema.optional(),
  studentId: studentIdSchema.optional(),
  date: dateSchema.optional(),
});


export const postAttendanceBodySchema = z.object({
  class_id: classIdSchema.optional(),
  student_id: studentIdSchema,
  date: dateSchema,
  status: attendanceStatusSchema.default('present'),
  notes: notesSchema,
});

/**
 * Request body for PUT /api/attendance
 */
export const putAttendanceBodySchema = z.object({
  id: uuidSchema,
  status: attendanceStatusSchema.optional(),
  notes: notesSchema,
});

/**
 * Query parameters for DELETE /api/attendance
 */
export const deleteAttendanceQuerySchema = z.object({
  id: uuidSchema,
});

export type GetAttendanceQueryParams = z.infer<typeof getAttendanceQuerySchema>;
export type PostAttendanceBody = z.infer<typeof postAttendanceBodySchema>;
export type PutAttendanceBody = z.infer<typeof putAttendanceBodySchema>;
export type DeleteAttendanceQueryParams = z.infer<typeof deleteAttendanceQuerySchema>;


