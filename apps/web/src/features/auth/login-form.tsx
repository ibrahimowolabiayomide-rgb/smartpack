'use client';

import { useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { validateLogin, type LoginErrors } from './validate-login';

type FormState = 'idle' | 'invalid' | 'not-enabled';

const subscribe = () => () => {};

/**
 * The sign-in form. Authentication does not exist yet (Phase 3), so this form validates and then
 * says so. It never sends the details anywhere, never stores them, never signs anyone in, and
 * clears the password field after a valid attempt.
 *
 * The submit button stays disabled until the page has hydrated. Without that, a very early press
 * could submit the form natively and put the password in the address bar.
 */
export function LoginForm() {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [state, setState] = useState<FormState>('idle');

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    };
    const found = validateLogin(values);
    setErrors(found);

    if (Object.keys(found).length > 0) {
      setState('invalid');
      // Move focus to the first field that needs attention.
      const first = found.email ? 'email' : 'password';
      form.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }

    // Valid input, but there is no sign-in service. Discard the password immediately.
    const password = form.querySelector<HTMLInputElement>('[name="password"]');
    if (password) password.value = '';
    setState('not-enabled');
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      aria-label="Sign in"
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
    >
      {state === 'invalid' ? (
        <Notice tone="warning" title="Check the highlighted fields">
          Nothing was submitted. Correct the fields below and try again.
        </Notice>
      ) : null}
      {state === 'not-enabled' ? (
        <div role="status">
          <Notice tone="info" title="Sign-in is not enabled yet">
            Your details were checked in this browser only. They were not sent, stored or used to
            sign you in, and the password field has been cleared. Sign-in arrives with Phase 3.
          </Notice>
        </div>
      ) : null}
      <TextField
        label="Email address"
        type="email"
        name="email"
        autoComplete="username"
        required
        error={errors.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        error={errors.password}
      />
      <Button type="submit" variant="primary" disabled={!hydrated}>
        Sign in
      </Button>
    </form>
  );
}
