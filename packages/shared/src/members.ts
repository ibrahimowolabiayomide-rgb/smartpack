import { z } from 'zod';
import {
  emailSchema,
  isoTimestampSchema,
  pageQuerySchema,
  personNameSchema,
  roleKeySchema,
  tokenSchema,
  passwordSchema,
  uuidSchema,
} from './primitives.js';
import { loginPasswordSchema } from './primitives.js';
import { emailDeliveryStatusSchema } from './auth.js';

export const memberStatusSchema = z.enum(['active', 'suspended', 'removed']);

export const memberSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  email: z.string(),
  displayName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  emailVerified: z.boolean(),
  status: memberStatusSchema,
  role: z.object({ key: roleKeySchema, name: z.string() }),
  lastLoginAt: isoTimestampSchema.nullable(),
  joinedAt: isoTimestampSchema,
  suspendedAt: isoTimestampSchema.nullable(),
});
export type Member = z.infer<typeof memberSchema>;

export const listMembersQuerySchema = pageQuerySchema.extend({
  status: memberStatusSchema.optional(),
  role: roleKeySchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const updateMemberRequestSchema = z
  .object({
    firstName: personNameSchema.optional(),
    lastName: personNameSchema.optional(),
    displayName: personNameSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field.' });

export const changeRoleRequestSchema = z.object({ role: roleKeySchema });

export const invitationStatusSchema = z.enum(['pending', 'accepted', 'revoked', 'expired']);

export const invitationSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  role: z.object({ key: roleKeySchema, name: z.string() }),
  status: invitationStatusSchema,
  invitedBy: z.object({ id: uuidSchema, displayName: z.string() }),
  expiresAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
  lastSentAt: isoTimestampSchema,
  acceptedAt: isoTimestampSchema.nullable(),
  revokedAt: isoTimestampSchema.nullable(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const listInvitationsQuerySchema = pageQuerySchema.extend({
  status: invitationStatusSchema.optional(),
});

export const createInvitationRequestSchema = z.object({
  email: emailSchema,
  role: roleKeySchema,
});

export const invitationWithDeliverySchema = z.object({
  invitation: invitationSchema,
  emailDelivery: emailDeliveryStatusSchema,
});

export const previewInvitationRequestSchema = z.object({ token: tokenSchema });
export const invitationPreviewSchema = z.object({
  organizationName: z.string(),
  email: z.string(),
  roleName: z.string(),
  /** True when the address already has an account, so the form asks for the existing password. */
  accountExists: z.boolean(),
  expiresAt: isoTimestampSchema,
});

export const acceptInvitationRequestSchema = z.discriminatedUnion('accountExists', [
  z.object({
    accountExists: z.literal(false),
    token: tokenSchema,
    firstName: personNameSchema,
    lastName: personNameSchema,
    password: passwordSchema,
  }),
  z.object({
    accountExists: z.literal(true),
    token: tokenSchema,
    password: loginPasswordSchema,
  }),
]);
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;

export const invitationAcceptedSchema = z.object({
  organizationName: z.string(),
  email: z.string(),
});
