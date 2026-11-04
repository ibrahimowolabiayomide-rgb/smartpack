'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { currentUserSchema } from '@smartpack/shared';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { apiRequest, describeFailure } from '@/lib/api/browser';
import { safeNextPath } from '@/lib/auth/next-path';
import { validateLogin, type LoginErrors } from './validate-login';

const subscribe = () => () => {};

/**
 * The sign-in form. Input is checked here for convenience and again by the server. The password
 * goes only to the same-origin API gateway, is never stored by this page, and the field is
 * cleared after a failed attempt. Every credential failure shows the same message, so the form
 * cannot be used to learn which addresses have accounts.
 *
 * The submit button stays disabled until the page has hydrated; a very early press would
 * otherwise submit natively and put the password in the address bar.
 */
export function LoginForm({ next, notice }: { next?: string; notice?: 'expired' | 'signed-out' }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<LoginErrors & { organizationSlug?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [needsCompany, setNeedsCompany] = useState(false);
  const [pending, setPending] = useState(false);

  // The company field only exists after the server asks for it, so focus it once it is on the page.
  useEffect(() => {
    if (needsCompany) {
      formRef.current?.querySelector<HTMLInputElement>('[name="organizationSlug"]')?.focus();
    }
  }, [needsCompany]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    };
    const organizationSlug = String(data.get('organizationSlug') ?? '').trim();
    const found = validateLogin(values);
    setErrors(found);
    setMessage(null);
    if (Object.keys(found).length > 0) {
      form
        .querySelector<HTMLInputElement>(`[name="${found.email ? 'email' : 'password'}"]`)
        ?.focus();
      return;
    }

    setPending(true);
    const result = await apiRequest('POST', '/auth/login', {
      body: { ...values, ...(organizationSlug ? { organizationSlug } : {}) },
      schema: currentUserSchema,
    });
    if (result.ok) {
      router.replace(safeNextPath(next) as never);
      router.refresh();
      return; // keep the button busy while the next page loads
    }
    setPending(false);

    if (result.fieldErrors.organizationSlug) {
      setNeedsCompany(true);
      setErrors({ organizationSlug: result.fieldErrors.organizationSlug });
      return;
    }
    const password = form.querySelector<HTMLInputElement>('[name="password"]');
    if (password) password.value = '';
    setMessage(
      result.code === 'INVALID_CREDENTIALS'
        ? 'The email address or password is not correct, or the account cannot sign in. Check them and try again.'
        : describeFailure(result),
    );
    password?.focus();
  };

  return (
    <form
      ref={formRef}
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-label="Sign in"
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
    >
      {notice === 'expired' ? (
        <Notice tone="info" title="Your session has ended">
          Sign in again to continue where you left off.
        </Notice>
      ) : null}
      {notice === 'signed-out' ? (
        <div role="status">
          <Notice tone="info" title="You have been signed out">
            Your session on this device has ended.
          </Notice>
        </div>
      ) : null}
      {message ? (
        <div role="alert">
          <Notice tone="warning" title="Could not sign in">
            {message}
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
      {needsCompany ? (
        <TextField
          label="Company reference"
          name="organizationSlug"
          autoComplete="organization"
          hint="Your account belongs to more than one company. Enter the reference you were given, for example acme-logistics."
          required
          error={errors.organizationSlug}
        />
      ) : null}
      <Button type="submit" variant="primary" disabled={!hydrated} loading={pending}>
        Sign in
      </Button>
      <p className="text-meta text-ink-muted">
        <Link href="/forgot-password" className="underline underline-offset-2 hover:text-ink">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
