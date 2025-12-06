import { z } from 'zod';

import {
  classIdSchema,
  dateSchema,
  notesSchema,
  uuidSchema,
} from '@/lib/validation';

/**
 * Daily log kind enum schema
 */
export const dailyLogKindSchema = z.enum(['arrival', 'meal', 'sleep', 'activity', 'note'], {
  errorMap: () => ({ message: 'Invalid daily log kind. Must be one of: arrival, meal, sleep, activity, note' })
});

/**
 * Query parameters for GET /api/daily-logs
 */
export const getDailyLogsQuerySchema = z.object({
  classId: classIdSchema.optional(),
  date: dateSchema.optional(),
  kind: dailyLogKindSchema.optional(),
});

/**
 * Request body for POST /api/daily-logs
 */
export const postDailyLogBodySchema = z.object({
  class_id: classIdSchema.optional(),
  recorded_at: z.string().datetime().optional(),
  note: notesSchema,
  image: z.string().url().nullable().optional(),
  kind: dailyLogKindSchema.default('activity'),
  public: z.boolean().default(false),
  value: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

/**
 * Request body for PUT /api/daily-logs
 */
export const putDailyLogBodySchema = z.object({
  id: uuidSchema,
  class_id: classIdSchema.optional(),
  recorded_at: z.string().datetime().optional(),
  note: notesSchema.optional(),
  image: z.string().url().nullable().optional(),
  public: z.boolean().optional(),
  value: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

/**
 * Query parameters for DELETE /api/daily-logs
 */
export const deleteDailyLogQuerySchema = z.object({
  id: uuidSchema,
});

export type GetDailyLogsQueryParams = z.infer<typeof getDailyLogsQuerySchema>;
export type PostDailyLogBody = z.infer<typeof postDailyLogBodySchema>;
export type PutDailyLogBody = z.infer<typeof putDailyLogBodySchema>;
export type DeleteDailyLogQueryParams = z.infer<typeof deleteDailyLogQuerySchema>;

