import { z } from 'zod';

import {
  classIdSchema,
  dateSchema,
  notesSchema,
  userIdSchema,
  uuidSchema,
} from '@/lib/validation';

export const getMenusQuerySchema = z.object({
  classId: classIdSchema.nullable().optional(),
  day: dateSchema.optional(),
});

export const postMenuBodySchema = z.object({
  class_id: classIdSchema.optional(),
  day: dateSchema,
  breakfast: z.string().max(1000).nullable().optional(),
  lunch: z.string().max(1000).nullable().optional(),
  snack: z.string().max(1000).nullable().optional(),
  notes: notesSchema,
  is_public: z.boolean().default(true),
  created_by: userIdSchema.optional(),
});

export const putMenuBodySchema = z.object({
  id: uuidSchema,
  breakfast: z.string().max(1000).nullable().optional(),
  lunch: z.string().max(1000).nullable().optional(),
  snack: z.string().max(1000).nullable().optional(),
  notes: notesSchema,
  is_public: z.boolean().optional(),
});

export const deleteMenuQuerySchema = z.object({
  id: uuidSchema,
});

export type GetMenusQueryParams = z.infer<typeof getMenusQuerySchema>;
export type PostMenuBody = z.infer<typeof postMenuBodySchema>;
export type PutMenuBody = z.infer<typeof putMenuBodySchema>;
export type DeleteMenuQueryParams = z.infer<typeof deleteMenuQuerySchema>;


