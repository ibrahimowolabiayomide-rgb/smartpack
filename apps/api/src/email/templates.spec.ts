import { describe, expect, it } from '@jest/globals';
import { ROLE_DEFINITIONS, ROLE_KEYS, type RoleKey } from '@smartpack/shared';
import { describeHours, describeMinutes } from './layout.js';
import { formatUtcTimestamp, renderEmail, type EmailTemplate } from './templates.js';

const INVITE_LINK = 'https://app.example.test/accept-invitation#token=abc123';
const RESET_LINK = 'https://app.example.test/reset-password#token=def456';
const VERIFY_LINK = 'https://app.example.test/verify-email#token=ghi789';
const FORGOT_PAGE = 'https://app.example.test/forgot-password';

type Invitation = Extract<EmailTemplate, { name: 'invitation' }>;

function invitation(roleKey: RoleKey, overrides: Partial<Invitation> = {}): Invitation {
  const role = ROLE_DEFINITIONS.find((r) => r.key === roleKey);
  if (!role) throw new Error(`unknown role ${roleKey}`);
  return {
    name: 'invitation',
    organizationName: 'Acme Logistics',
    inviterName: 'Ada Okafor',
    roleName: role.name,
    roleKey,
    recipientEmail: 'tunde@example.test',
    link: INVITE_LINK,
    expiresInHours: 72,
    ...overrides,
  };
}

const verification: EmailTemplate = {
  name: 'email_verification',
  link: VERIFY_LINK,
  expiresInHours: 24,
  recipientName: 'Tunde',
  recipientEmail: 'tunde@example.test',
  organizationName: 'Acme Logistics',
};
const reset: EmailTemplate = {
  name: 'password_reset',
  link: RESET_LINK,
  expiresInMinutes: 60,
  recipientName: 'Tunde',
  recipientEmail: 'tunde@example.test',
};
const changed: EmailTemplate = {
  name: 'password_changed',
  at: '6 November 2026 at 00:10 UTC',
  recipientName: 'Tunde',
  recipientEmail: 'tunde@example.test',
  via: 'change',
  resetPageLink: FORGOT_PAGE,
};

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? '');
}

