import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@smartpack/shared';
import { COMMON_PASSWORDS, COMMON_STEMS } from './common-passwords.js';

export interface PasswordContext {
  /** Values the password must not contain, e.g. the person's email address and name. */
  email?: string;
  names?: readonly string[];
}

export type PasswordCheck = { ok: true } | { ok: false; message: string };

const SEQUENCE_SOURCES = [
  '01234567890123456789',
  'abcdefghijklmnopqrstuvwxyz',
  'qwertyuiopasdfghjklzxcvbnm',
  'zyxwvutsrqponmlkjihgfedcba',
  '98765432109876543210',
];

function stem(lower: string): string {
  return lower.replace(/^[^a-z]+|[^a-z]+$/g, '');
}

/** `passwordpassword` -> `password`; returns the input unchanged when nothing repeats. */
function repeatedUnit(lower: string): string {
  return /^(.+?)\1+$/.exec(lower)?.[1] ?? lower;
}

function isSequenceOrRepeat(lower: string): boolean {
  if (new Set(lower).size < 5) return true;
  return SEQUENCE_SOURCES.some((source) => source.includes(lower));
}

/**
 * Server-side password policy. Deliberately short on composition rules (they push people toward
 * predictable substitutions) and firm on the two things that matter: length, and not being
 * something an attacker tries first.
 */
export function checkPasswordPolicy(
  password: string,
  context: PasswordContext = {},
): PasswordCheck {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, message: `Use at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  const lower = password.toLowerCase();
  const unit = repeatedUnit(lower);
  if (
    COMMON_PASSWORDS.has(lower) ||
    COMMON_STEMS.has(stem(lower)) ||
    COMMON_PASSWORDS.has(unit) ||
    COMMON_STEMS.has(stem(unit)) ||
    isSequenceOrRepeat(lower)
  ) {
    return {
      ok: false,
      message: 'This password is too common or too predictable. Choose another.',
    };
  }
  const forbidden = [context.email?.split('@')[0], ...(context.names ?? [])]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => value !== undefined && value.length >= 4);
  if (forbidden.some((value) => lower.includes(value))) {
    return { ok: false, message: 'The password must not contain your name or email address.' };
  }
  return { ok: true };
}
