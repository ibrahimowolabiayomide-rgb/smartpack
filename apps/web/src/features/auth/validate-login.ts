import { z } from 'zod';

export interface LoginValues {
  email: string;
  password: string;
}

export type LoginErrors = Partial<Record<keyof LoginValues, string>>;

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .pipe(z.email('Enter a valid email address, such as name@company.com.'));

/**
 * Checks the sign-in form in the browser so people get an immediate, specific message. This is
 * convenience only: when sign-in exists (Phase 3) the server must validate again and never trust
 * this check.
 */
export function validateLogin(values: LoginValues): LoginErrors {
  const errors: LoginErrors = {};
  const email = emailSchema.safeParse(values.email);
  if (!email.success) errors.email = email.error.issues[0]?.message;
  if (values.password.length === 0) errors.password = 'Enter your password.';
  return errors;
}