describe('invitation emails', () => {
  it.each(ROLE_KEYS)('renders a complete, correct invitation for the %s role', (key) => {
    const email = renderEmail(invitation(key));
    const roleName = ROLE_DEFINITIONS.find((r) => r.key === key)?.name ?? '';
    for (const body of [email.text, email.html]) {
      expect(body).toContain('Acme Logistics');
      expect(body).toContain('Ada Okafor');
      expect(body).toContain(roleName.replace('&', '&amp;'));
      expect(body).toContain('tunde@example.test');
      expect(body).toContain('72 hours (3 days)');
      expect(body).toContain(INVITE_LINK);
      expect(body).toContain('Accept invitation');
    }
    expect(email.subject).toContain('Acme Logistics');
    expect(email.text).toContain('If you were not expecting this invitation');
    expect(email.text).toContain('will never ask you for your password');
    // The button points at the real invitation link; the footer link is the web origin only.
    expect(hrefs(email.html)).toEqual(
      expect.arrayContaining([INVITE_LINK, 'https://app.example.test']),
    );
  });

  it('gives every role its own subject, heading and access description', () => {
    const rendered = ROLE_KEYS.map((key) => renderEmail(invitation(key)));
    expect(new Set(rendered.map((r) => r.subject)).size).toBe(ROLE_KEYS.length);
    const resent = ROLE_KEYS.map((key) => renderEmail(invitation(key, { resend: true })));
    expect(new Set(resent.map((r) => r.subject)).size).toBe(ROLE_KEYS.length);
    const headings = rendered.map((r) => r.text.split('\n')[0]);
    expect(new Set(headings).size).toBe(ROLE_KEYS.length);
  });

  it('keeps the administrator invitation clearly apart from the worker invitation', () => {
    const admin = renderEmail(invitation('admin'));
    const worker = renderEmail(invitation('worker'));

    expect(admin.subject).toContain('administer Acme Logistics');
    expect(admin.text).toContain(
      'Assign roles to members, with the exception of the Company Owner role.',
    );
    expect(admin.text).toContain('cannot grant or remove the Company Owner role');
    expect(admin.text).toContain('please accept it only if you were expecting it');

    expect(worker.subject).toContain('as a worker');
    expect(worker.text).toContain('does not give you administrator or owner access');
    expect(worker.text).toContain('does not include access to company settings, member management');
    for (const adminOnly of ['Assign roles', 'suspend, reactivate', 'Change company settings']) {
      expect(worker.text).not.toContain(adminOnly);
      expect(admin.text).toContain(adminOnly);
    }
    expect(admin.text).not.toContain('Field staff');
    expect(worker.text).not.toContain('Company Administrator');
  });

  it('describes the owner role as the only one that can assign the owner role', () => {
    const owner = renderEmail(invitation('owner'));
    expect(owner.text).toContain('including the Company Owner role itself');
    expect(owner.subject).toContain('owner of Acme Logistics');
  });

  it('writes a distinct resend that keeps the role, company and the new link', () => {
    const first = renderEmail(invitation('supervisor'));
    const again = renderEmail(invitation('supervisor', { resend: true }));
    expect(first.subject).not.toBe(again.subject);
    expect(again.subject).toContain('sent again');
    expect(again.subject).toContain('Supervisor');
    expect(again.subject).toContain('Acme Logistics');
    expect(first.subject).not.toContain('sent again');
    expect(again.text).toContain('sent your invitation');
    expect(again.text).toContain('new link');
    expect(again.text).toContain('Supervisor');
    expect(again.text).toContain(INVITE_LINK);
    expect(again.text).toContain('72 hours (3 days)');
  });

  it('shows the configured lifetime, not a fixed one', () => {
    expect(renderEmail(invitation('worker', { expiresInHours: 24 })).text).toContain(
      '24 hours (1 day)',
    );
    expect(renderEmail(invitation('worker', { expiresInHours: 36 })).text).toContain('36 hours');
    expect(renderEmail(invitation('worker', { expiresInHours: 36 })).text).not.toContain(
      '36 hours (',
    );
  });

  it('escapes every dynamic value in the HTML', () => {
    const email = renderEmail(
      invitation('worker', {
        organizationName: 'Acme <b>& Sons</b>',
        inviterName: 'Ada "the boss"',
        recipientEmail: 'a<script>@example.test',
      }),
    );
    expect(email.html).not.toContain('<b>& Sons</b>');
    expect(email.html).toContain('&lt;b&gt;&amp; Sons&lt;/b&gt;');
    expect(email.html).not.toContain('"the boss"');
    expect(email.html).not.toContain('<script>');
  });
});

