/**
 * Client-side validation utilities using Zod schemas
 * These helpers provide user-friendly validation feedback in forms
 */

import { z } from 'zod';
import {
  firstNameSchema,
  lastNameSchema,
  emailSchema,
  phoneSchema,
  orgIdSchema,
} from '@/lib/validation';
import { postOrgBodySchema, putOrgBodySchema, putMyOrgBodySchema } from '@/lib/validation/orgs';

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

/**
 * Validate first name using Zod schema
 */
export function validateFirstName(firstName: string | undefined): ValidationResult {
  if (!firstName || firstName.trim() === '') {
    return { valid: false, error: 'First name is required' };
  }
  
  const result = firstNameSchema.safeParse(firstName.trim());
  if (!result.success) {
    return { valid: false, error: result.error.errors[0]?.message || 'Invalid first name' };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate last name using Zod schema (optional)
 */
export function validateLastName(lastName: string | undefined): ValidationResult {
  if (!lastName || lastName.trim() === '') {
    return { valid: true, error: null }; // Last name is optional
  }
  
  const result = lastNameSchema.safeParse(lastName.trim());
  if (!result.success) {
    return { valid: false, error: result.error.errors[0]?.message || 'Invalid last name' };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate email using Zod schema (optional)
 */
export function validateEmail(email: string | undefined): ValidationResult {
  if (!email || email.trim() === '') {
    return { valid: true, error: null }; // Email is optional for some forms
  }
  
  const result = emailSchema.safeParse(email.trim());
  if (!result.success) {
    return { valid: false, error: result.error.errors[0]?.message || 'Invalid email format' };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate phone number using Zod schema (optional)
 * Phone must match database constraint: ^\+?[1-9]\d{1,14}$ with length 7-15
 */
export function validatePhoneNumber(phone: string | undefined): ValidationResult {
  if (!phone || phone.trim() === '') {
    return { valid: true, error: null }; // Phone is optional
  }
  
  const trimmedPhone = phone.trim();
  const length = trimmedPhone.length;
  
  // Check length constraint
  if (length < 7 || length > 15) {
    return {
      valid: false,
      error: 'Phone number must be between 7 and 15 characters'
    };
  }
  
  // Check format: optional +, first digit 1-9, then 1-14 more digits
  // Database constraint: ^\+?[1-9]\d{1,14}$
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(trimmedPhone)) {
    return {
      valid: false,
      error: 'Phone number must be in international format: optional + sign followed by 7-15 digits (first digit cannot be 0). Examples: +1234567890 or 1234567890'
    };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate organization ID using Zod schema
 */
export function validateOrg(orgId: string | undefined): ValidationResult {
  if (!orgId || orgId.trim() === '') {
    return { valid: false, error: 'Organization is required' };
  }
  
  const result = orgIdSchema.safeParse(orgId.trim());
  if (!result.success) {
    return { valid: false, error: result.error.errors[0]?.message || 'Invalid organization' };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate slug format: lowercase letters, numbers, and hyphens only
 * Must match the regex pattern from postOrgBodySchema
 */
export function validateSlug(slug: string): boolean {
  if (!slug || slug.trim() === '') return false;
  
  // Use the same validation as postOrgBodySchema
  const slugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);
  return slugSchema.safeParse(slug.trim()).success;
}

/**
 * Validate organization form data using Zod schema
 */
export function validateOrgForm(data: {
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  timezone: string;
  type?: string;
  total_area?: string;
  play_area?: string;
  square_meters_per_student?: string;
  maximum_allowed_students?: string;
  id?: string;
}): ValidationResult {
  try {
    if (data.id) {
      // Edit mode with id - use putOrgBodySchema (for admin editing with id)
      putOrgBodySchema.parse({
        id: data.id,
        name: data.name,
        slug: data.slug,
        email: data.email,
        phone: data.phone,
        website: data.website,
        address: data.address,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code,
        timezone: data.timezone,
        type: data.type,
        total_area: data.total_area,
        play_area: data.play_area,
        square_meters_per_student: data.square_meters_per_student,
        maximum_allowed_students: data.maximum_allowed_students,
      });
    } else {
      // Create mode or principal editing own org (no id in body) - try putMyOrgBodySchema first, then postOrgBodySchema
      // For principal's own org updates, use putMyOrgBodySchema (no id required)
      try {
        putMyOrgBodySchema.parse({
          name: data.name,
          slug: data.slug,
          email: data.email,
          phone: data.phone,
          website: data.website,
          address: data.address,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
          timezone: data.timezone,
          type: data.type,
          total_area: data.total_area,
          play_area: data.play_area,
          square_meters_per_student: data.square_meters_per_student,
          maximum_allowed_students: data.maximum_allowed_students,
        });
      } catch {
        // Fallback to postOrgBodySchema for create mode
        postOrgBodySchema.parse({
          name: data.name,
          slug: data.slug,
          email: data.email,
          phone: data.phone,
          website: data.website,
          address: data.address,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
          timezone: data.timezone,
          type: data.type,
          total_area: data.total_area,
          play_area: data.play_area,
          square_meters_per_student: data.square_meters_per_student,
          maximum_allowed_students: data.maximum_allowed_students,
        });
      }
    }
    return { valid: true, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Find the first error and provide a clear message
      const firstError = error.errors[0];
      if (firstError) {
        // If the error has a custom message, use it
        if (firstError.message && firstError.message !== 'Required') {
          return {
            valid: false,
            error: firstError.message
          };
        }
        // Otherwise, create a descriptive message from the path
        const fieldName = firstError.path.join('.');
        const fieldLabel = fieldName
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return {
          valid: false,
          error: `${fieldLabel} is required`
        };
      }
      return {
        valid: false,
        error: 'Validation failed: Please fill in all required fields'
      };
    }
    return { valid: false, error: 'Validation failed' };
  }
}
