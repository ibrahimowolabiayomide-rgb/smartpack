import { z } from 'zod';
import {
  emailSchema,
  isoTimestampSchema,
  loginPasswordSchema,
  passwordSchema,
  roleKeySchema,
  tokenSchema,
  uuidSchema,
} from './primitives.js';

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
  /** Needed only when one account belongs to several companies. */
  organizationSlug: z.string().trim().min(1).max(48).optional(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const organizationSummarySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  /** IANA zone used to display times for this company. */
  timeZone: z.string(),
});

export const currentUserSchema = z.object({
  user: z.object({
    id: uuidSchema,
    email: z.string(),
    displayName: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    emailVerified: z.boolean(),
    status: z.enum(['active', 'disabled']),
  }),
  organization: organizationSummarySchema,
  membership: z.object({
    id: uuidSchema,
    status: z.enum(['active', 'suspended', 'removed']),
    role: z.object({ key: roleKeySchema, name: z.string() }),
  }),
  permissions: z.array(z.string()),
  session: z.object({
    id: uuidSchema,
    createdAt: isoTimestampSchema,
    expiresAt: isoTimestampSchema,
  }),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const forgotPasswordRequestSchema = z.object({ email: emailSchema });
export const resetPasswordRequestSchema = z.object({
  token: tokenSchema,
  newPassword: passwordSchema,
});
export const changePasswordRequestSchema = z.object({
  currentPassword: loginPasswordSchema,
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordRequestSchema>;
export const verifyEmailRequestSchema = z.object({ token: tokenSchema });

export const sessionSummarySchema = z.object({
  id: uuidSchema,
  createdAt: isoTimestampSchema,
  lastActiveAt: isoTimestampSchema,
  expiresAt: isoTimestampSchema,
  userAgent: z.string().nullable(),
  current: z.boolean(),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const messageSchema = z.object({ message: z.string() });

export const emailDeliveryStatusSchema = z.enum(['sent', 'failed', 'not_configured']);
export type EmailDeliveryStatus = z.infer<typeof emailDeliveryStatusSchema>;
