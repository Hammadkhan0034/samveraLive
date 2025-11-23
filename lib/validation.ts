import { z } from 'zod';
import { NextResponse } from 'next/server';

// ============================================================================
// Common Validation Schemas
// ============================================================================

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

/**
 * Email validation schema
 */
export const emailSchema = z.string().email({ message: 'Invalid email format' });

/**
 * Date validation schema (ISO date string YYYY-MM-DD)
 */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Date must be in YYYY-MM-DD format'
});

/**
 * ISO datetime validation schema
 */
export const isoDateTimeSchema = z.string().datetime({ message: 'Invalid ISO datetime format' });

/**
 * Future date validation (for expires_at, etc.)
 */
export const futureDateSchema = isoDateTimeSchema.refine(
  (date) => new Date(date) > new Date(),
  { message: 'Date must be in the future' }
);

/**
 * Student age validation (0-18 years)
 */
export const studentDobSchema = z.string().refine(
  (dob) => {
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return false;
    
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
      ? age - 1 
      : age;
    
    return actualAge >= 0 && actualAge <= 18;
  },
  { message: 'Student age must be between 0 and 18 years old' }
);

/**
 * Barngildi validation (0.5 to 1.9)
 */
export const barngildiSchema = z.number()
  .min(0.5, { message: 'Barngildi must be at least 0.5' })
  .max(1.9, { message: 'Barngildi must be at most 1.9' })
  .or(z.string().transform((val) => {
    const n = Number(val);
    return isNaN(n) ? 0.5 : Math.min(1.9, Math.max(0.5, Number(n.toFixed(1))));
  }));

/**
 * Positive number schema
 */
export const positiveNumberSchema = z.number().positive({ message: 'Must be a positive number' });

/**
 * Non-negative integer schema
 */
export const nonNegativeIntSchema = z.number().int().nonnegative({ message: 'Must be a non-negative integer' });

// ============================================================================
// Enum Schemas
// ============================================================================

/**
 * Role enum
 */
export const roleSchema = z.enum(['admin', 'principal', 'teacher', 'guardian', 'parent', 'student'], {
  errorMap: () => ({ message: 'Invalid role. Must be one of: admin, principal, teacher, guardian, parent, student' })
});

/**
 * Student language enum
 */
export const studentLanguageSchema = z.enum(['english', 'icelandic', 'en', 'is'], {
  errorMap: () => ({ message: 'Invalid language. Must be one of: english, icelandic, en, is' })
}).transform((val) => {
  // Normalize to full names
  if (val === 'en') return 'english';
  if (val === 'is') return 'icelandic';
  return val;
});

/**
 * Gender enum
 */
export const genderSchema = z.enum(['male', 'female', 'other', 'unknown'], {
  errorMap: () => ({ message: 'Invalid gender. Must be one of: male, female, other, unknown' })
}).or(z.string().toLowerCase().transform((val) => {
  // Normalize to lowercase
  const normalized = val.toLowerCase();
  return ['male', 'female', 'other', 'unknown'].includes(normalized) ? normalized : 'unknown';
}));

/**
 * Attendance status enum
 */
export const attendanceStatusSchema = z.enum(['present', 'absent', 'late', 'excused'], {
  errorMap: () => ({ message: 'Invalid status. Must be one of: present, absent, late, excused' })
});

/**
 * Thread type enum (for messages)
 */
export const threadTypeSchema = z.enum(['dm', 'class', 'individual', 'group', 'announcement'], {
  errorMap: () => ({ message: 'Invalid thread type. Must be one of: dm, class, individual, group, announcement' })
});

// ============================================================================
// Common Field Schemas
// ============================================================================

/**
 * Organization ID schema
 */
export const orgIdSchema = uuidSchema;

/**
 * User ID schema
 */
export const userIdSchema = uuidSchema;

/**
 * Class ID schema (optional UUID)
 */
