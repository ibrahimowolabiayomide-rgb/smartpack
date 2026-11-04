import { describe, expect, it } from '@jest/globals';
import { loadConfig } from '../config/app-config.js';
import { PasswordHasher } from './password-hasher.js';
import { checkPasswordPolicy } from './password-policy.js';
import { RATE_LIMITS, RateLimiter, type RateLimitPolicy } from './rate-limiter.js';
import { fingerprint, generateToken, hashToken, safeEqual } from './tokens.js';

const config = (extra: Record<string, string> = {}) =>
  loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/db',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    ...extra,
  });

describe('tokens', () => {
  it('generates 256-bit URL-safe tokens that never repeat', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const token = generateToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      seen.add(token);
    }
    expect(seen.size).toBe(500);
  });

  it('hashes deterministically with SHA-256 and does not contain the token', () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).not.toBe(hashToken(generateToken()));
  });

  it('compares in constant time and handles unequal lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('fingerprints without revealing the value', () => {
    expect(fingerprint('a@b.test')).toBe(fingerprint('a@b.test'));
    expect(fingerprint('a@b.test')).not.toContain('a@b');
  });
});

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher(config({ ARGON2_MEMORY_KIB: '1024', ARGON2_TIME_COST: '1' }));

  it('produces salted Argon2id hashes that verify only the right password', async () => {
    const one = await hasher.hash('Correct-Horse-Battery-9');
    const two = await hasher.hash('Correct-Horse-Battery-9');
    expect(one).toMatch(/^\$argon2id\$/);
    expect(one).not.toBe(two);
    expect(await hasher.verify(one, 'Correct-Horse-Battery-9')).toBe(true);
    expect(await hasher.verify(one, 'Correct-Horse-Battery-8')).toBe(false);
  });

  it('returns false rather than throwing for a malformed stored hash', async () => {
    expect(await hasher.verify('not-a-hash', 'whatever-password-1')).toBe(false);
    expect(await hasher.verify('', 'whatever-password-1')).toBe(false);
  });

  it('asks for a re-hash only when the stored parameters are weaker than configured', async () => {
    const weak = await new PasswordHasher(
      config({ ARGON2_MEMORY_KIB: '1024', ARGON2_TIME_COST: '1' }),
    ).hash('Correct-Horse-Battery-9');
    const stronger = new PasswordHasher(
      config({ ARGON2_MEMORY_KIB: '2048', ARGON2_TIME_COST: '2' }),
    );
    expect(stronger.needsRehash(weak)).toBe(true);
    expect(hasher.needsRehash(weak)).toBe(false);
  });

  it('spends comparable work on an account that does not exist', async () => {
    await expect(hasher.verifyAgainstDummy('anything-at-all-123')).resolves.toBeUndefined();
  });
});

describe('password policy', () => {
  it.each([
    ['short', /at least 12/],
    ['password1234', /too common/],
    ['passwordpassword', /too common/],
    ['aaaaaaaaaaaaaaaa', /too common/],
    ['123456789012', /too common/],
    ['qwertyuiopas', /too common/],
    ['abcdefghijklmnop', /too common/],
  ])('rejects %s', (password, message) => {
    const result = checkPasswordPolicy(password);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(message);
  });

  it('rejects passwords containing the name or email local part', () => {
    expect(checkPasswordPolicy('Adaobi-Is-Great-1', { names: ['Adaobi'] }).ok).toBe(false);
    expect(checkPasswordPolicy('xx-tunde.bello-99', { email: 'tunde.bello@example.test' }).ok).toBe(
      false,
    );
  });

  it('rejects over-long passwords and accepts a long passphrase', () => {
    expect(checkPasswordPolicy('x1'.repeat(80)).ok).toBe(false);
    expect(checkPasswordPolicy('correct horse battery staple').ok).toBe(true);
    expect(checkPasswordPolicy('Sturdy-Lantern-Harbor-42').ok).toBe(true);
  });
});

describe('RateLimiter', () => {
  const policy: RateLimitPolicy = { name: 'unit', limit: 3, windowMs: 1000 };
  const limiter = (extra: Record<string, string> = {}) => new RateLimiter(config(extra));

  it('allows up to the limit, then blocks with a retry time', () => {
    const l = limiter();
    const t0 = 10_000;
    expect(l.consume(policy, 'k', t0).allowed).toBe(true);
    expect(l.consume(policy, 'k', t0 + 1).allowed).toBe(true);
    expect(l.consume(policy, 'k', t0 + 2).allowed).toBe(true);
    const blocked = l.consume(policy, 'k', t0 + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    l.onModuleDestroy();
  });

  it('slides: capacity returns as old hits leave the window', () => {
    const l = limiter();
    for (let i = 0; i < 3; i += 1) l.consume(policy, 'k', 1000 + i);
    expect(l.consume(policy, 'k', 1500).allowed).toBe(false);
    expect(l.consume(policy, 'k', 2100).allowed).toBe(true);
    l.onModuleDestroy();
  });

  it('keeps keys and policies independent', () => {
    const l = limiter();
    for (let i = 0; i < 3; i += 1) l.consume(policy, 'a', 1000);
    expect(l.consume(policy, 'a', 1001).allowed).toBe(false);
    expect(l.consume(policy, 'b', 1001).allowed).toBe(true);
    expect(l.consume({ ...policy, name: 'other' }, 'a', 1001).allowed).toBe(true);
    l.onModuleDestroy();
  });

  it('does not count a denied hit and peek never counts', () => {
    const l = limiter();
    for (let i = 0; i < 3; i += 1) l.consume(policy, 'k', 1000);
    for (let i = 0; i < 10; i += 1) l.consume(policy, 'k', 1001);
    expect(l.consume(policy, 'k', 2001).allowed).toBe(true);
    expect(l.peek(policy, 'fresh', 1000).allowed).toBe(true);
    expect(l.size()).toBeLessThanOrEqual(2);
    l.onModuleDestroy();
  });

  it('reset clears a key, and RATE_LIMIT_DISABLED turns everything off', () => {
    const l = limiter();
    for (let i = 0; i < 3; i += 1) l.record(policy, 'k', undefined, 1000);
    expect(l.peek(policy, 'k', 1001).allowed).toBe(false);
    l.reset(policy, 'k');
    expect(l.peek(policy, 'k', 1001).allowed).toBe(true);
    l.onModuleDestroy();

    const off = limiter({ RATE_LIMIT_DISABLED: 'true' });
    for (let i = 0; i < 50; i += 1) expect(off.consume(policy, 'k', 1000).allowed).toBe(true);
    off.onModuleDestroy();
  });

  it('scales limits and never goes below one', () => {
    const scaled = limiter({ RATE_LIMIT_SCALE: '0.1' });
    expect(scaled.consume(policy, 'k', 1000).allowed).toBe(true);
    expect(scaled.consume(policy, 'k', 1001).allowed).toBe(false);
    scaled.onModuleDestroy();
  });

  it('has the documented sign-in policies', () => {
    expect(RATE_LIMITS.loginFailuresPerAccountAndIp).toMatchObject({
      limit: 5,
      windowMs: 15 * 60_000,
    });
    expect(RATE_LIMITS.loginFailuresPerAccount).toMatchObject({ limit: 25, windowMs: 60 * 60_000 });
  });
});
