import { z } from 'zod';

/** Emails are compared case-insensitively; the normalised form is what uniqueness is enforced on. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const EMAIL_MAX_LENGTH = 254;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter an email address.')
  .max(EMAIL_MAX_LENGTH, 'Email address is too long.')
  .pipe(z.email('Enter a valid email address, such as name@company.com.'));

export const PASSWORD_MIN_LENGTH = 12;
/** Upper bound exists to stop oversized inputs from costing hashing time, not to limit security. */
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Length rules only. Whether a password is on the common-password list is checked on the server,
 * which keeps that list out of the browser bundle.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`);

/** A login password is only checked for presence and size: policy applies when it is created. */
export const loginPasswordSchema = z
  .string()
  .min(1, 'Enter your password.')
  .max(PASSWORD_MAX_LENGTH, 'Password is too long.');

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .max(80, 'Use at most 80 characters.');

export const uuidSchema = z.uuid();

export const isoTimestampSchema = z.iso.datetime({ offset: true });

/** Opaque one-time token as delivered by email. Base64url, 43 characters for 32 bytes. */
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'This link is not valid.');

export const roleKeySchema = z.enum([
  'owner',
  'admin',
  'operations_manager',
  'asset_manager',
  'supervisor',
  'worker',
  'auditor',
]);

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

export function cursorPageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