describe('role copy matches the real permissions', () => {
  // The invitation text describes these facts in words. If a role's permissions change, one of
  // these fails and the matching copy in invitation-roles.ts must be reviewed.
  const perms = (key: RoleKey) => ROLE_DEFINITIONS.find((r) => r.key === key)?.permissions ?? [];
  const has = (key: RoleKey, ...needed: string[]) =>
    needed.every((p) => (perms(key) as readonly string[]).includes(p));
  const lacks = (key: RoleKey, ...missing: string[]) =>
    missing.every((p) => !(perms(key) as readonly string[]).includes(p));

  it('owner', () => {
    expect(
      has('owner', 'organization.transfer_ownership', 'organization.manage', 'audit.view'),
    ).toBe(true);
    expect(perms('owner')).toHaveLength(25);
  });
  it('admin', () => {
    expect(
      has(
        'admin',
        'organization.manage',
        'users.invite',
        'users.update',
        'users.suspend',
        'roles.manage',
        'audit.view',
      ),
    ).toBe(true);
    expect(lacks('admin', 'organization.transfer_ownership')).toBe(true);
    expect(perms('admin')).toHaveLength(24);
  });
  it('operations manager', () => {
    expect(
      has(
        'operations_manager',
        'assets.create',
        'assets.update',
        'workers.manage',
        'verifications.manage',
        'tracking.view',
        'custody.manage',
        'inspections.manage',
        'alerts.view',
        'incidents.manage',
        'reports.view',
        'reports.export',
      ),
    ).toBe(true);
    expect(
      lacks(
        'operations_manager',
        'users.invite',
        'users.update',
        'users.suspend',
        'roles.manage',
        'organization.manage',
        'audit.view',
      ),
    ).toBe(true);
  });
  it('asset manager', () => {
    expect(
      has(
        'asset_manager',
        'assets.create',
        'assets.update',
        'inspections.view',
        'inspections.manage',
        'verifications.view',
        'tracking.view',
        'custody.view',
        'reports.view',
      ),
    ).toBe(true);
    expect(
      lacks(
        'asset_manager',
        'workers.view',
        'workers.manage',
        'users.invite',
        'roles.manage',
        'organization.manage',
        'reports.export',
        'custody.manage',
      ),
    ).toBe(true);
  });
  it('supervisor', () => {
    expect(
      has(
        'supervisor',
        'assets.view',
        'workers.view',
        'verifications.manage',
        'custody.manage',
        'inspections.manage',
        'tracking.view',
        'alerts.view',
      ),
    ).toBe(true);
    expect(
      lacks(
        'supervisor',
        'assets.create',
        'assets.update',
        'reports.view',
        'users.invite',
        'roles.manage',
        'organization.manage',
      ),
    ).toBe(true);
  });
  it('worker', () => {
    expect(perms('worker')).toEqual(['organization.view']);
  });
  it('auditor is read-only', () => {
    expect(has('auditor', 'audit.view', 'reports.view', 'users.view')).toBe(true);
    const writes = (perms('auditor') as readonly string[]).filter((p) =>
      /\.(manage|create|update|invite|suspend|export|transfer_ownership)$/.test(p),
    );
    expect(writes).toEqual([]);
  });
});

