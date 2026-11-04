import { describe, expect, it } from '@jest/globals';
import { renderEmail } from './templates.js';

describe('email templates', () => {
  it('puts the link in text and html, and escapes names in html', () => {
    const email = renderEmail({
      name: 'invitation',
      organizationName: 'Acme <b>& Sons</b>',
      inviterName: 'Ada "the boss"',
      roleName: 'Worker',
      link: 'https://app.example.test/accept-invitation#token=abc',
      expiresInHours: 72,
    });
    expect(email.text).toContain('https://app.example.test/accept-invitation#token=abc');
    expect(email.html).toContain('https://app.example.test/accept-invitation#token=abc');
    expect(email.html).not.toContain('<b>& Sons</b>');
    expect(email.html).toContain('&lt;b&gt;&amp; Sons&lt;/b&gt;');
    expect(email.html).not.toContain('"the boss"');
    expect(email.subject).toContain('Acme');
  });

  it.each([
    [
      {
        name: 'email_verification',
        link: 'https://x.test/verify-email#token=t',
        expiresInHours: 24,
      },
    ],
    [
      {
        name: 'password_reset',
        link: 'https://x.test/reset-password#token=t',
        expiresInMinutes: 60,
      },
    ],
    [{ name: 'password_changed', at: '2026-11-01T10:00:00.000Z' }],
  ] as const)('renders %j with a subject and both bodies', (template) => {
    const email = renderEmail(template);
    expect(email.subject.length).toBeGreaterThan(3);
    expect(email.text.length).toBeGreaterThan(20);
    expect(email.html).toContain('<');
  });

  it('never asks the recipient to reply with a password', () => {
    const email = renderEmail({
      name: 'password_reset',
      link: 'https://x.test/r#token=t',
      expiresInMinutes: 60,
    });
    expect(email.text.toLowerCase()).not.toMatch(/reply with your password|send us your password/);
  });
});