export const classIdSchema = uuidSchema.nullable().or(z.string().transform((val) => {
  if (!val || val.trim() === '') return null;
  return val;
}));

/**
 * Student ID schema
 */
export const studentIdSchema = uuidSchema;

/**
 * Story ID schema
 */
export const storyIdSchema = uuidSchema;

/**
 * Name schemas
 */
export const firstNameSchema = z.string().min(1, { message: 'First name is required' }).max(100, { message: 'First name must be 100 characters or less' });
export const lastNameSchema = z.string().max(100, { message: 'Last name must be 100 characters or less' }).nullable().optional();
export const nameSchema = z.string().min(1, { message: 'Name is required' }).max(200, { message: 'Name must be 200 characters or less' });

/**
 * Title and caption schemas
 */
export const titleSchema = z.string().max(500, { message: 'Title must be 500 characters or less' }).nullable().optional();
export const captionSchema = z.string().max(2000, { message: 'Caption must be 2000 characters or less' }).nullable().optional();

/**
 * Phone schema
 */
export const phoneSchema = z.string().max(50, { message: 'Phone must be 50 characters or less' }).nullable().optional();

/**
 * Address schema
 */
export const addressSchema = z.string().max(500, { message: 'Address must be 500 characters or less' }).nullable().optional();

/**
 * SSN schema
 */
export const ssnSchema = z.string().max(50, { message: 'SSN must be 50 characters or less' }).nullable().optional();

/**
 * Notes/Text fields
 */
export const notesSchema = z.string().max(5000, { message: 'Notes must be 5000 characters or less' }).nullable().optional();
export const medicalNotesSchema = notesSchema;
export const allergiesSchema = notesSchema;
export const emergencyContactSchema = notesSchema;

/**
 * Code schema (for class codes, etc.)
 */
export const codeSchema = z.string().max(50, { message: 'Code must be 50 characters or less' }).nullable().optional();

// ============================================================================
// Event Schemas
// ============================================================================

/**
 * Event title schema
 */
export const eventTitleSchema = z.string().min(1, { message: 'Event title is required' }).max(500, { message: 'Event title must be 500 characters or less' });

/**
 * Event description schema
 */
export const eventDescriptionSchema = z.string().max(5000, { message: 'Event description must be 5000 characters or less' }).nullable().optional();

/**
 * Event location schema
 */
export const eventLocationSchema = z.string().max(200, { message: 'Event location must be 200 characters or less' }).nullable().optional();

/**
 * Event start date/time schema (ISO datetime)
 */
export const eventStartAtSchema = isoDateTimeSchema;

/**
 * Event end date/time schema (ISO datetime, optional, must be after start_at)
 */
export const eventEndAtSchema = isoDateTimeSchema.nullable().optional();

/**
 * Create event schema
 */
export const createEventSchema = z.object({
  org_id: orgIdSchema,
  class_id: classIdSchema.optional(),
  title: eventTitleSchema,
  description: eventDescriptionSchema,
  start_at: eventStartAtSchema,
  end_at: eventEndAtSchema,
  location: eventLocationSchema,
}).refine(
  (data) => {
    // If end_at is provided, it must be after start_at
    if (data.end_at) {
      return new Date(data.end_at) >= new Date(data.start_at);
    }
    return true;
  },
  { message: 'End date must be after or equal to start date', path: ['end_at'] }
);

/**
 * Update event schema
 */
export const updateEventSchema = z.object({
  title: eventTitleSchema.optional(),
  description: eventDescriptionSchema,
  start_at: eventStartAtSchema.optional(),
  end_at: eventEndAtSchema,
  location: eventLocationSchema,
  class_id: classIdSchema.optional(),
}).refine(
  (data) => {
    // If both start_at and end_at are provided, end_at must be after start_at
    if (data.start_at && data.end_at) {
      return new Date(data.end_at) >= new Date(data.start_at);
    }
    // If only end_at is provided, we need to check against existing start_at
    // This will be validated in the server action
    return true;
  },
  { message: 'End date must be after or equal to start date', path: ['end_at'] }
);