describe('verification email', () => {
  it('welcomes the person, explains the request and states the real expiry', () => {
    const email = renderEmail(verification);
    expect(email.subject).toBe('Welcome to SmartPack: please verify your email address');
    for (const body of [email.text, email.html]) {
      expect(body).toContain('Hello Tunde,');
      expect(body).toContain('Welcome to SmartPack');
      expect(body).toContain('tunde@example.test');
      expect(body).toMatch(/Acme Logistics(&#39;|')s workspace/);
      expect(body).toContain('24 hours (1 day)');
      expect(body).toContain(VERIFY_LINK);
      expect(body).toContain('Verify email address');
    }
    expect(email.text).toContain('If you did not request this');
  });

  it('falls back to a plain greeting and omits the company when unknown', () => {
    const email = renderEmail({
      name: 'email_verification',
      link: VERIFY_LINK,
      expiresInHours: 48,
      recipientEmail: 'x@example.test',
    });
    expect(email.text).toContain('Hello,');
    expect(email.text).not.toContain('workspace');
    expect(email.text).toContain('48 hours (2 days)');
  });
});

describe('password reset email', () => {
  it('has a labelled button, the real expiry and clear guidance', () => {
    const email = renderEmail(reset);
    expect(email.subject).toBe('Reset your SmartPack password');
    for (const body of [email.text, email.html]) {
      expect(body).toContain('Hello Tunde,');
      expect(body).toContain('Reset password');
      expect(body).toContain('60 minutes (1 hour)');
      expect(body).toContain(RESET_LINK);
    }
    expect(email.text).toContain('signs you out of SmartPack on every device');
    expect(email.text).toContain('If you did not request a password reset');
    expect(email.text).toContain('Your password has not been changed');
    expect(email.text.toLowerCase()).not.toMatch(/reply with your password|send us your password/);
  });

  it('reflects a different configured lifetime', () => {
    expect(renderEmail({ ...reset, expiresInMinutes: 30 }).text).toContain('30 minutes');
  });
});

describe('password changed notification', () => {
  it('confirms the change, says why it was sent and what to do if it was not the person', () => {
    const email = renderEmail(changed);
    expect(email.subject).toBe('Your SmartPack password has been changed');
    for (const body of [email.text, email.html]) {
      expect(body).toContain('Hello Tunde,');
      expect(body).toContain('6 November 2026 at 00:10 UTC');
      expect(body).toContain('Reset my password');
      expect(body).toContain(FORGOT_PAGE);
    }
    expect(email.text).toContain('We send this notice every time a password changes');
    expect(email.text).toContain('If you did not make this change');
    // A notice never carries a one-time token.
    expect(email.text).not.toContain('#token=');
    expect(email.html).not.toContain('#token=');
  });

  it('describes a change and a reset differently', () => {
    const viaChange = renderEmail(changed).text;
    const viaReset = renderEmail({ ...changed, via: 'reset' }).text;
    expect(viaChange).toContain('every other device was signed out');
    expect(viaChange).toContain('while it was signed in');
    expect(viaReset).toContain('every session on this account was ended');
    expect(viaReset).toContain('password-reset link');
  });
});

describe('every message', () => {
  const all: EmailTemplate[] = [
    invitation('worker'),
    invitation('admin', { resend: true }),
    verification,
    reset,
    changed,
  ];

  it('has a unique subject per purpose and never reuses another message', () => {
    const subjects = all.map((t) => renderEmail(t).subject);
    expect(new Set(subjects).size).toBe(all.length);
  });

  it('shares the SmartPack frame and works on phones', () => {
    for (const template of all) {
      const { html, text } = renderEmail(template);
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('name="viewport"');
      expect(html).toContain('@media only screen and (max-width:620px)');
      expect(html).toContain('Asset Intelligence Platform');
      expect(html).toContain('Open SmartPack');
      expect(html).toContain('Regards,');
      expect(text).toContain('The SmartPack team');
      expect(text).toContain('will never ask you for your password');
      // Plain text must be genuinely plain.
      expect(text).not.toMatch(/<\/?[a-z][^>]*>/i);
      // No invented contact details.
      expect(`${html}${text}`).not.toMatch(/\+?\d[\d\s-]{8,}\d|support@|mailto:/i);
    }
  });

  it('keeps tokens in the link fragment only', () => {
    for (const template of all) {
      for (const href of hrefs(renderEmail(template).html)) {
        const url = new URL(href);
        expect(url.search).toBe('');
      }
    }
  });
});

describe('formatting helpers', () => {
  it('describes durations in words that match the configured value', () => {
    expect(describeHours(1)).toBe('1 hour');
    expect(describeHours(24)).toBe('24 hours (1 day)');
    expect(describeHours(72)).toBe('72 hours (3 days)');
    expect(describeHours(30)).toBe('30 hours');
    expect(describeMinutes(1)).toBe('1 minute');
    expect(describeMinutes(45)).toBe('45 minutes');
    expect(describeMinutes(60)).toBe('60 minutes (1 hour)');
    expect(describeMinutes(120)).toBe('120 minutes (2 hours)');
  });

  it('formats a UTC timestamp unambiguously', () => {
    expect(formatUtcTimestamp(new Date('2026-11-06T00:10:30.000Z'))).toBe(
      '6 November 2026 at 00:10 UTC',
    );
    expect(formatUtcTimestamp(new Date('2026-01-31T23:05:00.000Z'))).toBe(
      '31 January 2026 at 23:05 UTC',
    );
  });
});
