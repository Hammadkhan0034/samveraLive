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
    .enum(['parent', 'guardian', 'teacher', 'principal', 'admin'])
    .optional(),
});

export type GetAnnouncementsQueryParams = z.infer<
  typeof getAnnouncementsQuerySchema
>;


