import { describe, expect, it } from 'vitest';
import {
  PERMISSION_KEYS,
  ROLE_DEFINITIONS,
  holdsAllPermissions,
  isPermissionKey,
  normalizeEmail,
  passwordSchema,
  tokenSchema,
  acceptInvitationRequestSchema,
  listAuditQuerySchema,
  updateOrganizationRequestSchema,
} from './index.js';

describe('role definitions', () => {
  const byKey = Object.fromEntries(ROLE_DEFINITIONS.map((r) => [r.key, r]));

  it('only grants permissions that exist, with unique ranks', () => {
    for (const role of ROLE_DEFINITIONS) {
      for (const permission of role.permissions) expect(PERMISSION_KEYS).toContain(permission);
    }
    expect(new Set(ROLE_DEFINITIONS.map((r) => r.rank)).size).toBe(ROLE_DEFINITIONS.length);
  });

  it('gives the owner everything and reserves ownership transfer for owners', () => {
    expect(byKey.owner!.permissions).toHaveLength(PERMISSION_KEYS.length);
    for (const role of ROLE_DEFINITIONS.filter((r) => r.key !== 'owner')) {
      expect(role.permissions).not.toContain('organization.transfer_ownership');
    }
  });

  it('makes the privilege rule prevent escalation: nobody but an owner can assign owner', () => {
    const owner = byKey.owner!.permissions;
    for (const role of ROLE_DEFINITIONS.filter((r) => r.key !== 'owner')) {
      expect(holdsAllPermissions(role.permissions, owner)).toBe(false);
      expect(holdsAllPermissions(owner, role.permissions)).toBe(true);
    }
    expect(holdsAllPermissions(byKey.admin!.permissions, byKey.worker!.permissions)).toBe(true);
  });

  it('keeps administrative permissions away from workers and auditors', () => {
    for (const key of ['worker', 'auditor']) {
      for (const permission of ['users.invite', 'users.manage', 'organization.manage'] as const) {
        expect(byKey[key]!.permissions).not.toContain(permission);
      }
    }
    expect(byKey.auditor!.permissions).toContain('audit.view');
    expect(byKey.worker!.permissions).not.toContain('audit.view');
  });

  it('recognises only catalogue permission keys', () => {
    expect(isPermissionKey('audit.view')).toBe(true);
    expect(isPermissionKey('audit.delete')).toBe(false);
    expect(holdsAllPermissions([], [])).toBe(true);
    expect(holdsAllPermissions([], ['audit.view'])).toBe(false);
  });
});

describe('request schemas', () => {
  it('normalises email addresses', () => {
    expect(normalizeEmail('  Ada.Okafor@Example.TEST ')).toBe('ada.okafor@example.test');
  });

  it('bounds passwords and token shape', () => {
    expect(passwordSchema.safeParse('x'.repeat(11)).success).toBe(false);
    expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false);
    expect(passwordSchema.safeParse('a decent passphrase').success).toBe(true);
    expect(tokenSchema.safeParse('A'.repeat(43)).success).toBe(true);
    expect(tokenSchema.safeParse('A'.repeat(42)).success).toBe(false);
    expect(tokenSchema.safeParse('../'.repeat(15)).success).toBe(false);
  });

  it('requires a name and password for new accounts and a password only for existing ones', () => {
    const token = 'A'.repeat(43);
    expect(
      acceptInvitationRequestSchema.safeParse({
        token,
        accountExists: false,
        password: 'a decent passphrase',
      }).success,
    ).toBe(false);
    expect(
      acceptInvitationRequestSchema.safeParse({
        token,
        accountExists: false,
        firstName: 'A',
        lastName: 'B',
        password: 'a decent passphrase',
      }).success,
    ).toBe(true);
    expect(
      acceptInvitationRequestSchema.safeParse({ token, accountExists: true, password: 'anything' })
        .success,
    ).toBe(true);
  });

  it('rejects unknown and empty company updates', () => {
    expect(updateOrganizationRequestSchema.safeParse({}).success).toBe(false);
    expect(updateOrganizationRequestSchema.safeParse({ slug: 'x-y' }).success).toBe(false);
    expect(updateOrganizationRequestSchema.safeParse({ country: 'NG' }).success).toBe(true);
    expect(updateOrganizationRequestSchema.safeParse({ country: 'Nigeria' }).success).toBe(false);
  });

  it('bounds audit queries', () => {
    expect(listAuditQuerySchema.parse({}).limit).toBe(50);
    expect(listAuditQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(listAuditQuerySchema.safeParse({ cursor: '12; drop table' }).success).toBe(false);
  });
});