// ============================================================================
// Health Log Schemas
// ============================================================================

/**
 * Health log type enum schema
 */
export const healthLogTypeSchema = z.enum([
  'diaper_wet',
  'diaper_dirty',
  'diaper_mixed',
  'temperature',
  'medication',
  'nap',
  'symptom',
  'injury',
  'meal',
  'other'
], {
  errorMap: () => ({ message: 'Invalid health log type' })
});

/**
 * Temperature schema (30-45 Celsius range)
 */
export const temperatureSchema = z.number()
  .min(30, { message: 'Temperature must be at least 30°C' })
  .max(45, { message: 'Temperature must be at most 45°C' })
  .nullable()
  .optional();

/**
 * Severity schema (1-5 range)
 */
export const severitySchema = z.number()
  .int({ message: 'Severity must be an integer' })
  .min(1, { message: 'Severity must be at least 1' })
  .max(5, { message: 'Severity must be at most 5' })
  .nullable()
  .optional();

/**
 * JSONB data schema (flexible object)
 */
export const healthLogDataSchema = z.record(z.unknown()).default({}).or(z.object({}).default({}));

/**
 * Create health log schema
 */
export const createHealthLogSchema = z.object({
  org_id: orgIdSchema,
  class_id: classIdSchema.optional(),
  student_id: studentIdSchema,
  type: healthLogTypeSchema,
  recorded_at: isoDateTimeSchema,
  temperature_celsius: temperatureSchema,
  data: healthLogDataSchema.optional(),
  notes: notesSchema,
  severity: severitySchema,
  recorded_by: userIdSchema,
});

/**
 * Update health log schema
 */
export const updateHealthLogSchema = z.object({
  id: uuidSchema,
  student_id: studentIdSchema.optional(),
  type: healthLogTypeSchema.optional(),
  recorded_at: isoDateTimeSchema.optional(),
  temperature_celsius: temperatureSchema,
  data: healthLogDataSchema.optional(),
  notes: notesSchema,
  severity: severitySchema,
});

// ============================================================================
// Array Schemas
// ============================================================================

/**
 * Array of UUIDs
 */
export const uuidArraySchema = z.array(uuidSchema).default([]);

/**
 * Array of guardian IDs
 */
export const guardianIdsSchema = uuidArraySchema;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format Zod error for API response
 */
export function formatZodError(error: z.ZodError): string {
  const errors = error.errors.map((err) => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
  return errors.join('; ');
}

/**
 * Validate and parse request body with Zod schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: NextResponse } {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', formatZodError(error));
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Validation failed', details: formatZodError(error) },
          { status: 400 }
        )
      };
    }
    throw error;
  }
}

/**
 * Validate and parse query parameters with Zod schema
 */
export function validateQuery<T>(schema: z.ZodSchema<T>, searchParams: URLSearchParams): { success: true; data: T } | { success: false; error: NextResponse } {
  try {
    // Convert URLSearchParams to object
    const params: Record<string, string | null> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Query validation error:', formatZodError(error));
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Query validation failed', details: formatZodError(error) },
          { status: 400 }
        )
      };
    }
    throw error;
  }
}

/**
 * Validate and parse path parameters with Zod schema
 */
export function validateParams<T>(schema: z.ZodSchema<T>, params: Record<string, string>): { success: true; data: T } | { success: false; error: NextResponse } {
  try {
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Path parameter validation error:', formatZodError(error));
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Path parameter validation failed', details: formatZodError(error) },
          { status: 400 }
        )
      };
    }
    throw error;
  }
}

/**
 * Safe parse (doesn't throw, returns result object)
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): z.SafeParseReturnType<unknown, T> {
  return schema.safeParse(data);
}

