import { z } from 'zod';
import { isoTimestampSchema, uuidSchema } from './primitives.js';

export const ORGANIZATION_NAME_MAX = 120;

export const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(
    (value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Use an IANA time zone such as Africa/Lagos.' },
  );

export const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/, 'Use a two-letter ISO country code such as NG.');

export const organizationSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  status: z.enum(['active', 'suspended']),
  timeZone: z.string(),
  country: z.string().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type Organization = z.infer<typeof organizationSchema>;

export const updateOrganizationRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(ORGANIZATION_NAME_MAX).optional(),
    timeZone: timeZoneSchema.optional(),
    country: countryCodeSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field.' });
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;

export const roleSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  rank: z.number().int(),
  permissions: z.array(z.string()),
  /** False when the caller lacks a permission this role carries, so it cannot be assigned. */
  assignable: z.boolean(),
});
export type RoleSummary = z.infer<typeof roleSchema>;

export const permissionSchema = z.object({
  key: z.string(),
  category: z.string(),
  description: z.string(),
});
