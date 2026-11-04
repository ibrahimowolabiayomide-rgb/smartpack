import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes (256 bits), base64url: 43 characters, URL-safe. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 of a token, hex encoded. Session, invitation, reset and verification tokens are random
 * 256-bit values, so a fast hash is sufficient (there is nothing to brute-force, unlike a password).
 * Only this hash is stored; the raw token exists in the browser cookie or the email link alone.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time comparison for values that are compared in application code. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Short, non-reversible fingerprint for logs and audit metadata (never the value itself). */
export function fingerprint(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);
}
