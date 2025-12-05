import { z } from 'zod';

import { classIdSchema, userIdSchema, uuidSchema } from '@/lib/validation';

export const getAnnouncementsQuerySchema = z.object({
  id: uuidSchema.optional(),
  classId: classIdSchema.optional(),
  teacherClassIds: z.string().optional(), // comma-separated
  limit: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return 10;
      const num = Number(val);
      return Number.isNaN(num) ? 10 : num;
    },
    z.number(),
  ),
  userId: userIdSchema.optional(),
  userRole: z
    .enum(['guardian', 'teacher', 'principal', 'admin'])
    .optional(),
});

export type GetAnnouncementsQueryParams = z.infer<
  typeof getAnnouncementsQuerySchema
>;

/**
 * Create announcement schema
 */
export const createAnnouncementSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }).max(500, { message: 'Title must be 500 characters or less' }),
  body: z.string().min(1, { message: 'Body is required' }).max(5000, { message: 'Body must be 5000 characters or less' }),
  classId: classIdSchema.optional(),
});

/**
 * Update announcement schema
 */
export const updateAnnouncementSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }).max(500, { message: 'Title must be 500 characters or less' }),
  body: z.string().min(1, { message: 'Body is required' }).max(5000, { message: 'Body must be 5000 characters or less' }),
  classId: classIdSchema.optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;


