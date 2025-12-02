import { z } from 'zod';

import { classIdSchema, studentIdSchema, uuidSchema } from '@/lib/validation';

export const getPhotosQuerySchema = z.object({
  classId: uuidSchema.optional(),
  studentId: studentIdSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export const deletePhotosQuerySchema = z.object({
  photoId: uuidSchema,
});

export type GetPhotosQueryParams = z.infer<typeof getPhotosQuerySchema>;
export type DeletePhotosQueryParams = z.infer<typeof deletePhotosQuerySchema>;

