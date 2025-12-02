import { z } from 'zod';
import {
  userIdSchema,
  nameSchema,
  codeSchema,
  classIdSchema,
} from '@/lib/validation';

/**
 * GET /api/classes query parameter schema
 */
export const getClassesQuerySchema = z.object({
  createdBy: userIdSchema.optional(),
});

/**
 * POST /api/classes body schema
 */
export const postClassBodySchema = z.object({
  name: nameSchema,
  code: codeSchema.optional(),
  created_by: userIdSchema,
  teacher_id: userIdSchema.optional(),
});

/**
 * PUT /api/classes body schema
 */
export const putClassBodySchema = z.object({
  id: classIdSchema,
  name: nameSchema.optional(),
  code: codeSchema,
  teacher_id: userIdSchema.optional(),
});

/**
 * DELETE /api/classes query parameter schema
 */
export const deleteClassQuerySchema = z.object({
  id: classIdSchema,
});

