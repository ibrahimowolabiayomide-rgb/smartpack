import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@smartpack/shared';

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters. A few unrelated words make a strong password. Avoid common passwords and your own name or email.`;

/** Convenience check before sending; the server applies the real policy. */
export function checkNewPassword(password: string, confirm: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (password !== confirm) return 'The two passwords do not match.';
  return undefined;
}
