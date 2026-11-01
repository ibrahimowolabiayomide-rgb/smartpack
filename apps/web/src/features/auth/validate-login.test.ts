import { describe, expect, it } from 'vitest';
import { validateLogin } from './validate-login';

describe('validateLogin', () => {
  it('accepts a plausible email and any non-empty password', () => {
    expect(validateLogin({ email: 'name@company.com', password: 'x' })).toEqual({});
  });

  it('requires both fields', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
  });

  it('treats whitespace-only email as missing', () => {
    expect(validateLogin({ email: '   ', password: 'x' }).email).toBe('Enter your email address.');
  });

  it.each(['plain', 'a@', '@b.com', 'a b@c.com'])('rejects the malformed email %s', (email) => {
    expect(validateLogin({ email, password: 'x' }).email).toMatch(/valid email/);
  });

  it('does not trim or otherwise judge the password', () => {
    expect(validateLogin({ email: 'a@b.co', password: '   ' })).toEqual({});
  });
});
