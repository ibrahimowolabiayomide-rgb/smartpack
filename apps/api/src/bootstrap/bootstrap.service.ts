import {
  countryCodeSchema,
  emailSchema,
  normalizeEmail,
  personNameSchema,
  timeZoneSchema,
} from '@smartpack/shared';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../database/db-types.js';
import { auditLogs, memberships, organizations, roles, users } from '../database/schema/index.js';
import type { PasswordHasher } from '../security/password-hasher.js';
import { checkPasswordPolicy } from '../security/password-policy.js';

/** Arbitrary constant: serialises concurrent bootstrap runs on the same database. */
const BOOTSTRAP_LOCK_KEY = 7_262_026_001;

export class BootstrapError extends Error {
  constructor(
    readonly reason:
      'invalid_input' | 'already_provisioned' | 'owner_role_missing' | 'email_in_use',
    message: string,
  ) {
    super(message);
    this.name = 'BootstrapError';
  }
}

export interface BootstrapInput {
  organizationName: string;
  organizationSlug?: string;
  timeZone?: string;
  country?: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  password: string;
  /**
   * The operator's attestation that they control this mailbox. Without it the owner must complete
   * email verification after the first sign-in.
   */
  emailVerified?: boolean;
  /** For automated tests only; the CLI never sets it. */
  allowAdditionalOrganization?: boolean;
}

export interface BootstrapResult {
  organizationId: string;
  organizationSlug: string;
  ownerUserId: string;
  ownerEmail: string;
}

export function slugFromName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lower-case letters, digits and single hyphens.')
  .min(2)
  .max(48);

const inputSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  organizationSlug: slugSchema.optional(),
  timeZone: timeZoneSchema.optional(),
  country: countryCodeSchema.optional(),
  ownerEmail: emailSchema,
  ownerFirstName: personNameSchema,
  ownerLastName: personNameSchema,
});

/**
 * Creates the first company and its Owner. This is the ONLY way an organization or an Owner
 * comes into existence in this phase: there is no public registration endpoint.
 *
 * Safeguards: it refuses when any organization already exists (checked under an advisory lock, so
 * two concurrent runs cannot both succeed); the password is never defaulted and never logged; the
 * password policy is enforced; and the run is recorded as a `system.bootstrap` audit event.
 */
export async function provisionFirstOwner(
  db: Database,
  hasher: PasswordHasher,
  input: BootstrapInput,
): Promise<BootstrapResult> {
  const parsed = inputSchema.safeParse({
    organizationName: input.organizationName,
    organizationSlug: input.organizationSlug,
    timeZone: input.timeZone,
    country: input.country,
    ownerEmail: input.ownerEmail,
    ownerFirstName: input.ownerFirstName,
    ownerLastName: input.ownerLastName,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new BootstrapError(
      'invalid_input',
      `${first?.path.join('.') ?? 'input'}: ${first?.message ?? 'invalid'}`,
    );
  }
  const data = parsed.data;
  const slug = data.organizationSlug ?? slugFromName(data.organizationName);
  if (!slugSchema.safeParse(slug).success) {
    throw new BootstrapError(
      'invalid_input',
      'Could not derive a valid slug from the organization name. Pass --organization-slug.',
    );
  }
  const emailNormalized = normalizeEmail(data.ownerEmail);
  const policy = checkPasswordPolicy(input.password, {
    email: data.ownerEmail,
    names: [data.ownerFirstName, data.ownerLastName, data.organizationName],
  });
  if (!policy.ok) throw new BootstrapError('invalid_input', `password: ${policy.message}`);

  const passwordHash = await hasher.hash(input.password);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`);

    if (!input.allowAdditionalOrganization) {
      const [existing] = await tx.select({ id: organizations.id }).from(organizations).limit(1);
      if (existing) {
        throw new BootstrapError(
          'already_provisioned',
          'An organization already exists. Bootstrap only runs on an empty installation; ' +
            'add people through invitations instead.',
        );
      }
    }
    const [taken] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.emailNormalized, emailNormalized))
      .limit(1);
    if (taken)
      throw new BootstrapError('email_in_use', 'An account with that email already exists.');

    const [ownerRole] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.key, 'owner'))
      .limit(1);
    if (!ownerRole) {
      throw new BootstrapError(
        'owner_role_missing',
        'The Owner role is missing. Run `pnpm db:migrate` first.',
      );
    }

    const [organization] = await tx
      .insert(organizations)
      .values({
        name: data.organizationName,
        slug,
        timeZone: data.timeZone ?? 'UTC',
        country: data.country ?? null,
      })
      .returning({ id: organizations.id, slug: organizations.slug });
    const [owner] = await tx
      .insert(users)
      .values({
        email: data.ownerEmail,
        emailNormalized,
        passwordHash,
        firstName: data.ownerFirstName,
        lastName: data.ownerLastName,
        displayName: `${data.ownerFirstName} ${data.ownerLastName}`.slice(0, 160),
        emailVerifiedAt: input.emailVerified ? new Date() : null,
      })
      .returning({ id: users.id });
    if (!organization || !owner) throw new Error('Bootstrap insert returned no row.');

    await tx
      .insert(memberships)
      .values({ organizationId: organization.id, userId: owner.id, roleId: ownerRole.id });
    await tx.insert(auditLogs).values({
      category: 'system',
      action: 'system.bootstrap',
      outcome: 'success',
      organizationId: organization.id,
      actorUserId: owner.id,
      targetType: 'organization',
      targetId: organization.id,
      requestId: 'bootstrap-cli',
      metadata: { ownerEmailVerified: input.emailVerified === true },
    });

    return {
      organizationId: organization.id,
      organizationSlug: organization.slug,
      ownerUserId: owner.id,
      ownerEmail: data.ownerEmail,
    };
  });
}
